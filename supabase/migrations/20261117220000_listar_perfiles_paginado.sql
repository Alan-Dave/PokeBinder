-- Paginación de la lista de usuarios en la base (PBI-X35).
--
-- Hasta ahora listar_perfiles() devolvía a TODOS los usuarios en una sola
-- llamada y la aplicación cortaba la lista. Esta versión recibe página y
-- tamaño, y la base entrega solo esa porción: la pantalla de administración
-- ya no recibe más datos personales de los que muestra. Es el mismo patrón de
-- listar_auditoria.
--
-- Es una sobrecarga: la función sin parámetros (listar_perfiles()) se deja
-- como está para que la aplicación anterior siga funcionando mientras se
-- despliega la nueva. Cuando la nueva versión esté en producción se puede
-- retirar con: drop function public.listar_perfiles();
--
-- El rol se verifica aquí, en la base, y cada lectura deja rastro en la
-- bitácora, igual que la función sin parámetros. Por eso es volatile.

create function public.listar_perfiles(
  p_pagina integer,
  p_tamano integer
)
returns table (
  id             uuid,
  nombre_visible text,
  rol            public.rol_usuario,
  creado_en      timestamptz,
  total          bigint
)
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

  if p_pagina is null or p_pagina < 1
     or p_tamano is null or p_tamano < 1 or p_tamano > 100 then
    raise exception 'Parámetros de paginación no válidos'
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.auditoria (usuario_id, accion, tabla, detalle)
  values (
    auth.uid(),
    'listar_perfiles',
    'perfiles',
    jsonb_build_object('pagina', p_pagina)
  );

  -- Los parámetros viajan como valores, nunca concatenados en la consulta.
  return query
    select p.id, p.nombre_visible, p.rol, p.creado_en,
           count(*) over () as total
    from public.perfiles p
    order by p.creado_en, p.id
    limit p_tamano
    offset (p_pagina - 1) * p_tamano;
end;
$$;

revoke execute on function public.listar_perfiles(integer, integer) from public, anon;
grant execute on function public.listar_perfiles(integer, integer) to authenticated;
