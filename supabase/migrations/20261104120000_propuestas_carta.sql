-- Propuestas de imagen, descripción y detalles para el catálogo.
--
-- Un usuario propone; un administrador aprueba antes de que lo vean todos.
-- Solo para cartas sin imagen: una propuesta nunca reemplaza una existente.
--
-- Archivos:
--   * Bucket Propuestas: privado y sin políticas, igual que Images. Solo
--     service_role sube, firma y borra (lib/propuestas.ts), y solo después de
--     validar la sesión; el archivo ya llega recodificado a WebP.
--   * Al aprobar, el servidor copia el archivo a Images/<idioma>/propuestas/ y
--     esta base actualiza cartas.imagen_path.
--
-- Toda escritura pasa por funciones security definer que revisan quién llama.
-- La API no tiene insert, update ni delete sobre estas tablas.


-- ---------------------------------------------------------------------------
-- 1. Bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('Propuestas', 'Propuestas', false, 1048576, array['image/webp'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ---------------------------------------------------------------------------
-- 2. Descripción y detalles publicados
-- ---------------------------------------------------------------------------

-- Separada de cartas para no tocar la tabla que carga la ingesta.
create table public.cartas_detalle (
  carta_id      bigint primary key references public.cartas (id) on delete cascade,
  descripcion   text not null check (char_length(descripcion) between 1 and 1000),
  -- Texto libre (decisión del equipo). Se muestra como texto, nunca como HTML.
  detalles      text not null check (char_length(detalles) between 1 and 2000),
  aprobado_por  uuid,
  aprobado_en   timestamptz not null default now()
);

alter table public.cartas_detalle enable row level security;

create policy "detalle del catalogo visible para todos"
  on public.cartas_detalle for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.cartas_detalle from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3. Propuestas
-- ---------------------------------------------------------------------------

create type public.estado_propuesta as enum ('pendiente', 'aprobada', 'rechazada');

create table public.propuestas_carta (
  id              bigint generated always as identity primary key,
  carta_id        bigint not null references public.cartas (id) on delete cascade,
  usuario_id      uuid not null references public.perfiles (id) on delete cascade,
  -- Nombre generado por el servidor: uuid.webp, sin carpetas ni "../".
  imagen_path     text not null unique
    check (imagen_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'),
  descripcion     text not null check (char_length(descripcion) between 1 and 1000),
  detalles        text not null check (char_length(detalles) between 1 and 2000),
  estado          public.estado_propuesta not null default 'pendiente',
  creada_en       timestamptz not null default now(),
  revisada_en     timestamptz,
  revisada_por    uuid,
  motivo_rechazo  text check (motivo_rechazo is null or char_length(motivo_rechazo) between 5 and 300),
  constraint propuestas_revision_coherente check (
    (estado = 'pendiente' and revisada_en is null and motivo_rechazo is null)
    or (estado = 'aprobada' and revisada_en is not null and motivo_rechazo is null)
    or (estado = 'rechazada' and revisada_en is not null and motivo_rechazo is not null)
  )
);

create index propuestas_pendientes_idx on public.propuestas_carta (creada_en) where estado = 'pendiente';
create index propuestas_carta_idx on public.propuestas_carta (carta_id);
create index propuestas_usuario_idx on public.propuestas_carta (usuario_id);

alter table public.propuestas_carta enable row level security;

-- Cada usuario ve sus propuestas (y el motivo si se rechazaron). La bandeja de
-- Administración pasa por listar_propuestas_pendientes.
create policy "cada usuario ve sus propuestas"
  on public.propuestas_carta for select to authenticated
  using ((select auth.uid()) = usuario_id and (select public.cuenta_habilitada()));

revoke all on public.propuestas_carta from anon, authenticated;
grant select on public.propuestas_carta to authenticated;


-- Dentro de las funciones: administrador con la cuenta habilitada.
create function privado.es_administrador(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = p_usuario and p.rol = 'administrador' and p.deshabilitada_en is null
  );
$$;

revoke execute on function privado.es_administrador(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4. Crear una propuesta (usuario)
-- ---------------------------------------------------------------------------

-- Errores propios (clase PB) para que lib/propuestas.ts los traduzca:
--   PB001  la carta ya tiene imagen
--   PB002  límite de propuestas pendientes
create function public.crear_propuesta(
  p_carta_id     bigint,
  p_imagen_path  text,
  p_descripcion  text,
  p_detalles     text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_llamante uuid := auth.uid();
  v_id       bigint;
begin
  if v_llamante is null or not public.cuenta_habilitada() then
    raise exception 'Se requiere una sesión iniciada con la cuenta habilitada'
      using errcode = 'insufficient_privilege';
  end if;

  -- Bloquea la carta: dos propuestas simultáneas ven el mismo estado.
  perform 1 from public.cartas where id = p_carta_id for update;
  if not found then
    raise exception 'La carta no existe'
      using errcode = 'no_data_found';
  end if;

  if exists (select 1 from public.cartas where id = p_carta_id and imagen_path is not null) then
    raise exception 'La carta ya tiene imagen'
      using errcode = 'PB001';
  end if;

  if (select count(*) from public.propuestas_carta
      where usuario_id = v_llamante and estado = 'pendiente') >= 5 then
    raise exception 'Ya tienes 5 propuestas pendientes'
      using errcode = 'PB002';
  end if;

  -- Los check de la tabla validan el nombre del archivo y el largo de los textos.
  insert into public.propuestas_carta (carta_id, usuario_id, imagen_path, descripcion, detalles)
  values (p_carta_id, v_llamante, p_imagen_path, trim(p_descripcion), trim(p_detalles))
  returning id into v_id;

  insert into public.auditoria (usuario_id, accion, tabla, registro_id, detalle)
  values (v_llamante, 'proponer_imagen', 'propuestas_carta', v_id::text,
          jsonb_build_object('carta_id', p_carta_id));

  return v_id;
end;
$$;


-- ---------------------------------------------------------------------------
-- 5. Revisar (administrador)
-- ---------------------------------------------------------------------------

create function public.listar_propuestas_pendientes()
returns table (
  id              bigint,
  carta_id        bigint,
  carta_nombre    text,
  carta_idioma    text,
  nombre_visible  text,
  imagen_path     text,
  descripcion     text,
  detalles        text,
  creada_en       timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.es_administrador(auth.uid()) then
    raise exception 'Solo un administrador puede revisar propuestas'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select pr.id, c.id, c.nombre, c.idioma, pe.nombre_visible,
           pr.imagen_path, pr.descripcion, pr.detalles, pr.creada_en
    from public.propuestas_carta pr
    join public.cartas c on c.id = pr.carta_id
    join public.perfiles pe on pe.id = pr.usuario_id
    where pr.estado = 'pendiente'
    order by pr.creada_en
    limit 100;
end;
$$;


-- Primer paso de la aprobación: autoriza y dice qué copiar y adónde. No
-- cambia nada; lib/propuestas.ts copia el archivo solo si esto responde, y
-- aprobar_propuesta vuelve a verificar todo con bloqueo.
create function public.preparar_aprobacion(p_propuesta_id bigint)
returns table (origen text, destino text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not privado.es_administrador(auth.uid()) then
    raise exception 'Solo un administrador puede revisar propuestas'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select pr.imagen_path, c.idioma || '/propuestas/' || pr.imagen_path
    from public.propuestas_carta pr
    join public.cartas c on c.id = pr.carta_id
    where pr.id = p_propuesta_id and pr.estado = 'pendiente' and c.imagen_path is null;

  if not found then
    raise exception 'La propuesta no está pendiente o la carta ya tiene imagen'
      using errcode = 'no_data_found';
  end if;
end;
$$;


-- Segundo paso: publica. Las demás propuestas pendientes de la misma carta se
-- rechazan solas. Devuelve a quién avisar y qué archivos de Propuestas sobran.
create function public.aprobar_propuesta(p_propuesta_id bigint)
returns table (usuario_id uuid, aprobada boolean, imagen_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_llamante uuid := auth.uid();
  v_prop     public.propuestas_carta%rowtype;
  v_idioma   text;
begin
  if not privado.es_administrador(v_llamante) then
    raise exception 'Solo un administrador puede revisar propuestas'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_prop from public.propuestas_carta where id = p_propuesta_id for update;
  if not found or v_prop.estado <> 'pendiente' then
    raise exception 'La propuesta no está pendiente'
      using errcode = 'no_data_found';
  end if;

  select c.idioma into v_idioma from public.cartas c
  where c.id = v_prop.carta_id and c.imagen_path is null
  for update;
  if not found then
    raise exception 'La carta ya tiene imagen'
      using errcode = 'PB001';
  end if;

  -- Las cartas no tienen privilegio de update para la API; esta función sí,
  -- como dueña. Solo cambia imagen_path, nunca los datos de la ingesta.
  update public.cartas
  set imagen_path = v_idioma || '/propuestas/' || v_prop.imagen_path
  where id = v_prop.carta_id;

  insert into public.cartas_detalle (carta_id, descripcion, detalles, aprobado_por)
  values (v_prop.carta_id, v_prop.descripcion, v_prop.detalles, v_llamante)
  on conflict (carta_id) do update set
    descripcion  = excluded.descripcion,
    detalles     = excluded.detalles,
    aprobado_por = excluded.aprobado_por,
    aprobado_en  = now();

  update public.propuestas_carta
  set estado = 'aprobada', revisada_en = now(), revisada_por = v_llamante
  where id = p_propuesta_id;

  insert into public.auditoria (usuario_id, accion, tabla, registro_id, detalle)
  values (v_llamante, 'aprobar_propuesta', 'propuestas_carta', p_propuesta_id::text,
          jsonb_build_object('carta_id', v_prop.carta_id));

  return query
    with rechazadas as (
      update public.propuestas_carta pr
      set estado = 'rechazada', revisada_en = now(), revisada_por = v_llamante,
          motivo_rechazo = 'La carta ya tiene imagen'
      where pr.carta_id = v_prop.carta_id and pr.estado = 'pendiente'
      returning pr.usuario_id, pr.imagen_path
    )
    select v_prop.usuario_id, true, v_prop.imagen_path
    union all
    select r.usuario_id, false, r.imagen_path from rechazadas r;
end;
$$;


create function public.rechazar_propuesta(p_propuesta_id bigint, p_motivo text)
returns table (usuario_id uuid, imagen_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_llamante uuid := auth.uid();
  v_motivo   text := trim(coalesce(p_motivo, ''));
begin
  if not privado.es_administrador(v_llamante) then
    raise exception 'Solo un administrador puede revisar propuestas'
      using errcode = 'insufficient_privilege';
  end if;

  if char_length(v_motivo) not between 5 and 300 then
    raise exception 'Parámetros no válidos'
      using errcode = 'invalid_parameter_value';
  end if;

  return query
    update public.propuestas_carta pr
    set estado = 'rechazada', revisada_en = now(), revisada_por = v_llamante, motivo_rechazo = v_motivo
    where pr.id = p_propuesta_id and pr.estado = 'pendiente'
    returning pr.usuario_id, pr.imagen_path;

  if not found then
    raise exception 'La propuesta no está pendiente'
      using errcode = 'no_data_found';
  end if;

  insert into public.auditoria (usuario_id, accion, tabla, registro_id, detalle)
  values (v_llamante, 'rechazar_propuesta', 'propuestas_carta', p_propuesta_id::text,
          jsonb_build_object('motivo', v_motivo));
end;
$$;


-- ---------------------------------------------------------------------------
-- 6. Privilegios
-- ---------------------------------------------------------------------------

revoke execute on function public.crear_propuesta(bigint, text, text, text) from public, anon;
revoke execute on function public.listar_propuestas_pendientes() from public, anon;
revoke execute on function public.preparar_aprobacion(bigint) from public, anon;
revoke execute on function public.aprobar_propuesta(bigint) from public, anon;
revoke execute on function public.rechazar_propuesta(bigint, text) from public, anon;

grant execute on function public.crear_propuesta(bigint, text, text, text) to authenticated;
grant execute on function public.listar_propuestas_pendientes() to authenticated;
grant execute on function public.preparar_aprobacion(bigint) to authenticated;
grant execute on function public.aprobar_propuesta(bigint) to authenticated;
grant execute on function public.rechazar_propuesta(bigint, text) to authenticated;
