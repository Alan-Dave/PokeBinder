-- Prueba de la migración 20261108120000_categorias_coleccion.sql.
-- Se ejecuta DENTRO de una transacción que termina en ROLLBACK: no deja datos.
-- Pegar completo en el SQL Editor de Supabase DESPUÉS de aplicar la migración.
-- Necesita al menos una carta con variantes; crea usuarios de prueba falsos
-- dentro de la transacción (se revierten). Si un "assert" falla, para con el motivo.

begin;

do $$
declare
  v_carta bigint;
  v_variante text;
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_inv_a bigint;
  v_inv_b bigint;
  v_cat_a bigint;
  v_cat_b bigint;
  v_n int;
begin
  select id, variantes_disponibles[1] into v_carta, v_variante
  from public.cartas
  where array_length(variantes_disponibles, 1) >= 1
  limit 1;
  assert v_carta is not null, 'no hay cartas para probar';

  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a-' || v_a || '@prueba.test', '{}', now(), now()),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b-' || v_b || '@prueba.test', '{}', now(), now());

  -- Una fila de inventario para cada usuario (se crean como dueño de la base).
  insert into public.inventario (usuario_id, carta_id, variante, cantidad)
  values (v_a, v_carta, v_variante, 1) returning id into v_inv_a;
  insert into public.inventario (usuario_id, carta_id, variante, cantidad)
  values (v_b, v_carta, v_variante, 1) returning id into v_inv_b;

  -- 1. El usuario A crea una categoría y le asigna su carta.
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.categorias_coleccion (nombre) values ('Mis Sylveon') returning id into v_cat_a;
  insert into public.categoria_cartas (categoria_id, inventario_id) values (v_cat_a, v_inv_a);

  -- 2. No puede crear una categoría a nombre de otro.
  begin
    insert into public.categorias_coleccion (usuario_id, nombre) values (v_b, 'Falsa');
    raise exception 'FALLO: creó una categoría a nombre de otro usuario';
  exception when insufficient_privilege then null;
  end;

  -- 3. No repite el nombre, ni cambiando mayúsculas.
  begin
    insert into public.categorias_coleccion (nombre) values ('MIS SYLVEON');
    raise exception 'FALLO: aceptó un nombre repetido';
  exception when unique_violation then null;
  end;

  -- 4. Validaciones de datos.
  begin
    insert into public.categorias_coleccion (nombre) values ('');
    raise exception 'FALLO: aceptó un nombre vacío';
  exception when check_violation then null;
  end;
  begin
    insert into public.categorias_coleccion (nombre) values (repeat('x', 61));
    raise exception 'FALLO: aceptó un nombre de más de 60 caracteres';
  exception when check_violation then null;
  end;

  -- 5. Una carta puede estar en varias categorías, pero no dos veces en la misma.
  insert into public.categorias_coleccion (nombre) values ('Favoritas') returning id into v_cat_b;
  insert into public.categoria_cartas (categoria_id, inventario_id) values (v_cat_b, v_inv_a);
  begin
    insert into public.categoria_cartas (categoria_id, inventario_id) values (v_cat_b, v_inv_a);
    raise exception 'FALLO: aceptó la misma carta dos veces en una categoría';
  exception when unique_violation then null;
  end;

  -- 6. No puede meter en su categoría una carta del inventario de otro.
  begin
    insert into public.categoria_cartas (categoria_id, inventario_id) values (v_cat_a, v_inv_b);
    raise exception 'FALLO: puso en su categoría una carta ajena';
  exception when insufficient_privilege then null;
  end;

  -- 7. El usuario B no ve nada de A y no puede usar su categoría.
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into v_n from public.categorias_coleccion;
  assert v_n = 0, 'B no debería ver categorías de A';
  select count(*) into v_n from public.categoria_cartas;
  assert v_n = 0, 'B no debería ver las cartas de las categorías de A';
  begin
    insert into public.categoria_cartas (categoria_id, inventario_id) values (v_cat_a, v_inv_b);
    raise exception 'FALLO: B usó la categoría de A';
  exception when insufficient_privilege then null;
  end;
  update public.categorias_coleccion set nombre = 'Robada' where id = v_cat_a;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'FALLO: B renombró la categoría de A';
  delete from public.categorias_coleccion where id = v_cat_a;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'FALLO: B borró la categoría de A';

  -- 8. El cliente anónimo no accede.
  reset role;
  set local role anon;
  begin
    perform 1 from public.categorias_coleccion limit 1;
    raise exception 'FALLO: el cliente anónimo pudo leer categorías';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.categoria_cartas limit 1;
    raise exception 'FALLO: el cliente anónimo pudo leer la pertenencia';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 9. Al quitar la carta del inventario sale de las categorías; al borrar la
  --    categoría no se toca el inventario.
  delete from public.inventario where id = v_inv_a;
  select count(*) into v_n from public.categoria_cartas where categoria_id in (v_cat_a, v_cat_b);
  assert v_n = 0, 'la carta debería salir de las categorías al salir del inventario';
  delete from public.categorias_coleccion where id = v_cat_b;
  select count(*) into v_n from public.inventario where id = v_inv_b;
  assert v_n = 1, 'borrar una categoría no debe tocar el inventario';

  -- 10. Tope: con 100 categorías la siguiente se rechaza.
  insert into public.categorias_coleccion (usuario_id, nombre)
  select v_b, 'Relleno ' || g from generate_series(1, 100) g;
  begin
    insert into public.categorias_coleccion (usuario_id, nombre) values (v_b, 'Pasa del máximo');
    raise exception 'FALLO: superó el máximo de categorías';
  exception when check_violation then null;
  end;

  raise notice 'OK: las categorías de la colección se comportan como se espera';
end;
$$;

-- Nada de lo anterior se conserva.
rollback;
