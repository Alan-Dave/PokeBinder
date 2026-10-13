-- Catálogo de cartas migrado desde PokeDatabase.db (SQLite).
--
-- Diferencias con el modelo de SQLite, según el perfil de los datos de origen:
--   * set_name se separa en la tabla sets. El nombre cambia según el idioma,
--     por eso la clave es (id, idioma).
--   * Los marcadores 'Desconocido', 'Desconocida', 'Ninguno' y 'TCGDex' se
--     guardan como NULL para que no aparezcan como valores reales en filtros.
--   * especial_type, trainer y edition se unen en subtipos. En el origen, la
--     lista de subtipos de la API quedó repartida por posición entre esas tres
--     columnas: trainer nunca contiene un entrenador (trae 'GX', 'ex',
--     'Ultra Beast'...) y edition solo trae subtipos o filas de prueba.
--   * price pasa de float a numeric para no acumular errores de redondeo.
--
-- Acceso: lectura pública y ninguna escritura desde la Data API. Solo el
-- script ingesta/migrar_catalogo.py, con conexión directa, carga datos.

create table public.sets (
  id      text not null check (char_length(id) between 1 and 30),
  idioma  text not null check (idioma in ('en', 'es', 'fr', 'pt', 'ja', 'zh')),
  -- NULL cuando el origen no trae el nombre del set.
  nombre  text check (char_length(nombre) between 1 and 200),
  primary key (id, idioma)
);

create table public.cartas (
  id                     bigint generated always as identity primary key,
  id_api                 text not null check (char_length(id_api) between 1 and 50),
  idioma                 text not null,
  nombre                 text not null check (char_length(nombre) between 1 and 200),
  type                   text,
  price                  numeric(10, 2) check (price >= 0),
  rarity                 text,
  -- text porque existen números como 'H1' o 'TG05'.
  number                 text not null check (char_length(number) between 1 and 20),
  set_id                 text not null,
  -- Etapa o categoría: 'Basic', 'Stage 1', 'Supporter', 'Item'...
  stage                  text,
  subtipos               text[] not null default '{}',
  variantes_disponibles  text[] not null default '{}',
  unique (id_api, idioma),
  foreign key (set_id, idioma) references public.sets (id, idioma)
);

-- PostgreSQL no indexa las claves foráneas por su cuenta.
create index cartas_set_idx on public.cartas (set_id, idioma);

alter table public.sets   enable row level security;
alter table public.cartas enable row level security;

create policy "catalogo de sets visible para todos"
  on public.sets for select to anon, authenticated using (true);

create policy "catalogo de cartas visible para todos"
  on public.cartas for select to anon, authenticated using (true);

-- Defensa en profundidad: además de no tener políticas de escritura, los roles
-- de la API no tienen el privilegio.
revoke insert, update, delete, truncate on public.sets, public.cartas from anon, authenticated;
