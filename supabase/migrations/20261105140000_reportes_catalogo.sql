-- PBI-31 (AB#65): reporte de errores del catálogo por usuarios.
--
-- Un usuario avisa que una carta tiene un dato mal (nombre, imagen, número...).
-- Un administrador revisa los reportes y los marca como resueltos o descartados.
-- El reporte es dato de usuario: RLS con using y with check.
--
-- Reglas que impone la base (no la interfaz):
--   * Cada usuario crea reportes SOLO a su nombre y siempre en estado 'abierto'
--     (si pudiera elegir el estado, se daría por "resuelto" a sí mismo).
--   * Cada usuario ve solo SUS reportes; administradores y superusuarios ven todos.
--   * Los usuarios no editan ni borran lo que enviaron.
--   * Solo administradores y superusuarios cambian el estado, y SOLO el estado.
--   * Contra el abuso: un solo reporte abierto por carta y motivo, y un máximo
--     de 20 reportes por usuario cada 24 horas.

create table public.reportes_catalogo (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  carta_id    bigint not null references public.cartas (id) on delete cascade,
  motivo      text not null check (motivo in ('nombre', 'imagen', 'numero', 'rareza', 'variantes', 'otro')),
  detalle     text not null check (char_length(detalle) between 10 and 500),
  estado      text not null default 'abierto' check (estado in ('abierto', 'resuelto', 'descartado')),
  creado_en   timestamptz not null default now()
);

create index reportes_catalogo_usuario_idx on public.reportes_catalogo (usuario_id, creado_en desc);
create index reportes_catalogo_estado_idx on public.reportes_catalogo (estado, creado_en desc);

-- Un usuario no repite el mismo reporte abierto sobre la misma carta.
create unique index reportes_catalogo_abierto_unico
  on public.reportes_catalogo (usuario_id, carta_id, motivo)
  where estado = 'abierto';

alter table public.reportes_catalogo enable row level security;

-- Crear: a su nombre y siempre abierto.
create policy "cada usuario crea reportes a su nombre"
  on public.reportes_catalogo for insert to authenticated
  with check ((select auth.uid()) = usuario_id and estado = 'abierto');

-- Leer: los propios; administradores y superusuarios, todos.
create policy "cada usuario ve sus reportes y los administradores todos"
  on public.reportes_catalogo for select to authenticated
  using (
    (select auth.uid()) = usuario_id
    or exists (
      select 1 from public.perfiles p
      where p.id = (select auth.uid()) and p.rol in ('administrador', 'superusuario')
    )
  );

-- Cambiar el estado: solo administradores y superusuarios (using y with check).
create policy "los administradores gestionan el estado de los reportes"
  on public.reportes_catalogo for update to authenticated
  using (exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.rol in ('administrador', 'superusuario')
  ))
  with check (exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.rol in ('administrador', 'superusuario')
  ));

-- Permisos de tabla (defensa en capas, además de RLS):
--   * sin acceso para el cliente anónimo;
--   * nadie borra por la API;
--   * en UPDATE solo se puede tocar la columna estado: un administrador no
--     reescribe lo que dijo el usuario ni se lo atribuye a otro.
revoke all on public.reportes_catalogo from anon;
revoke update, delete, truncate on public.reportes_catalogo from authenticated;
grant update (estado) on public.reportes_catalogo to authenticated;

-- ---------------------------------------------------------------------------
-- Tope por usuario: 20 reportes cada 24 horas
-- ---------------------------------------------------------------------------

create function privado.limitar_reportes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*) from public.reportes_catalogo
    where usuario_id = new.usuario_id and creado_en > now() - interval '24 hours'
  ) >= 20 then
    raise exception 'Alcanzaste el máximo de 20 reportes por día'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger reportes_catalogo_limite
  before insert on public.reportes_catalogo
  for each row execute function privado.limitar_reportes();

-- Mismo criterio que el resto de funciones de privado: nadie las llama por la API.
revoke execute on function privado.limitar_reportes() from public, anon, authenticated;
