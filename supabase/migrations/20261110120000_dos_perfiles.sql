-- Dos perfiles: Administración y Usuario.
--
-- Hasta ahora el enum tenía tres valores, pero solo 'superusuario' autorizaba
-- algo: 'administrador' no habilitaba ninguna función. Quedan dos:
--   * administrador: asigna roles, lista perfiles y lee la bitácora.
--   * usuario: catálogo, colección y mazos.
--
-- Conversión de los perfiles existentes:
--   superusuario   -> administrador
--   administrador  -> administrador  (conservan Administración)
--   usuario_normal -> usuario
--
-- PostgreSQL no permite quitar valores de un enum, así que el tipo se
-- reemplaza: se crea uno nuevo, se convierte la columna y se borra el viejo.
-- Todo lo que depende del tipo o de la columna se recrea en este archivo:
-- asignar_rol, listar_perfiles, el trigger que audita los cambios de rol y
-- las políticas de reportes_catalogo (20261105140000), que comparan el rol
-- con 'superusuario'.
-- listar_auditoria no usa el tipo, solo compara el valor; se reemplaza con
-- create or replace y conserva sus privilegios.
--
-- La bitácora conserva los nombres viejos en los registros anteriores a esta
-- migración ('superusuario', 'usuario_normal' en detalle->antes/despues): es
-- historia y no se reescribe (la tabla es de solo inserción).


-- ---------------------------------------------------------------------------
-- 1. Soltar lo que depende del tipo viejo
-- ---------------------------------------------------------------------------

-- La columna rol no puede cambiar de tipo mientras un trigger la nombre.
drop trigger perfiles_audita_rol on public.perfiles;

-- Sus firmas usan public.rol_usuario. Se recrean más abajo.
drop function public.asignar_rol(uuid, public.rol_usuario);
drop function public.listar_perfiles();

-- Una columna no puede cambiar de tipo mientras una política la nombre.
drop policy "cada usuario ve sus reportes y los administradores todos" on public.reportes_catalogo;
drop policy "los administradores gestionan el estado de los reportes" on public.reportes_catalogo;


-- ---------------------------------------------------------------------------
-- 2. Reemplazar el tipo y convertir los perfiles
-- ---------------------------------------------------------------------------

create type public.rol_usuario_v2 as enum ('administrador', 'usuario');

alter table public.perfiles alter column rol drop default;

alter table public.perfiles
  alter column rol type public.rol_usuario_v2
  using (
    case rol::text
      when 'usuario_normal' then 'usuario'
      else 'administrador'
    end
  )::public.rol_usuario_v2;

-- El trigger crear_perfil no indica el rol: todo registro nuevo toma este
-- valor, nunca uno enviado por el cliente.
alter table public.perfiles alter column rol set default 'usuario';

drop type public.rol_usuario;
alter type public.rol_usuario_v2 rename to rol_usuario;

-- El trigger de auditoría está suelto durante la conversión, así que la
-- migración deja su propio registro en vez de una fila por perfil.
insert into public.auditoria (usuario_id, accion, tabla, detalle)
values (
  null,
  'migracion_roles',
  'perfiles',
  jsonb_build_object(
    'superusuario', 'administrador',
    'administrador', 'administrador',
    'usuario_normal', 'usuario',
    'administradores', (select count(*) from public.perfiles where rol = 'administrador'),
    'usuarios', (select count(*) from public.perfiles where rol = 'usuario')
  )
);


-- ---------------------------------------------------------------------------
-- 3. Trigger de auditoría de cambios de rol
-- ---------------------------------------------------------------------------

-- La función privado.auditar_cambio_rol no depende del tipo y sigue igual.
create trigger perfiles_audita_rol
  after update of rol on public.perfiles
  for each row
  when (old.rol is distinct from new.rol)
  execute function privado.auditar_cambio_rol();


-- ---------------------------------------------------------------------------
-- 3b. Políticas de reportes_catalogo, ahora solo con administrador
-- ---------------------------------------------------------------------------

-- Mismo texto que en 20261105140000_reportes_catalogo, sin 'superusuario'.
create policy "cada usuario ve sus reportes y los administradores todos"
  on public.reportes_catalogo for select to authenticated
  using (
    (select auth.uid()) = usuario_id
    or exists (
      select 1 from public.perfiles p
      where p.id = (select auth.uid()) and p.rol = 'administrador'
    )
  );

create policy "los administradores gestionan el estado de los reportes"
  on public.reportes_catalogo for update to authenticated
  using (exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.rol = 'administrador'
  ))
  with check (exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.rol = 'administrador'
  ));


-- ---------------------------------------------------------------------------
-- 4. Funciones con control de rol
-- ---------------------------------------------------------------------------

