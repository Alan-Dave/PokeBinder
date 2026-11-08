-- PBI-X7 (AB#74): categorías dentro de la colección.
--
-- Una categoría es de un usuario y agrupa filas de SU inventario («Mis
-- Sylveon»). Una fila puede estar en varias categorías. Es dato personal: RLS
-- con using y with check en ambas tablas.

-- ---------------------------------------------------------------------------
-- Categorías
-- ---------------------------------------------------------------------------

create table public.categorias_coleccion (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 1 and 60),
  creado_en   timestamptz not null default now()
);

-- Sin distinguir mayúsculas: «Sylveon» y «sylveon» serían la misma categoría.
create unique index categorias_coleccion_nombre_idx
  on public.categorias_coleccion (usuario_id, lower(nombre));

alter table public.categorias_coleccion enable row level security;

create policy "cada usuario gestiona sus categorías"
  on public.categorias_coleccion for all to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

revoke all on public.categorias_coleccion from anon;

-- Tope por usuario: sin él, una cuenta podría crear categorías sin límite.
create function privado.limitar_categorias()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.categorias_coleccion where usuario_id = new.usuario_id) >= 100 then
    raise exception 'Se alcanzó el máximo de 100 categorías'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger categorias_coleccion_limite
  before insert on public.categorias_coleccion
  for each row execute function privado.limitar_categorias();


-- ---------------------------------------------------------------------------
-- Pertenencia: qué filas del inventario están en cada categoría
-- ---------------------------------------------------------------------------

create table public.categoria_cartas (
  categoria_id   bigint not null references public.categorias_coleccion (id) on delete cascade,
  -- Si la carta sale del inventario, deja de estar en la categoría.
  inventario_id  bigint not null references public.inventario (id) on delete cascade,
  primary key (categoria_id, inventario_id)
);

create index categoria_cartas_inventario_idx on public.categoria_cartas (inventario_id);

alter table public.categoria_cartas enable row level security;

-- with check cubre dos cosas: la categoría debe ser del usuario y la carta debe
-- ser de SU inventario. Sin la segunda, alguien podría meter en su categoría
-- una fila de inventario ajena (y leer qué carta es por el join).
create policy "cada usuario gestiona las cartas de sus categorías"
  on public.categoria_cartas for all to authenticated
  using (exists (
    select 1 from public.categorias_coleccion c
    where c.id = categoria_id and c.usuario_id = (select auth.uid())
  ))
  with check (
    exists (
      select 1 from public.categorias_coleccion c
      where c.id = categoria_id and c.usuario_id = (select auth.uid())
    )
    and exists (
      select 1 from public.inventario i
      where i.id = inventario_id and i.usuario_id = (select auth.uid())
    )
  );

revoke all on public.categoria_cartas from anon;

-- Mismo criterio que el resto de funciones de privado: nadie la llama por la API.
revoke execute on function privado.limitar_categorias() from public, anon, authenticated;
