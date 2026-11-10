-- Habilitar y deshabilitar cuentas desde Administración.
--
-- Una cuenta deshabilitada no puede iniciar sesión ni seguir usando una sesión
-- abierta. Se controla en dos lugares porque cada uno cubre un hueco del otro:
--   * Supabase Auth (ban_duration, lo aplica lib/cuentas.ts con la clave
--     secreta): impide iniciar sesión y renovar el token.
--   * Esta migración: el token ya emitido sigue siendo válido hasta que vence,
--     así que las políticas RLS consultan cuenta_habilitada() y cortan el
--     acceso a la colección y los mazos en cuanto se deshabilita.
--
-- El cambio de estado lo autoriza cambiar_estado_cuenta, aquí en la base, con
-- la sesión de quien llama: lib/cuentas.ts solo toca Supabase Auth después de
-- que esta función aceptó al administrador.


-- ---------------------------------------------------------------------------
-- 1. Estado de la cuenta
-- ---------------------------------------------------------------------------

alter table public.perfiles
  add column deshabilitada_en  timestamptz,
  -- Sin clave foránea: si se borra el administrador, el dato histórico queda.
  add column deshabilitada_por uuid,
  add column motivo_deshabilitacion text
    check (motivo_deshabilitacion is null or char_length(motivo_deshabilitacion) between 5 and 300),
  -- Los tres datos van juntos: deshabilitada con motivo, o habilitada sin nada.
  add constraint perfiles_estado_coherente check (
    (deshabilitada_en is null and deshabilitada_por is null and motivo_deshabilitacion is null)
    or (deshabilitada_en is not null and motivo_deshabilitacion is not null)
  );

-- Las columnas nuevas no entran en grant update (nombre_visible) de
-- perfiles_mazos_auditoria: nadie puede rehabilitar su propia cuenta.


-- Usada dentro de las políticas RLS. security definer para leer el perfil sin
-- depender de la política de perfiles; stable para que Postgres la evalúe una
-- vez por consulta cuando se escribe (select public.cuenta_habilitada()).
create function public.cuenta_habilitada()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.deshabilitada_en is null
  );
$$;

revoke execute on function public.cuenta_habilitada() from public, anon;
grant execute on function public.cuenta_habilitada() to authenticated;


-- ---------------------------------------------------------------------------
-- 2. Políticas: una cuenta deshabilitada no lee ni escribe sus datos
-- ---------------------------------------------------------------------------

-- El perfil propio se sigue pudiendo leer: la aplicación necesita saber que la
-- cuenta está deshabilitada para mostrarlo. Editarlo, no.
drop policy "cada usuario edita su perfil" on public.perfiles;
create policy "cada usuario edita su perfil"
  on public.perfiles for update to authenticated
  using ((select auth.uid()) = id and (select public.cuenta_habilitada()))
  with check ((select auth.uid()) = id and (select public.cuenta_habilitada()));

drop policy "cada usuario gestiona su inventario" on public.inventario;
create policy "cada usuario gestiona su inventario"
  on public.inventario for all to authenticated
  using ((select auth.uid()) = usuario_id and (select public.cuenta_habilitada()))
  with check ((select auth.uid()) = usuario_id and (select public.cuenta_habilitada()));

drop policy "cada usuario gestiona sus mazos" on public.mazos;
create policy "cada usuario gestiona sus mazos"
  on public.mazos for all to authenticated
  using ((select auth.uid()) = usuario_id and (select public.cuenta_habilitada()))
  with check ((select auth.uid()) = usuario_id and (select public.cuenta_habilitada()));

drop policy "cada usuario gestiona las cartas de sus mazos" on public.mazo_cartas;
create policy "cada usuario gestiona las cartas de sus mazos"
  on public.mazo_cartas for all to authenticated
  using ((select public.cuenta_habilitada()) and exists (
    select 1 from public.mazos m
    where m.id = mazo_id and m.usuario_id = (select auth.uid())
  ))
  with check ((select public.cuenta_habilitada()) and exists (
    select 1 from public.mazos m
    where m.id = mazo_id and m.usuario_id = (select auth.uid())
  ));


-- Tablas de datos de usuario que llegaron después (binders, categorías y
-- reportes del catálogo): las mismas políticas que en su migración, más la
-- cuenta habilitada. precios_historial no se toca: son datos públicos del
-- mercado, no de la persona.

drop policy "cada usuario gestiona sus binders" on public.binders;
create policy "cada usuario gestiona sus binders"
  on public.binders for all to authenticated
  using ((select auth.uid()) = usuario_id and (select public.cuenta_habilitada()))
  with check ((select auth.uid()) = usuario_id and (select public.cuenta_habilitada()));

