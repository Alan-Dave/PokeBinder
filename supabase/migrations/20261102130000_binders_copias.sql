-- PBI-14 (AB#17): una fila de inventario no puede ocupar más casillas que
-- copias tiene.
--
-- Una fila de public.inventario es una carta y variante con su cantidad
-- (unique por usuario, carta y variante). Sin este control, 1 sola copia se
-- podía colocar en todas las casillas de todos los binders, y el binder
-- mostraba cartas que el usuario no posee.
--
-- Códigos propios (clase PB, sin significado en PostgreSQL) para que la
-- aplicación muestre un mensaje exacto: 23514 ya se usa para otros motivos.
--   PB001  no quedan copias libres para la casilla
--   PB002  la cantidad bajaría de las casillas que la carta ocupa

-- ---------------------------------------------------------------------------
-- Colocar una carta: casillas ocupadas < copias
-- ---------------------------------------------------------------------------

create function privado.validar_copias_casilla()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  copias   integer;
  ocupadas integer;
begin
  -- Se bloquea la fila de inventario hasta el final de la transacción: dos
  -- colocaciones simultáneas de la última copia se atienden una detrás de otra
  -- y la segunda ya ve la casilla de la primera. "no key update" no estorba a
  -- las claves foráneas que apuntan a esta fila.
  select cantidad into copias
  from public.inventario
  where id = new.inventario_id
  for no key update;

  -- Fila inexistente o de otro usuario (RLS la oculta): lo rechazan la clave
  -- foránea y la política with check, no este control.
  if not found then
    return new;
  end if;

  -- La propia casilla no cuenta: volver a poner la misma carta donde ya está,
  -- o reemplazar su carta con upsert, no consume otra copia.
  select count(*) into ocupadas
  from public.binder_casillas c
  where c.inventario_id = new.inventario_id
    and (c.binder_id, c.pagina, c.posicion) <> (new.binder_id, new.pagina, new.posicion);

  if ocupadas >= copias then
    raise exception 'No quedan copias libres: tienes % y ya están en % casillas', copias, ocupadas
      using errcode = 'PB001';
  end if;
  return new;
end;
$$;

create trigger binder_casillas_valida_copias
  before insert or update of inventario_id on public.binder_casillas
  for each row execute function privado.validar_copias_casilla();


-- ---------------------------------------------------------------------------
-- Bajar la cantidad: no puede quedar por debajo de las casillas ocupadas
-- ---------------------------------------------------------------------------

create function privado.validar_cantidad_inventario()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ocupadas integer;
begin
  -- La fila ya está bloqueada por el update: una colocación en curso espera.
  select count(*) into ocupadas
  from public.binder_casillas
  where inventario_id = new.id;

  if new.cantidad < ocupadas then
    raise exception 'La carta está en % casillas de tus binders; no se puede bajar la cantidad a %', ocupadas, new.cantidad
      using errcode = 'PB002';
  end if;
  return new;
end;
$$;

create trigger inventario_valida_cantidad
  before update of cantidad on public.inventario
  for each row execute function privado.validar_cantidad_inventario();

-- Mismo criterio que el resto de funciones de privado: nadie las llama por la API.
revoke execute on function privado.validar_copias_casilla(), privado.validar_cantidad_inventario()
  from public, anon, authenticated;
