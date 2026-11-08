/**
 * Cálculos de los reportes de inventario (PBI-21). Funciones puras: separadas
 * de lib/reportes.ts (que importa "server-only") para poder probarlas con
 * Vitest, igual que lib/cobertura.ts.
 */

export type FilaResumen = {
  cantidad: number;
  cartas: { set_id: string; idioma: string; price: number | null } | null;
};

export type ResumenIdioma = { idioma: string; copias: number; distintas: number };
export type ResumenSet = { setId: string; idioma: string; copias: number; distintas: number };

export type ResumenInventario = {
  copias: number;
  distintas: number;
  /** Suma de price × cantidad; las cartas sin precio no cuentan. */
  valorEstimado: number;
  sinPrecio: number;
  porIdioma: ResumenIdioma[];
  porSet: ResumenSet[];
};

/**
 * Cada fila de inventario es una carta con una variante, así que «distintas»
 * cuenta filas distintas de carta, no variantes: una carta en dos variantes
 * cuenta una vez. `filas` puede traer la misma carta repetida por variante.
 */
export function resumirInventario(filas: readonly (FilaResumen & { carta_id: number })[]): ResumenInventario {
  const cartasVistas = new Set<number>();
  const idiomas = new Map<string, { copias: number; cartas: Set<number> }>();
  const sets = new Map<string, { setId: string; idioma: string; copias: number; cartas: Set<number> }>();
  let copias = 0;
  // En centavos enteros: sumar decimales en coma flotante acumula error.
  let centavos = 0;
  const sinPrecio = new Set<number>();

  for (const fila of filas) {
    copias += fila.cantidad;
    cartasVistas.add(fila.carta_id);
    if (!fila.cartas) continue;

    const { set_id, idioma, price } = fila.cartas;
    if (price === null) sinPrecio.add(fila.carta_id);
    else centavos += Math.round(price * 100) * fila.cantidad;

    const i = idiomas.get(idioma) ?? { copias: 0, cartas: new Set<number>() };
    i.copias += fila.cantidad;
    i.cartas.add(fila.carta_id);
    idiomas.set(idioma, i);

    const clave = `${set_id}\u0000${idioma}`;
    const s = sets.get(clave) ?? { setId: set_id, idioma, copias: 0, cartas: new Set<number>() };
    s.copias += fila.cantidad;
    s.cartas.add(fila.carta_id);
    sets.set(clave, s);
  }

  return {
    copias,
    distintas: cartasVistas.size,
    valorEstimado: centavos / 100,
    sinPrecio: sinPrecio.size,
    porIdioma: [...idiomas]
      .map(([idioma, v]) => ({ idioma, copias: v.copias, distintas: v.cartas.size }))
      .sort((a, b) => b.copias - a.copias || a.idioma.localeCompare(b.idioma)),
    porSet: [...sets.values()]
      .map((v) => ({ setId: v.setId, idioma: v.idioma, copias: v.copias, distintas: v.cartas.size }))
      .sort((a, b) => b.copias - a.copias || a.setId.localeCompare(b.setId) || a.idioma.localeCompare(b.idioma)),
  };
}

export type CartaSet = { id: number; nombre: string; number: string; rarity: string | null };

export type Faltantes = {
  total: number;
  tengo: number;
  faltan: CartaSet[];
  /** Porcentaje entero de 0 a 100; 0 si el set no tiene cartas. */
  porcentaje: number;
};

export function calcularFaltantes(cartasDelSet: readonly CartaSet[], poseidas: ReadonlySet<number>): Faltantes {
  const faltan = cartasDelSet
    .filter((c) => !poseidas.has(c.id))
    // Numeración natural: «2» antes que «10», y «H1» o «TG05» donde les toque.
    .sort((a, b) => a.number.localeCompare(b.number, "en", { numeric: true }) || a.id - b.id);
  const total = cartasDelSet.length;
  const tengo = total - faltan.length;
  return { total, tengo, faltan, porcentaje: total === 0 ? 0 : Math.floor((tengo / total) * 100) };
}
