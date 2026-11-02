-- Perfiles, inventario, mazos y auditoría.
-- Se aplica después de la migración del catálogo (usa public.cartas).
--
-- Corrige el modelo heredado de SQLite (versión de escritorio):
--   * Las relaciones usan el uuid de auth.users, no el nombre de usuario:
--     RLS compara contra auth.uid() y un nombre puede cambiar o repetirse.
--   * Los usuarios los administra Supabase Auth. Aquí solo vive el perfil
--     público y el rol, que nunca se lee de datos enviados por el cliente.
--   * Inventario y mazos apuntan a la carta por clave foránea en vez de copiar
--     id_api, nombre, idioma y edición.
--
-- Reglas de acceso:
--   * Datos de usuario: cada política lleva using y with check.
--   * Auditoría: solo inserción, ni siquiera el servidor la modifica.

-- Funciones internas. Este esquema no está expuesto por la Data API.
create schema privado;
revoke all on schema privado from public;


-- ---------------------------------------------------------------------------
-- Perfiles y roles
-- ---------------------------------------------------------------------------

create type public.rol_usuario as enum ('superusuario', 'administrador', 'usuario_normal');

create table public.perfiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  nombre_visible  text not null check (char_length(nombre_visible) between 3 and 30),
  rol             public.rol_usuario not null default 'usuario_normal',
  creado_en       timestamptz not null default now()
);

alter table public.perfiles enable row level security;

create policy "cada usuario ve su perfil"
  on public.perfiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "cada usuario edita su perfil"
  on public.perfiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- RLS decide qué filas, no qué columnas. El privilegio por columna impide que
-- un usuario se asigne otro rol editando su propio perfil.
revoke all on public.perfiles from anon, authenticated;
grant select on public.perfiles to authenticated;
grant update (nombre_visible) on public.perfiles to authenticated;

-- Crea el perfil al registrarse. El rol queda siempre en 'usuario_normal':
-- raw_user_meta_data lo envía el cliente y no es confiable para el rol.
create function privado.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nombre text := trim(coalesce(new.raw_user_meta_data ->> 'nombre_visible', ''));
begin
  if char_length(nombre) not between 3 and 30 then
    nombre := 'usuario_' || left(new.id::text, 8);
  end if;

  insert into public.perfiles (id, nombre_visible) values (new.id, nombre);
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function privado.crear_perfil();


-- ---------------------------------------------------------------------------
-- Inventario (antes usuario_carta)
-- ---------------------------------------------------------------------------

create table public.inventario (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  carta_id    bigint not null references public.cartas (id) on delete restrict,
  variante    text not null,
  cantidad    integer not null check (cantidad between 1 and 9999),
  unique (usuario_id, carta_id, variante)
);

create index inventario_carta_idx on public.inventario (carta_id);

alter table public.inventario enable row level security;

create policy "cada usuario gestiona su inventario"
  on public.inventario for all to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

revoke all on public.inventario from anon;

-- Una columna check no puede consultar otra tabla, por eso se usa un trigger.
create function privado.validar_variante()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.cartas c
    where c.id = new.carta_id and new.variante = any (c.variantes_disponibles)
  ) then
    raise exception 'La variante % no existe para la carta %', new.variante, new.carta_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger inventario_valida_variante
  before insert or update of carta_id, variante on public.inventario
  for each row execute function privado.validar_variante();


-- ---------------------------------------------------------------------------
-- Mazos
-- ---------------------------------------------------------------------------

create table public.mazos (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 1 and 60),
  creado_en   timestamptz not null default now()
);

create index mazos_usuario_idx on public.mazos (usuario_id);

create table public.mazo_cartas (
  mazo_id   bigint not null references public.mazos (id) on delete cascade,
  carta_id  bigint not null references public.cartas (id) on delete restrict,
  cantidad  integer not null check (cantidad between 1 and 60),
  primary key (mazo_id, carta_id)
);

create index mazo_cartas_carta_idx on public.mazo_cartas (carta_id);

alter table public.mazos       enable row level security;
alter table public.mazo_cartas enable row level security;

create policy "cada usuario gestiona sus mazos"
  on public.mazos for all to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

-- with check impide agregar cartas al mazo de otro usuario.
create policy "cada usuario gestiona las cartas de sus mazos"
  on public.mazo_cartas for all to authenticated
  using (exists (
    select 1 from public.mazos m
    where m.id = mazo_id and m.usuario_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.mazos m
    where m.id = mazo_id and m.usuario_id = (select auth.uid())
  ));

revoke all on public.mazos, public.mazo_cartas from anon;


-- ---------------------------------------------------------------------------
-- Auditoría (solo inserción)
-- ---------------------------------------------------------------------------

create table public.auditoria (
  id           bigint generated always as identity primary key,
  ocurrido_en  timestamptz not null default now(),
  -- Sin clave foránea: el registro debe sobrevivir a la eliminación del usuario.
  -- NULL significa que el cambio se hizo desde la consola, sin sesión de usuario.
  usuario_id   uuid,
  accion       text not null,
  tabla        text not null,
  registro_id  text,
  detalle      jsonb
);

-- RLS activa y sin políticas: la API no puede leerla ni escribirla.
-- Solo escriben los triggers con security definer.
alter table public.auditoria enable row level security;
revoke all on public.auditoria from anon, authenticated;

create function privado.bloquear_modificacion_auditoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'La bitácora de auditoría es de solo inserción';
end;
$$;

-- Los triggers alcanzan también a service_role, que se salta RLS.
create trigger auditoria_sin_update_delete
  before update or delete on public.auditoria
  for each row execute function privado.bloquear_modificacion_auditoria();

create trigger auditoria_sin_truncate
  before truncate on public.auditoria
  for each statement execute function privado.bloquear_modificacion_auditoria();

create function privado.auditar_cambio_rol()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.auditoria (usuario_id, accion, tabla, registro_id, detalle)
  values (
    auth.uid(),
    'cambio_rol',
    'perfiles',
    new.id::text,
    jsonb_build_object('antes', old.rol, 'despues', new.rol)
  );
  return new;
end;
$$;

create trigger perfiles_audita_rol
  after update of rol on public.perfiles
  for each row
  when (old.rol is distinct from new.rol)
  execute function privado.auditar_cambio_rol();


-- ---------------------------------------------------------------------------
-- Permisos sobre las funciones internas
-- ---------------------------------------------------------------------------

-- Postgres otorga execute a public en toda función nueva. Nadie las llama
-- directamente: solo los triggers, y un trigger no revisa ese privilegio al
-- dispararse. Defensa en profundidad por si el esquema llega a exponerse.
revoke execute on all functions in schema privado from public, anon, authenticated;
