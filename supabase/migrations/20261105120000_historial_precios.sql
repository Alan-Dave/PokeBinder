-- PBI-30 (AB#64): historial de precios para el gráfico de evolución del valor (RF-10).
--
-- Guarda UN precio de mercado por carta, acabado y día. Son datos públicos del
-- mercado, no datos de un usuario: por eso no lleva usuario_id. El valor de la
-- colección de cada persona se calcula en la aplicación cruzando este historial
-- con SU inventario (que ya está protegido por RLS).
--
-- Quién escribe es lo importante: si los usuarios pudieran insertar, cualquiera
-- falsearía los precios que ven los demás. Por eso:
--   * RLS activada; los usuarios autenticados solo pueden LEER.
--   * No hay política de insert/update/delete para usuarios.
--   * Escribe solo el servidor con la clave de servicio (service_role), que
--     ignora RLS y nunca llega al navegador (regla 2).

create table public.precios_historial (
  carta_id    bigint not null references public.cartas (id) on delete cascade,
  -- Clave del acabado en TCGplayer: "normal", "holofoil", "reverse-holofoil"...
  acabado     text not null check (char_length(acabado) between 1 and 40),
  fecha       date not null default current_date,
  -- Dólares (TCGplayer). numeric y no float para no acumular errores de redondeo.
  mercado     numeric(10, 2) not null check (mercado >= 0),
  primary key (carta_id, acabado, fecha)
);

-- El gráfico lee la serie de unas pocas cartas ordenada por fecha.
create index precios_historial_fecha_idx on public.precios_historial (carta_id, fecha);

alter table public.precios_historial enable row level security;

-- Lectura para quien tenga sesión. Sin "using" no habría lectura; sin política
-- de escritura, RLS la deniega para authenticated.
create policy "usuarios autenticados leen el historial de precios"
  on public.precios_historial for select to authenticated
  using (true);

-- Sin sesión no se ve nada, y el cliente anónimo tampoco puede escribir.
-- Se quitan los permisos de tabla además de RLS (defensa en capas).
revoke all on public.precios_historial from anon;
revoke insert, update, delete, truncate on public.precios_historial from authenticated;
