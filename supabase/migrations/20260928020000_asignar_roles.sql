-- Asignación de roles desde la aplicación.
--
-- Reglas (tarea "definir los permisos de cada rol"):
--   * Solo un superusuario asigna roles, y puede asignar cualquiera.
--   * Nadie cambia su propio rol.
--   * El sistema nunca queda sin superusuario.
--
-- El rol se verifica aquí, en la base, y no solo en Next.js: estas funciones
-- se pueden llamar directo por la Data API con la sesión del usuario, así que
-- el control tiene que vivir donde nadie puede saltárselo.
--
-- Son security definer porque la columna rol no es editable por authenticated
-- (ver perfiles_mazos_auditoria). auth.uid() sigue devolviendo a quien llama,
-- así que el trigger de auditoría registra al superusuario que hizo el cambio.


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

  -- Bloquea ambos perfiles siempre en el mismo orden. Si dos superusuarios se
  -- quitan el rol entre sí al mismo tiempo, el segundo espera al primero y
  -- luego lee su rol ya actualizado, en vez de dejar el sistema sin ninguno.
  perform 1 from public.perfiles
  where id in (v_llamante, p_usuario_id)
  order by id
  for update;

  select rol into v_rol_propio from public.perfiles where id = v_llamante;
  if v_rol_propio is distinct from 'superusuario' then
    raise exception 'Solo un superusuario puede asignar roles'
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
  if v_rol_actual = 'superusuario' and p_rol <> 'superusuario'
     and (select count(*) from public.perfiles where rol = 'superusuario') <= 1 then
    raise exception 'El sistema debe conservar al menos un superusuario'
      using errcode = 'check_violation';
  end if;

  update public.perfiles set rol = p_rol where id = p_usuario_id;
end;
$$;


-- La política de perfiles solo deja ver el propio. Para asignar roles, el
-- superusuario necesita la lista completa.
create function public.listar_perfiles()
returns table (id uuid, nombre_visible text, rol public.rol_usuario, creado_en timestamptz)
language plpgsql
stable
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

  return query
    select p.id, p.nombre_visible, p.rol, p.creado_en
    from public.perfiles p
    order by p.creado_en;
end;
$$;


-- Postgres otorga execute a public por defecto. Solo usuarios con sesión.
revoke execute on function public.asignar_rol(uuid, public.rol_usuario) from public, anon;
revoke execute on function public.listar_perfiles() from public, anon;
grant execute on function public.asignar_rol(uuid, public.rol_usuario) to authenticated;
grant execute on function public.listar_perfiles() to authenticated;
