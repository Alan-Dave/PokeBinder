-- Prueba de la migración 20261105140000_reportes_catalogo.sql.
-- Se ejecuta DENTRO de una transacción que termina en ROLLBACK: no deja datos.
-- Pegar completo en el SQL Editor de Supabase DESPUÉS de aplicar la migración.
-- Necesita al menos una carta y un perfil existentes; crea un usuario de prueba
-- falso dentro de la transacción (se revierte). Si un "assert" falla, para con el motivo.

begin;

do $$
declare
  v_carta bigint;
  v_a uuid := gen_random_uuid();   -- usuario normal de prueba
  v_b uuid := gen_random_uuid();   -- otro usuario normal de prueba
  v_admin uuid := gen_random_uuid();
  v_id bigint;
  v_n int;
begin
  select id into v_carta from public.cartas limit 1;
  assert v_carta is not null, 'no hay cartas para probar';

  -- Usuarios de prueba (se revierten con el rollback). El trigger de alta de
  -- perfil los crea como usuario_normal; el admin se promueve a mano.
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a-' || v_a || '@prueba.test', '{}', now(), now()),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b-' || v_b || '@prueba.test', '{}', now(), now()),
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c-' || v_admin || '@prueba.test', '{}', now(), now());
  update public.perfiles set rol = 'administrador' where id = v_admin;

  -- 1. Un usuario crea un reporte a su nombre.
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.reportes_catalogo (carta_id, motivo, detalle)
  values (v_carta, 'nombre', 'El nombre de la carta tiene una errata evidente')
  returning id into v_id;

  -- 2. No puede crearlo a nombre de otro.
  begin
    insert into public.reportes_catalogo (usuario_id, carta_id, motivo, detalle)
    values (v_b, v_carta, 'imagen', 'Reporte falso a nombre de otro usuario');
    raise exception 'FALLO: creó un reporte a nombre de otro usuario';
  exception when insufficient_privilege then null;
  end;

  -- 3. No puede crearlo ya resuelto.
  begin
    insert into public.reportes_catalogo (carta_id, motivo, detalle, estado)
    values (v_carta, 'rareza', 'Intento de crearlo ya marcado como resuelto', 'resuelto');
    raise exception 'FALLO: creó un reporte con estado resuelto';
  exception when insufficient_privilege then null;
  end;

  -- 4. No repite el mismo reporte abierto.
  begin
    insert into public.reportes_catalogo (carta_id, motivo, detalle)
    values (v_carta, 'nombre', 'Segundo reporte idéntico mientras el primero sigue abierto');
    raise exception 'FALLO: aceptó un reporte duplicado abierto';
  exception when unique_violation then null;
  end;

  -- 5. Validaciones de datos.
  begin
    insert into public.reportes_catalogo (carta_id, motivo, detalle)
    values (v_carta, 'inventado', 'Motivo que no existe en la lista permitida');
    raise exception 'FALLO: aceptó un motivo inválido';
  exception when check_violation then null;
  end;
  begin
    insert into public.reportes_catalogo (carta_id, motivo, detalle)
    values (v_carta, 'otro', 'corto');
    raise exception 'FALLO: aceptó un detalle demasiado corto';
  exception when check_violation then null;
  end;

  -- 6. Ve el suyo; no puede editarlo ni borrarlo.
  select count(*) into v_n from public.reportes_catalogo;
  assert v_n = 1, 'el usuario debería ver solo su reporte';
  -- La columna estado sí tiene permiso de tabla, así que aquí no hay error:
  -- RLS simplemente no deja ver la fila para actualizar (0 filas afectadas).
  update public.reportes_catalogo set estado = 'resuelto' where id = v_id;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'FALLO: el usuario cambió el estado de su reporte';
  begin
    delete from public.reportes_catalogo where id = v_id;
    raise exception 'FALLO: el usuario borró un reporte';
  exception when insufficient_privilege then null;
  end;

  -- 7. Otro usuario normal no ve el reporte ajeno.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from public.reportes_catalogo;
  assert v_n = 0, 'otro usuario normal no debería ver reportes ajenos';

  -- 8. El administrador ve todos y cambia el estado, pero solo el estado.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from public.reportes_catalogo;
  assert v_n = 1, 'el administrador debería ver el reporte';
  update public.reportes_catalogo set estado = 'resuelto' where id = v_id;
  get diagnostics v_n = row_count;
  assert v_n = 1, 'el administrador debería poder cambiar el estado';
  begin
    update public.reportes_catalogo set detalle = 'Texto reescrito por un administrador' where id = v_id;
    raise exception 'FALLO: el administrador reescribió el detalle';
  exception when insufficient_privilege then null;
  end;

  -- 9. El cliente anónimo no accede.
  reset role;
  set local role anon;
  begin
    perform 1 from public.reportes_catalogo limit 1;
    raise exception 'FALLO: el cliente anónimo pudo leer';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 10. Tope diario: tras 20 reportes en 24 h el siguiente se rechaza.
  insert into public.reportes_catalogo (usuario_id, carta_id, motivo, detalle, estado)
  select v_b, v_carta, 'otro', 'Reporte de relleno número ' || g, 'descartado'
  from generate_series(1, 20) g;
  begin
    insert into public.reportes_catalogo (usuario_id, carta_id, motivo, detalle)
    values (v_b, v_carta, 'imagen', 'Este reporte pasa del máximo diario permitido');
    raise exception 'FALLO: superó el máximo de reportes por día';
  exception when check_violation then null;
  end;

  raise notice 'OK: reportes_catalogo se comporta como se espera';
end;
$$;

-- Nada de lo anterior se conserva.
rollback;
