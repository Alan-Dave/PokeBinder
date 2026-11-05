/**
 * Análisis del inventario para el dashboard (PBI-23). Funciones puras y
 * deterministas: el análisis corre en el servidor y no envía ningún dato a un
 * tercero. Separadas de lib/dashboard.ts (que importa "server-only") para poder
 * probarlas con Vitest, igual que lib/resumen.ts.
 */

import type { ResumenSet } from "@/lib/resumen";

export type TotalSet = { setId: string; idioma: string; total: number };

export type CoberturaSet = {
  setId: string;
  idioma: string;
  copias: number;
  tengo: number;
  total: number;
  faltan: number;
  /** Porcentaje entero de 0 a 100, redondeado hacia abajo: 100 solo si el set está completo. */
  porcentaje: number;
};

export type Analisis = {
  sets: CoberturaSet[];
  completos: number;
  /** El set incompleto al que le faltan menos cartas. */
  masCercano: CoberturaSet | null;
  /** Frases listas para mostrar, en orden de importancia. */
  observaciones: string[];
};

const clave = (setId: string, idioma: string) => `${setId}\u0000${idioma}`;

function plural(n: number, singular: string, pluralForma: string): string {
  return n === 1 ? singular : pluralForma;
}

/**
 * Cruza lo que el usuario tiene de cada set con el total de cartas del set.
 * Un set sin total conocido (o vacío) no entra: no se puede calcular su avance.
 * `nombresSet` usa la clave «id|idioma» de lib/reportes.ts.
 */
export function analizarCobertura(
  porSet: readonly ResumenSet[],
  totales: readonly TotalSet[],
  contexto: { copias: number; sinPrecio: number; nombresSet?: Record<string, string> },
): Analisis {
  const totalDe = new Map(totales.map((t) => [clave(t.setId, t.idioma), t.total]));

  const sets: CoberturaSet[] = [];
  for (const s of porSet) {
    const total = totalDe.get(clave(s.setId, s.idioma));
    if (!total || total <= 0) continue;
    // El inventario no puede tener más cartas distintas que el set; el tope cubre datos inconsistentes.
    const tengo = Math.min(s.distintas, total);
    sets.push({
      setId: s.setId,
      idioma: s.idioma,
      copias: s.copias,
      tengo,
      total,
      faltan: total - tengo,
      porcentaje: Math.floor((tengo / total) * 100),
    });
  }

  const completos = sets.filter((s) => s.faltan === 0).length;
  const masCercano =
    sets
      .filter((s) => s.faltan > 0)
      .sort((a, b) => a.faltan - b.faltan || b.porcentaje - a.porcentaje || a.setId.localeCompare(b.setId))[0] ?? null;

  const nombre = (s: CoberturaSet) => contexto.nombresSet?.[`${s.setId}|${s.idioma}`] ?? s.setId;

  const observaciones: string[] = [];
  if (contexto.copias === 0) {
    observaciones.push("Aún no tienes cartas en el inventario: agrega algunas para ver tu avance.");
  } else {
    if (masCercano) {
      observaciones.push(
        `Te ${plural(masCercano.faltan, "falta 1 carta", `faltan ${masCercano.faltan} cartas`)} para completar ` +
          `${nombre(masCercano)} (${masCercano.idioma}).`,
      );
    }
    if (completos > 0) {
      observaciones.push(`Has completado ${completos} ${plural(completos, "set", "sets")}.`);
    }
  }
  if (contexto.sinPrecio > 0) {
    observaciones.push(
      `${contexto.sinPrecio} ${plural(contexto.sinPrecio, "carta no tiene precio", "cartas no tienen precio")}: ` +
        "el valor estimado es parcial.",
    );
  }

  return { sets, completos, masCercano, observaciones };
}
