/**
 * Veredicto de legalidad de un mazo (PBI-19). Funciones puras: separadas de
 * lib/legalidad-mazo.ts (que importa "server-only" y consulta a TCGdex) para
 * poder probarlas con Vitest, igual que lib/reglas-mazo.ts.
 *
 * Regla de oro: lo que no se pudo verificar nunca se presenta como legal. Un
 * mazo solo es «legal» si TCGdex confirmó cada una de sus cartas.
 */

import type { FormatoLegalidad } from "@/lib/validators/legalidad";

/** null = TCGdex no informó ese formato para la carta. */
export type LegalidadCarta = { standard: boolean | null; expanded: boolean | null };

export type EstadoCarta = "legal" | "no-legal" | "no-verificable";
export type Veredicto = EstadoCarta;

export type CartaLegalidad = { cartaId: number; nombre: string; estado: EstadoCarta };

export type ResultadoLegalidad = {
  formato: FormatoLegalidad;
  veredicto: Veredicto;
  /** Una entrada por carta distinta, con las que impiden la legalidad primero. */
  cartas: CartaLegalidad[];
  noLegales: number;
  noVerificables: number;
};

const ORDEN: Record<EstadoCarta, number> = { "no-legal": 0, "no-verificable": 1, legal: 2 };

export function estadoDeCarta(legalidad: LegalidadCarta | null | undefined, formato: FormatoLegalidad): EstadoCarta {
  const valor = legalidad?.[formato];
  if (valor === true) return "legal";
  if (valor === false) return "no-legal";
  return "no-verificable";
}

export function evaluarLegalidad(
  lineas: readonly { cartaId: number; nombre: string }[],
  legalidades: ReadonlyMap<number, LegalidadCarta | null>,
  formato: FormatoLegalidad,
): ResultadoLegalidad {
  const cartas = lineas
    .map((l) => ({ cartaId: l.cartaId, nombre: l.nombre, estado: estadoDeCarta(legalidades.get(l.cartaId), formato) }))
    .sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado] || a.nombre.localeCompare(b.nombre) || a.cartaId - b.cartaId);

  const noLegales = cartas.filter((c) => c.estado === "no-legal").length;
  const noVerificables = cartas.filter((c) => c.estado === "no-verificable").length;
  // Una carta ilegal ya decide el veredicto aunque otras no se hayan podido verificar.
  const veredicto: Veredicto = noLegales > 0 ? "no-legal" : noVerificables > 0 ? "no-verificable" : "legal";

  return { formato, veredicto, cartas, noLegales, noVerificables };
}
