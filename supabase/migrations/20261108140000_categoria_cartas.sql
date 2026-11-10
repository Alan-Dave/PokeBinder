-- PBI-X14 (AB#81): categoría de cada carta del catálogo.
--
-- El catálogo migrado no trae la categoría (Pokémon, Entrenador, Energía) de la
-- mayoría de las cartas, así que las reglas de mazo no pueden comprobarla. Estas
-- columnas las llena ingesta/completar_categorias.py con datos de TCGdex; no se
-- infieren por el nombre. Quedan en null mientras el dato no exista.
--
-- No hay política nueva: el catálogo ya es de solo lectura para los usuarios y
-- las columnas heredan los permisos de la tabla.

alter table public.cartas
  add column categoria text
    constraint cartas_categoria_check check (categoria in ('Pokemon', 'Trainer', 'Energy')),
  -- true: energía básica (sin límite de copias); false: energía especial.
  -- Solo tiene sentido en una energía.
  add column energia_basica boolean
    constraint cartas_energia_basica_check check (energia_basica is null or categoria = 'Energy');

comment on column public.cartas.categoria is
  'Pokemon, Trainer o Energy según TCGdex. Null si aún no se ha completado.';
comment on column public.cartas.energia_basica is
  'Solo para energías: true si es básica (TCGdex energyType = Normal).';
