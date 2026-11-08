import { acabadoDeVariante } from "@/lib/precios";

/**
 * Evolución del valor de la colección (PBI-30): lógica pura, sin red ni base.
 *
 * El valor de un día es la suma de precio × cantidad de cada fila del
 * inventario, con el último precio conocido de su acabado hasta ese día. Es el
 * valor de TU colección de hoy valuada con los precios de cada fecha: no
 * reconstruye qué cartas tenías en el pasado (el inventario no guarda historia).
 */

export type FilaValor = { cartaId: number; variante: string; cantidad: number };
export type PuntoPrecio = { cartaId: number; acabado: string; fecha: string; mercado: number };
export type PuntoEvolucion = { fecha: string; valor: number };

export type Evolucion = {
  puntos: PuntoEvolucion[];
  /** Filas del inventario que entran en el cálculo. */
  filasValuadas: number;
  /** Filas sin acabado equivalente o sin historial: no suman, tampoco valen 0. */
  filasSinPrecio: number;
};

const clave = (cartaId: number, acabado: string) => `${cartaId}|${acabado}`;

export function calcularEvolucion(filas: readonly FilaValor[], historial: readonly PuntoPrecio[]): Evolucion {
  // Serie de cada carta y acabado, ordenada por fecha.
  const series = new Map<string, { fecha: string; centavos: number }[]>();
  for (const p of historial) {
    const k = clave(p.cartaId, p.acabado);
    const serie = series.get(k) ?? [];
    serie.push({ fecha: p.fecha, centavos: Math.round(p.mercado * 100) });
    series.set(k, serie);
  }
  for (const serie of series.values()) serie.sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Solo cuentan las filas con acabado equivalente y al menos un precio.
  const valuables: { cantidad: number; serie: { fecha: string; centavos: number }[] }[] = [];
  for (const f of filas) {
    const acabado = acabadoDeVariante(f.variante);
    const serie = acabado ? series.get(clave(f.cartaId, acabado)) : undefined;
    if (serie && serie.length > 0) valuables.push({ cantidad: f.cantidad, serie });
  }
  const resultado: Evolucion = {
    puntos: [],
    filasValuadas: valuables.length,
    filasSinPrecio: filas.length - valuables.length,
  };
  if (valuables.length === 0) return resultado;

  // Se empieza el día en que TODAS las filas valuables ya tienen precio: si no,
  // el gráfico "subiría" solo porque van apareciendo cartas.
  const inicio = valuables.reduce((max, v) => (v.serie[0].fecha > max ? v.serie[0].fecha : max), "");
  const fechas = [...new Set(valuables.flatMap((v) => v.serie.map((s) => s.fecha)))].filter((f) => f >= inicio).sort();

  resultado.puntos = fechas.map((fecha) => {
    let centavos = 0;
    for (const v of valuables) {
      // Último precio conocido hasta esa fecha (la serie está ordenada).
      let ultimo = v.serie[0].centavos;
      for (const s of v.serie) {
        if (s.fecha > fecha) break;
        ultimo = s.centavos;
      }
      centavos += ultimo * v.cantidad;
    }
    return { fecha, valor: centavos / 100 };
  });
  return resultado;
}