-- Reglas:
--   * Solo un administrador asigna roles.
--   * Nadie cambia su propio rol.
--   * El sistema nunca queda sin administrador.
create function public.asignar_rol(p_usuario_id uuid, p_rol public.rol_usuario)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_llamante   uuid := auth.uid();
  v_rol_propio public.rol_usuario;
  v_rol_actual public.rol_usuario;
begin
  if v_llamante is null then
    raise exception 'Se requiere una sesión iniciada'
      using errcode = 'insufficient_privilege';
  end if;

  if p_usuario_id = v_llamante then
    raise exception 'No puedes cambiar tu propio rol'
      using errcode = 'insufficient_privilege';
  end if;

  -- Bloquea ambos perfiles siempre en el mismo orden. Si dos administradores
  -- se quitan el rol entre sí al mismo tiempo, el segundo espera al primero y
  -- luego lee su rol ya actualizado, en vez de dejar el sistema sin ninguno.
  perform 1 from public.perfiles
  where id in (v_llamante, p_usuario_id)
  order by id
  for update;

  select rol into v_rol_propio from public.perfiles where id = v_llamante;
  if v_rol_propio is distinct from 'administrador' then
    raise exception 'Solo un administrador puede asignar roles'
      using errcode = 'insufficient_privilege';
  end if;

  select rol into v_rol_actual from public.perfiles where id = p_usuario_id;
  if not found then
    raise exception 'El usuario no existe'
      using errcode = 'no_data_found';
  end if;

  -- Con la regla anterior siempre queda al menos quien llama, pero se
  -- verifica igual: si algún día se permite cambiar el propio rol, esta
  -- regla no debe depender de otra.
  if v_rol_actual = 'administrador' and p_rol <> 'administrador'
     and (select count(*) from public.perfiles where rol = 'administrador') <= 1 then
    raise exception 'El sistema debe conservar al menos un administrador'
      using errcode = 'check_violation';
  end if;

  update public.perfiles set rol = p_rol where id = p_usuario_id;
end;
$$;


-- Igual que antes (auditar_listar_perfiles): deja rastro de cada lectura
-- masiva de perfiles.
create function public.listar_perfiles()
returns table (id uuid, nombre_visible text, rol public.rol_usuario, creado_en timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.rol = 'administrador'
  ) then
    raise exception 'Solo un administrador puede listar los perfiles'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.auditoria (usuario_id, accion, tabla)
  values (auth.uid(), 'listar_perfiles', 'perfiles');

  return query
    select p.id, p.nombre_visible, p.rol, p.creado_en
    from public.perfiles p
    order by p.creado_en;
end;
$$;


create or replace function public.listar_auditoria(
  p_pagina  integer,
  p_tamano  integer,
  p_accion  text default null
)
returns table (
  id             bigint,
  ocurrido_en    timestamptz,
  usuario_id     uuid,
  nombre_visible text,
  accion         text,
  tabla          text,
  registro_id    text,
  detalle        jsonb,
  total          bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.rol = 'administrador'
  ) then
    raise exception 'Solo un administrador puede leer la bitácora'
      using errcode = 'insufficient_privilege';
  end if;

  if p_pagina is null or p_pagina < 1
     or p_tamano is null or p_tamano < 1 or p_tamano > 100 then
    raise exception 'Parámetros de paginación no válidos'
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.auditoria (usuario_id, accion, tabla, detalle)
  values (
    auth.uid(),
    'listar_auditoria',
    'auditoria',
    jsonb_build_object('pagina', p_pagina, 'accion', p_accion)
  );

  -- El filtro viaja como parámetro, nunca concatenado en el texto de la consulta.
  return query
    select a.id, a.ocurrido_en, a.usuario_id, p.nombre_visible,
           a.accion, a.tabla, a.registro_id, a.detalle,
           count(*) over () as total
    from public.auditoria a
    left join public.perfiles p on p.id = a.usuario_id
    where p_accion is null or a.accion = p_accion
    order by a.id desc
    limit p_tamano
    offset (p_pagina - 1) * p_tamano;
end;
$$;


-- ---------------------------------------------------------------------------
-- 5. Privilegios
-- ---------------------------------------------------------------------------

-- drop function se llevó los privilegios de las funciones recreadas.
-- Postgres otorga execute a public por defecto. Solo usuarios con sesión.
revoke execute on function public.asignar_rol(uuid, public.rol_usuario) from public, anon;
revoke execute on function public.listar_perfiles() from public, anon;
grant execute on function public.asignar_rol(uuid, public.rol_usuario) to authenticated;
grant execute on function public.listar_perfiles() to authenticated;
