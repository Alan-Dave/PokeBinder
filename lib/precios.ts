/**
 * Lógica pura de precios (PBI-29): sin red ni base de datos.
 *
 * TCGplayer informa un precio de mercado por acabado ("normal", "holofoil",
 * "reverse-holofoil"...). El inventario guarda variantes del catálogo
 * (normal, reverse, holo...). Solo se enlazan las que coinciden sin ambigüedad:
 * si no hay coincidencia el resultado es "sin precio", nunca una estimación.
 */

export type PrecioAcabado = { acabado: string; mercado: number };

export type PreciosCarta = {
  moneda: "USD";
  // Fecha que informa la fuente; null si no la trae.
  actualizado: string | null;
  acabados: PrecioAcabado[];
};

type AcabadoCrudo = { marketPrice?: number } | undefined;
type TcgplayerCrudo = { unit?: string; updated?: string; [acabado: string]: unknown };

/**
 * Convierte la respuesta ya validada de TCGdex. Devuelve null si la fuente no
 * está en dólares o ningún acabado trae precio de mercado.
 */
export function extraerPrecios(tcgplayer: TcgplayerCrudo | undefined): PreciosCarta | null {
  if (!tcgplayer || tcgplayer.unit !== "USD") return null;

  const acabados: PrecioAcabado[] = [];
  for (const [clave, valor] of Object.entries(tcgplayer)) {
    if (clave === "unit" || clave === "updated") continue;
    const mercado = (valor as AcabadoCrudo)?.marketPrice;
    if (typeof mercado === "number") acabados.push({ acabado: clave, mercado });
  }
  if (acabados.length === 0) return null;

  acabados.sort((a, b) => a.acabado.localeCompare(b.acabado));
  return { moneda: "USD", actualizado: tcgplayer.updated ?? null, acabados };
}

const ACABADO_DE_VARIANTE: Record<string, string> = {
  normal: "normal",
  reverse: "reverse-holofoil",
  holo: "holofoil",
};

export const ETIQUETAS_ACABADO: Record<string, string> = {
  normal: "Normal",
  holofoil: "Holo",
  "reverse-holofoil": "Reverse holo",
  "1st-edition-holofoil": "1ª edición holo",
  "1st-edition-normal": "1ª edición",
  "unlimited-holofoil": "Ilimitada holo",
  unlimited: "Ilimitada",
};

export function etiquetaAcabado(acabado: string): string {
  return ETIQUETAS_ACABADO[acabado] ?? acabado;
}

/** Acabado de TCGplayer equivalente a una variante del catálogo, o null si no hay. */
export function acabadoDeVariante(variante: string): string | null {
  return ACABADO_DE_VARIANTE[variante] ?? null;
}

/** Precio de mercado del acabado que corresponde a la variante, o null. */
export function precioDeVariante(precios: PreciosCarta | null | undefined, variante: string): number | null {
  const acabado = acabadoDeVariante(variante);
  if (!precios || !acabado) return null;
  return precios.acabados.find((a) => a.acabado === acabado)?.mercado ?? null;
}

export type PrecioCatalogo = {
  /** Precio más bajo entre las variantes de la carta que tienen precio. */
  monto: number;
  /** true si otras variantes cuestan distinto: se muestra como «desde». */
  desde: boolean;
};

/**
 * Precio de referencia de una carta del catálogo, que muestra todas sus
 * variantes. Se toma el más bajo y se avisa si las demás cuestan distinto;
 * así nunca se anuncia un precio que no se pueda conseguir. Solo cuentan las
 * variantes que enlazan sin ambigüedad con un acabado (ver precioDeVariante):
 * si ninguna enlaza, el resultado es «sin precio», no una estimación.
 */
export function precioDeCatalogo(
  precios: PreciosCarta | null | undefined,
  variantes: readonly string[],
): PrecioCatalogo | null {
  const montos = variantes.flatMap((v) => {
    const monto = precioDeVariante(precios, v);
    return monto === null ? [] : [monto];
  });
  if (montos.length === 0) return null;
  const monto = Math.min(...montos);
  return { monto, desde: montos.some((m) => m !== monto) };
}

export type ValorColeccion = {
  /** Suma de precio × cantidad de las filas que tienen precio. */
  total: number;
  conPrecio: number;
  sinPrecio: number;
};

/** Suma el valor estimado; las filas sin precio se cuentan aparte, no valen 0. */
export function valorDeColeccion(filas: readonly { precio: number | null; cantidad: number }[]): ValorColeccion {
  let centavos = 0;
  let conPrecio = 0;
  let sinPrecio = 0;
  for (const { precio, cantidad } of filas) {
    if (precio === null) {
      sinPrecio += 1;
      continue;
    }
    // En centavos enteros para no acumular errores de punto flotante.
    centavos += Math.round(precio * 100) * cantidad;
    conPrecio += 1;
  }
  return { total: centavos / 100, conPrecio, sinPrecio };
}

export function formatearUsd(monto: number): string {
  return `US$ ${monto.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