drop policy "cada usuario gestiona las casillas de sus binders" on public.binder_casillas;
create policy "cada usuario gestiona las casillas de sus binders"
  on public.binder_casillas for all to authenticated
  using ((select public.cuenta_habilitada()) and exists (
    select 1 from public.binders b
    where b.id = binder_id and b.usuario_id = (select auth.uid())
  ))
  with check (
    (select public.cuenta_habilitada())
    and exists (
      select 1 from public.binders b
      where b.id = binder_id and b.usuario_id = (select auth.uid())
    )
    and exists (
      select 1 from public.inventario i
      where i.id = inventario_id and i.usuario_id = (select auth.uid())
    )
  );

drop policy "cada usuario gestiona sus categorías" on public.categorias_coleccion;
create policy "cada usuario gestiona sus categorías"
  on public.categorias_coleccion for all to authenticated
  using ((select auth.uid()) = usuario_id and (select public.cuenta_habilitada()))
  with check ((select auth.uid()) = usuario_id and (select public.cuenta_habilitada()));

drop policy "cada usuario gestiona las cartas de sus categorías" on public.categoria_cartas;
create policy "cada usuario gestiona las cartas de sus categorías"
  on public.categoria_cartas for all to authenticated
  using ((select public.cuenta_habilitada()) and exists (
    select 1 from public.categorias_coleccion c
    where c.id = categoria_id and c.usuario_id = (select auth.uid())
  ))
  with check (
    (select public.cuenta_habilitada())
    and exists (
      select 1 from public.categorias_coleccion c
      where c.id = categoria_id and c.usuario_id = (select auth.uid())
    )
    and exists (
      select 1 from public.inventario i
      where i.id = inventario_id and i.usuario_id = (select auth.uid())
    )
  );

-- Reportes: crear y ver los propios exige la cuenta habilitada; revisarlos,
-- un administrador con la cuenta habilitada (como el resto de Administración).
drop policy "cada usuario crea reportes a su nombre" on public.reportes_catalogo;
create policy "cada usuario crea reportes a su nombre"
  on public.reportes_catalogo for insert to authenticated
  with check ((select auth.uid()) = usuario_id and estado = 'abierto' and (select public.cuenta_habilitada()));

drop policy "cada usuario ve sus reportes y los administradores todos" on public.reportes_catalogo;
create policy "cada usuario ve sus reportes y los administradores todos"
  on public.reportes_catalogo for select to authenticated
  using (
    (select public.cuenta_habilitada())
    and (
      (select auth.uid()) = usuario_id
      or exists (
        select 1 from public.perfiles p
        where p.id = (select auth.uid()) and p.rol = 'administrador'
      )
    )
  );

drop policy "los administradores gestionan el estado de los reportes" on public.reportes_catalogo;
create policy "los administradores gestionan el estado de los reportes"
  on public.reportes_catalogo for update to authenticated
  using ((select public.cuenta_habilitada()) and exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.rol = 'administrador'
  ))
  with check ((select public.cuenta_habilitada()) and exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.rol = 'administrador'
  ));


-- ---------------------------------------------------------------------------
-- 3. Cambiar el estado de una cuenta
-- ---------------------------------------------------------------------------

