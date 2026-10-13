-- Búsqueda del catálogo por nombre y valores de los filtros (PBI-09).
--
-- La búsqueda es por PREFIJO del nombre ("pika" encuentra "Pikachu"), sin
-- distinguir mayúsculas. Un índice normal de PostgreSQL solo acelera
-- "empieza por" si el valor ya está en minúsculas y se creó con
-- text_pattern_ops; por eso se guarda el nombre en minúsculas en una columna
-- generada, en vez de aplicar lower() en cada consulta (la API de Supabase no
-- permite filtrar por una expresión).
--
-- La columna es generada: nadie la escribe, y se recalcula sola si cambia el
-- nombre. Agregarla reescribe la tabla una vez (unas 95.000 filas).

alter table public.cartas
  add column nombre_busqueda text generated always as (lower(nombre)) stored;

create index cartas_nombre_busqueda_idx
  on public.cartas (nombre_busqueda text_pattern_ops);

-- El filtro por idioma aparece en casi toda búsqueda del catálogo.
create index cartas_idioma_idx on public.cartas (idioma);


-- Valores distintos de tipo y rareza, para armar los filtros sin escribirlos
-- a mano (cambian cada vez que se carga un set nuevo).
--
-- security invoker (el valor por defecto): corre con los permisos de quien la
-- llama, así que sigue sujeta a la política de lectura pública de cartas.
create function public.catalogo_filtros()
returns table (tipos text[], rarezas text[])
language sql
stable
set search_path = ''
as $$
  select
    array(select distinct c.type from public.cartas c where c.type is not null order by 1),
    array(select distinct c.rarity from public.cartas c where c.rarity is not null order by 1);
$$;

-- Postgres otorga execute a public en toda función nueva.
revoke execute on function public.catalogo_filtros() from public;
grant execute on function public.catalogo_filtros() to anon, authenticated;
