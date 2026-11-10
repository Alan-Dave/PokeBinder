-- PBI-27 (AB#54): aislamiento entre dos usuarios normales a nivel de base de datos.
-- Se ejecuta DENTRO de una transacción que termina en ROLLBACK: no deja datos.
-- Pegar completo en el SQL Editor de Supabase. Necesita al menos una carta.
--
-- Crea dos usuarios falsos (A y B) y, actuando como cada uno (rol "authenticated"
-- con su uid, igual que la API), intenta leer, cambiar, borrar y crear datos del
-- otro. Un FALLO detiene la prueba con el motivo. Si termina sin error y muestra
-- "OK: aislamiento verificado", RLS cumple lo que exige la regla 3 del proyecto.
--
-- Una política RLS que no deja ver una fila no da error: la fila "no existe" para
-- ese usuario. Por eso lo que se mide es cuántas filas ve o cambia, no un mensaje.

begin;

do $$
declare
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_carta bigint;
  v_variante text;
  v_inv_a bigint;
  v_inv_b bigint;
  v_mazo_a bigint;
  v_mazo_b bigint;
  v_binder_a bigint;
  v_binder_b bigint;
  v_n int;
begin
  select id, variantes_disponibles[1] into v_carta, v_variante
  from public.cartas
  where array_length(variantes_disponibles, 1) >= 1
  limit 1;
  assert v_carta is not null, 'no hay cartas para probar';

  -- Los usuarios y sus perfiles (el trigger crea el perfil con rol usuario_normal).
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values
    (v_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a-' || v_a || '@prueba.test', '{"nombre_visible":"Usuario A"}', now(), now()),
    (v_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b-' || v_b || '@prueba.test', '{"nombre_visible":"Usuario B"}', now(), now());

  -- Datos de B, creados como dueño de la base. A no debe poder tocarlos.
  insert into public.inventario (usuario_id, carta_id, variante, cantidad) values (v_b, v_carta, v_variante, 3) returning id into v_inv_b;
  insert into public.mazos (usuario_id, nombre) values (v_b, 'Mazo de B') returning id into v_mazo_b;
  insert into public.mazo_cartas (mazo_id, carta_id, cantidad) values (v_mazo_b, v_carta, 2);
  insert into public.binders (usuario_id, nombre, filas, columnas) values (v_b, 'Binder de B', 3, 3) returning id into v_binder_b;
  insert into public.binder_casillas (binder_id, pagina, posicion, inventario_id) values (v_binder_b, 1, 0, v_inv_b);
  insert into public.reportes_catalogo (usuario_id, carta_id, motivo, detalle) values (v_b, v_carta, 'nombre', 'Reporte de B con detalle suficiente');

  -- Datos propios de A.
  insert into public.inventario (usuario_id, carta_id, variante, cantidad) values (v_a, v_carta, v_variante, 1) returning id into v_inv_a;
  insert into public.mazos (usuario_id, nombre) values (v_a, 'Mazo de A') returning id into v_mazo_a;
  insert into public.binders (usuario_id, nombre, filas, columnas) values (v_a, 'Binder de A', 3, 3) returning id into v_binder_a;

  -- ======================= Actúa el usuario A =======================
  perform set_config('request.jwt.claims', json_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. LECTURA: A solo ve lo suyo.
  select count(*) into v_n from public.inventario;
  assert v_n = 1, format('FALLO: A ve %s filas de inventario (debía ver 1)', v_n);
  select count(*) into v_n from public.mazos;
  assert v_n = 1, format('FALLO: A ve %s mazos (debía ver 1)', v_n);
  select count(*) into v_n from public.mazo_cartas;
  assert v_n = 0, format('FALLO: A ve %s cartas de mazos ajenos', v_n);
  select count(*) into v_n from public.binders;
  assert v_n = 1, format('FALLO: A ve %s binders (debía ver 1)', v_n);
  select count(*) into v_n from public.binder_casillas;
  assert v_n = 0, format('FALLO: A ve %s casillas de binders ajenos', v_n);
  select count(*) into v_n from public.reportes_catalogo;
  assert v_n = 0, format('FALLO: A ve %s reportes ajenos', v_n);
  select count(*) into v_n from public.perfiles;
  assert v_n = 1, format('FALLO: A ve %s perfiles (debía ver solo el suyo)', v_n);

  -- 2. LECTURA POR ID (lo que haría alguien cambiando el id en la URL).
  select count(*) into v_n from public.inventario where id = v_inv_b;
  assert v_n = 0, 'FALLO: A leyó una fila de inventario de B por id';
  select count(*) into v_n from public.mazos where id = v_mazo_b;
  assert v_n = 0, 'FALLO: A leyó un mazo de B por id';
  select count(*) into v_n from public.binders where id = v_binder_b;
  assert v_n = 0, 'FALLO: A leyó un binder de B por id';

  -- 3. MODIFICACIÓN: no da error, pero no cambia ninguna fila.
  update public.inventario set cantidad = 9999 where id = v_inv_b;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'FALLO: A modificó inventario de B';
  update public.mazos set nombre = 'Hackeado' where id = v_mazo_b;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'FALLO: A renombró un mazo de B';
  update public.binders set nombre = 'Hackeado' where id = v_binder_b;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'FALLO: A renombró un binder de B';
  update public.mazo_cartas set cantidad = 1 where mazo_id = v_mazo_b;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'FALLO: A cambió cartas de un mazo de B';

  -- 4. BORRADO: tampoco borra nada ajeno.
  delete from public.inventario where id = v_inv_b;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'FALLO: A borró inventario de B';
  delete from public.mazos where id = v_mazo_b;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'FALLO: A borró un mazo de B';
  delete from public.binders where id = v_binder_b;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'FALLO: A borró un binder de B';
  delete from public.binder_casillas where binder_id = v_binder_b;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'FALLO: A borró casillas de un binder de B';

  -- 5. CREACIÓN A NOMBRE DE OTRO: with check lo rechaza con error.
  begin
    insert into public.inventario (usuario_id, carta_id, variante, cantidad) values (v_b, v_carta, 'fantasma', 1);
    raise exception 'FALLO: A creó inventario a nombre de B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.mazos (usuario_id, nombre) values (v_b, 'Falso');
    raise exception 'FALLO: A creó un mazo a nombre de B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.binders (usuario_id, nombre, filas, columnas) values (v_b, 'Falso', 2, 2);
    raise exception 'FALLO: A creó un binder a nombre de B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.reportes_catalogo (usuario_id, carta_id, motivo, detalle) values (v_b, v_carta, 'otro', 'Reporte falso a nombre de B');
    raise exception 'FALLO: A creó un reporte a nombre de B';
  exception when insufficient_privilege then null;
  end;

  -- 6. CARTAS EN EL MAZO O BINDER AJENO.
  begin
    insert into public.mazo_cartas (mazo_id, carta_id, cantidad) values (v_mazo_b, v_carta, 1);
    raise exception 'FALLO: A agregó cartas al mazo de B';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.binder_casillas (binder_id, pagina, posicion, inventario_id) values (v_binder_b, 1, 1, v_inv_a);
    raise exception 'FALLO: A puso una carta en el binder de B';
  exception when insufficient_privilege then null;
  end;
  -- Y en su propio binder, una carta del inventario de B (para leerla por el join).
  begin
    insert into public.binder_casillas (binder_id, pagina, posicion, inventario_id) values (v_binder_a, 1, 0, v_inv_b);
    raise exception 'FALLO: A puso en su binder una fila de inventario de B';
  exception when insufficient_privilege then null;
  end;

  -- 7. ESCALADA DE ROL: el privilegio por columna solo deja cambiar nombre_visible.
  begin
    update public.perfiles set rol = 'superusuario' where id = v_a;
    raise exception 'FALLO: A se asignó el rol superusuario';
  exception when insufficient_privilege then null;
  end;
  update public.perfiles set nombre_visible = 'Nuevo nombre' where id = v_b;
  get diagnostics v_n = row_count;
  assert v_n = 0, 'FALLO: A cambió el perfil de B';

  -- 8. REPORTES: un usuario normal no cambia el estado ni borra.
  update public.reportes_catalogo set estado = 'resuelto';
  get diagnostics v_n = row_count;
  assert v_n = 0, 'FALLO: un usuario normal cambió el estado de un reporte';

  -- 9. AUDITORÍA: la API no la lee ni la escribe.
  begin
    perform 1 from public.auditoria limit 1;
    raise exception 'FALLO: A leyó la auditoría';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.auditoria (accion, tabla) values ('x', 'x');
    raise exception 'FALLO: A escribió en la auditoría';
  exception when insufficient_privilege then null;
  end;

  -- ======================= Visitante sin sesión =======================
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
  begin
    perform 1 from public.inventario limit 1;
    raise exception 'FALLO: un visitante sin sesión leyó inventario';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.mazos limit 1;
    raise exception 'FALLO: un visitante sin sesión leyó mazos';
  exception when insufficient_privilege then null;
  end;

  -- ======================= B sigue intacto =======================
  reset role;
  select count(*) into v_n from public.inventario where id = v_inv_b and cantidad = 3;
  assert v_n = 1, 'FALLO: el inventario de B cambió';
  select count(*) into v_n from public.mazos where id = v_mazo_b and nombre = 'Mazo de B';
  assert v_n = 1, 'FALLO: el mazo de B cambió';
  select count(*) into v_n from public.mazo_cartas where mazo_id = v_mazo_b and cantidad = 2;
  assert v_n = 1, 'FALLO: las cartas del mazo de B cambiaron';
  select count(*) into v_n from public.binder_casillas where binder_id = v_binder_b;
  assert v_n = 1, 'FALLO: las casillas del binder de B cambiaron';

  raise notice 'OK: aislamiento verificado entre dos usuarios normales y un visitante';
end
$$;

rollback;
