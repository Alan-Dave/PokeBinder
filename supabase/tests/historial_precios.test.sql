-- Prueba de la migración 20261105120000_historial_precios.sql.
-- Se ejecuta DENTRO de una transacción que termina en ROLLBACK: no deja datos.
-- Pegar completo en el SQL Editor de Supabase DESPUÉS de aplicar la migración.
-- Cada bloque debe terminar sin error; si un "assert" falla, para con el motivo.

begin;

-- Una carta y un usuario cualquiera ya existentes (solo lectura de ids).
do $$
declare
  v_carta bigint;
  v_usuario uuid;
  v_n int;
begin
  select id into v_carta from public.cartas limit 1;
  select id into v_usuario from public.perfiles limit 1;
  assert v_carta is not null, 'no hay cartas para probar';
  assert v_usuario is not null, 'no hay perfiles para probar';

  -- 1. El propietario de la tabla (rol de este editor) puede insertar:
  --    es lo que hace service_role desde el servidor.
  insert into public.precios_historial (carta_id, acabado, fecha, mercado)
  values (v_carta, 'normal', current_date, 1.25);

  -- 2. Un usuario autenticado puede LEER.
  perform set_config('request.jwt.claims', json_build_object('sub', v_usuario, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from public.precios_historial where carta_id = v_carta;
  assert v_n = 1, 'el usuario autenticado debería leer el precio';

  -- 3. Un usuario autenticado NO puede insertar, ni actualizar, ni borrar.
  begin
    insert into public.precios_historial (carta_id, acabado, fecha, mercado)
    values (v_carta, 'holofoil', current_date, 999);
    raise exception 'FALLO: un usuario pudo insertar un precio';
  exception when insufficient_privilege then
    null; -- esperado
  end;

  begin
    update public.precios_historial set mercado = 0 where carta_id = v_carta;
    raise exception 'FALLO: un usuario pudo actualizar un precio';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.precios_historial where carta_id = v_carta;
    raise exception 'FALLO: un usuario pudo borrar un precio';
  exception when insufficient_privilege then
    null;
  end;

  -- 4. El cliente anónimo no ve nada.
  reset role;
  set local role anon;
  begin
    perform 1 from public.precios_historial limit 1;
    raise exception 'FALLO: el cliente anónimo pudo leer';
  exception when insufficient_privilege then
    null;
  end;

  reset role;

  -- 5. Las restricciones de la tabla rechazan datos inválidos.
  begin
    insert into public.precios_historial (carta_id, acabado, fecha, mercado)
    values (v_carta, 'normal', current_date - 1, -1);
    raise exception 'FALLO: aceptó un precio negativo';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.precios_historial (carta_id, acabado, fecha, mercado)
    values (v_carta, 'normal', current_date, 2);
    raise exception 'FALLO: aceptó un precio repetido el mismo día';
  exception when unique_violation then
    null;
  end;

  raise notice 'OK: historial_precios se comporta como se espera';
end;
$$;

-- Nada de lo anterior se conserva.
rollback;