-- Reglas:
--   * Solo un administrador habilitado cambia el estado de una cuenta.
--   * Nadie cambia el estado de su propia cuenta.
--   * El sistema nunca queda sin un administrador habilitado.
--   * El motivo es obligatorio y queda en la bitácora.
--
-- Devuelve true si el estado cambió y false si la cuenta ya estaba así. Con
-- false, lib/cuentas.ts sabe que no debe revertir nada si falla Supabase Auth.
create function public.cambiar_estado_cuenta(
  p_usuario_id uuid,
  p_habilitar  boolean,
  p_motivo     text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_llamante uuid := auth.uid();
  v_motivo   text := trim(coalesce(p_motivo, ''));
  v_objetivo public.perfiles%rowtype;
begin
  if v_llamante is null then
    raise exception 'Se requiere una sesión iniciada'
      using errcode = 'insufficient_privilege';
  end if;

  if p_usuario_id = v_llamante then
    raise exception 'No puedes cambiar el estado de tu propia cuenta'
      using errcode = 'insufficient_privilege';
  end if;

  if p_habilitar is null or char_length(v_motivo) not between 5 and 300 then
    raise exception 'Parámetros no válidos'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Mismo orden de bloqueo que asignar_rol: dos administradores que se
  -- deshabilitan entre sí al mismo tiempo no dejan el sistema sin ninguno.
  perform 1 from public.perfiles
  where id in (v_llamante, p_usuario_id)
  order by id
  for update;

  if not exists (
    select 1 from public.perfiles p
    where p.id = v_llamante and p.rol = 'administrador' and p.deshabilitada_en is null
  ) then
    raise exception 'Solo un administrador puede cambiar el estado de una cuenta'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_objetivo from public.perfiles where id = p_usuario_id;
  if not found then
    raise exception 'El usuario no existe'
      using errcode = 'no_data_found';
  end if;

  if (v_objetivo.deshabilitada_en is null) = p_habilitar then
    return false;
  end if;

  -- Con la regla de la propia cuenta siempre queda quien llama, pero se
  -- verifica igual, como en asignar_rol.
  if not p_habilitar and v_objetivo.rol = 'administrador'
     and (select count(*) from public.perfiles
          where rol = 'administrador' and deshabilitada_en is null) <= 1 then
    raise exception 'El sistema debe conservar al menos un administrador habilitado'
      using errcode = 'check_violation';
  end if;

  if p_habilitar then
    update public.perfiles
    set deshabilitada_en = null, deshabilitada_por = null, motivo_deshabilitacion = null
    where id = p_usuario_id;
  else
    update public.perfiles
    set deshabilitada_en = now(), deshabilitada_por = v_llamante, motivo_deshabilitacion = v_motivo
    where id = p_usuario_id;
  end if;

  insert into public.auditoria (usuario_id, accion, tabla, registro_id, detalle)
  values (
    v_llamante,
    case when p_habilitar then 'habilitar_cuenta' else 'deshabilitar_cuenta' end,
    'perfiles',
    p_usuario_id::text,
    jsonb_build_object('motivo', v_motivo)
  );

  return true;
end;
$$;

revoke execute on function public.cambiar_estado_cuenta(uuid, boolean, text) from public, anon;
grant execute on function public.cambiar_estado_cuenta(uuid, boolean, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 4. Un administrador deshabilitado pierde Administración
-- ---------------------------------------------------------------------------

-- Las tres funciones de 20261110120000_dos_perfiles exigían solo el rol. Ahora
-- además la cuenta habilitada, y la regla de "al menos un administrador"
-- cuenta solo a los habilitados.

create or replace function public.asignar_rol(p_usuario_id uuid, p_rol public.rol_usuario)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_llamante   uuid := auth.uid();
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

  perform 1 from public.perfiles
  where id in (v_llamante, p_usuario_id)
  order by id
  for update;

  if not exists (
    select 1 from public.perfiles p
    where p.id = v_llamante and p.rol = 'administrador' and p.deshabilitada_en is null
  ) then
    raise exception 'Solo un administrador puede asignar roles'
      using errcode = 'insufficient_privilege';
  end if;

  select rol into v_rol_actual from public.perfiles where id = p_usuario_id;
  if not found then
    raise exception 'El usuario no existe'
      using errcode = 'no_data_found';
  end if;

  if v_rol_actual = 'administrador' and p_rol <> 'administrador'
     and (select count(*) from public.perfiles
          where rol = 'administrador' and deshabilitada_en is null) <= 1 then
    raise exception 'El sistema debe conservar al menos un administrador'
      using errcode = 'check_violation';
  end if;

  update public.perfiles set rol = p_rol where id = p_usuario_id;
end;
$$;


-- Cambia el tipo de retorno (agrega el estado de la cuenta), así que se borra
-- y se recrea; drop se lleva los privilegios y se vuelven a dar al final.
drop function public.listar_perfiles();

create function public.listar_perfiles()
returns table (
  id                     uuid,
  nombre_visible         text,
  rol                    public.rol_usuario,
  creado_en              timestamptz,
  deshabilitada_en       timestamptz,
  motivo_deshabilitacion text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.rol = 'administrador' and p.deshabilitada_en is null
  ) then
    raise exception 'Solo un administrador puede listar los perfiles'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.auditoria (usuario_id, accion, tabla)
  values (auth.uid(), 'listar_perfiles', 'perfiles');

  return query
    select p.id, p.nombre_visible, p.rol, p.creado_en, p.deshabilitada_en, p.motivo_deshabilitacion
    from public.perfiles p
    order by p.creado_en;
end;
$$;

revoke execute on function public.listar_perfiles() from public, anon;
grant execute on function public.listar_perfiles() to authenticated;


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
    where p.id = (select auth.uid()) and p.rol = 'administrador' and p.deshabilitada_en is null
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
