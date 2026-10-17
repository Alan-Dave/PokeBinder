-- Lectura de la bitácora de auditoría para el superusuario (PBI-26).
--
-- public.auditoria no tiene políticas ni privilegios para la API (ver
-- perfiles_mazos_auditoria): ni leerla ni escribirla. Esta función es la única
-- puerta de lectura, y el rol se verifica aquí, en la base, no solo en Next.js.
--
-- No se agrega ninguna función de escritura: una función pública de "registrar
-- evento" dejaría a cualquier usuario con sesión llenar la bitácora de
-- entradas falsas. Los eventos los siguen escribiendo los triggers y las
-- funciones security definer, que registran lo que de verdad ocurrió.
--
-- Leer la bitácora también deja rastro, igual que listar_perfiles: quien
-- revisa los registros queda registrado. Por eso la función es volatile.

create function public.listar_auditoria(
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
    where p.id = (select auth.uid()) and p.rol = 'superusuario'
  ) then
    raise exception 'Solo un superusuario puede leer la bitácora'
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

revoke execute on function public.listar_auditoria(integer, integer, text) from public, anon;
grant execute on function public.listar_auditoria(integer, integer, text) to authenticated;
