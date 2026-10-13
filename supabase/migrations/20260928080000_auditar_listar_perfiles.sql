-- Deja rastro del acceso masivo a datos personales (Ley 21.719, trazabilidad).
--
-- listar_perfiles devuelve el correo... en realidad no, pero sí nombre_visible
-- y rol de TODOS los usuarios en una sola llamada: es el único punto del
-- sistema donde alguien ve datos personales ajenos en bloque, no fila por
-- fila como el resto de las políticas RLS. Merece su propio registro, igual
-- que un cambio de rol.
--
-- create or replace conserva los privilegios (grant/revoke) ya aplicados en
-- 20260928020000_asignar_roles.sql: no hace falta repetirlos.

create or replace function public.listar_perfiles()
returns table (id uuid, nombre_visible text, rol public.rol_usuario, creado_en timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.rol = 'superusuario'
  ) then
    raise exception 'Solo un superusuario puede listar los perfiles'
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
