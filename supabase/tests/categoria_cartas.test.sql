-- PBI-X14 (AB#81): comprueba las restricciones de cartas.categoria y
-- cartas.energia_basica. Se ejecuta en el editor SQL de Supabase; todo queda
-- dentro de una transacción que se revierte, así que no deja datos.

begin;

do $$
declare
  v_id bigint;
begin
  select id into v_id from public.cartas limit 1;
  if v_id is null then
    raise exception 'La tabla cartas está vacía: no hay con qué probar.';
  end if;

  -- Valores válidos.
  update public.cartas set categoria = 'Energy', energia_basica = true where id = v_id;
  update public.cartas set categoria = 'Pokemon', energia_basica = null where id = v_id;

  -- Una categoría inventada se rechaza.
  begin
    update public.cartas set categoria = 'Otra' where id = v_id;
    raise exception 'FALLO: aceptó una categoría inválida';
  exception when check_violation then
    raise notice 'ok: categoría inválida rechazada';
  end;

  -- energia_basica solo para energías.
  begin
    update public.cartas set categoria = 'Trainer', energia_basica = true where id = v_id;
    raise exception 'FALLO: aceptó energia_basica en un Entrenador';
  exception when check_violation then
    raise notice 'ok: energia_basica fuera de una energía rechazada';
  end;
end
$$;

rollback;
