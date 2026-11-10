-- PBI-14 (AB#17): binder virtual con cuadrícula configurable.
--
-- Un binder es de un usuario, tiene una cuadrícula fija (2x2, 3x3, 3x4 o 4x4),
-- un número de páginas y casillas que apuntan a filas de SU inventario.
-- Todo es dato personal: RLS con using y with check en ambas tablas.

-- ---------------------------------------------------------------------------
-- Binders
-- ---------------------------------------------------------------------------

create table public.binders (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  nombre      text not null check (char_length(nombre) between 1 and 60),
  filas       smallint not null,
  columnas    smallint not null,
  paginas     smallint not null default 1 check (paginas between 1 and 100),
  creado_en   timestamptz not null default now(),
  -- Las únicas cuadrículas del producto (ver CLAUDE.md).
  constraint binders_cuadricula_valida check (
    (filas, columnas) in ((2, 2), (3, 3), (3, 4), (4, 4))
  ),
  unique (usuario_id, nombre)
);

create index binders_usuario_idx on public.binders (usuario_id);

alter table public.binders enable row level security;

create policy "cada usuario gestiona sus binders"
  on public.binders for all to authenticated
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);

revoke all on public.binders from anon;


-- ---------------------------------------------------------------------------
-- Casillas
-- ---------------------------------------------------------------------------

create table public.binder_casillas (
  binder_id      bigint not null references public.binders (id) on delete cascade,
  pagina         smallint not null check (pagina >= 1),
  -- 0 es la primera casilla (arriba a la izquierda); se cuenta por filas.
  posicion       smallint not null check (posicion >= 0),
  -- Si la carta sale del inventario, la casilla queda libre.
  inventario_id  bigint not null references public.inventario (id) on delete cascade,
  primary key (binder_id, pagina, posicion)
);

create index binder_casillas_inventario_idx on public.binder_casillas (inventario_id);

alter table public.binder_casillas enable row level security;

-- with check cubre dos cosas: el binder debe ser del usuario y la carta debe
-- ser de SU inventario. Sin la segunda, alguien podría poner en su binder una
-- fila de inventario ajena (y leer qué carta es por el join).
create policy "cada usuario gestiona las casillas de sus binders"
  on public.binder_casillas for all to authenticated
  using (exists (
    select 1 from public.binders b
    where b.id = binder_id and b.usuario_id = (select auth.uid())
  ))
  with check (
    exists (
      select 1 from public.binders b
      where b.id = binder_id and b.usuario_id = (select auth.uid())
    )
    and exists (
      select 1 from public.inventario i
      where i.id = inventario_id and i.usuario_id = (select auth.uid())
    )
  );

revoke all on public.binder_casillas from anon;


-- ---------------------------------------------------------------------------
-- Validaciones entre tablas (un check no puede consultar otra tabla)
-- ---------------------------------------------------------------------------

-- La casilla debe caber en la cuadrícula y en las páginas del binder.
create function privado.validar_casilla()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  b public.binders%rowtype;
begin
  select * into b from public.binders where id = new.binder_id;
  if not found then
    raise exception 'El binder % no existe', new.binder_id using errcode = 'foreign_key_violation';
  end if;
  if new.pagina > b.paginas then
    raise exception 'La página % no existe: el binder tiene % páginas', new.pagina, b.paginas
      using errcode = 'check_violation';
  end if;
  if new.posicion >= b.filas * b.columnas then
    raise exception 'La posición % no existe en una cuadrícula de %x%', new.posicion, b.filas, b.columnas
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger binder_casillas_valida
  before insert or update on public.binder_casillas
  for each row execute function privado.validar_casilla();

-- No se puede achicar un binder dejando casillas fuera de su nuevo tamaño.
create function privado.validar_cambio_binder()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.binder_casillas c
    where c.binder_id = new.id
      and (c.pagina > new.paginas or c.posicion >= new.filas * new.columnas)
  ) then
    raise exception 'El binder tiene cartas fuera del nuevo tamaño; sácalas antes de reducirlo'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger binders_valida_cambio
  before update of filas, columnas, paginas on public.binders
  for each row execute function privado.validar_cambio_binder();

-- Mismo criterio que el resto de funciones de privado: nadie las llama por la API.
revoke execute on function privado.validar_casilla(), privado.validar_cambio_binder()
  from public, anon, authenticated;
