/**
 * Clasificador de variantes (PBI-13).
 *
 * Una carta puede existir en varias variantes (normal, holo, reverse...). El
 * catálogo las guarda como texto en cartas.variantes_disponibles y la base
 * (trigger inventario_valida_variante) decide qué variante existe para cada
 * carta. Este módulo no decide eso: da un nombre legible, un orden fijo y una
 * forma de separar lo conocido de lo que el catálogo traiga de nuevo.
 *
 * Es TypeScript puro, sin zod ni dependencias de servidor, para que lo usen
 * tanto los componentes de navegador como el servidor.
 */

// Nombres tal como llegan en el catálogo (los mismos que usa TCGdex).
export const VARIANTES = ["normal", "reverse", "holo", "firstEdition", "wPromo"] as const;

export type Variante = (typeof VARIANTES)[number];

// El orden de este objeto no importa: el orden de presentación es el de VARIANTES.
const ETIQUETAS: Record<Variante, string> = {
  normal: "Normal",
  reverse: "Reverse holo",
  holo: "Holo",
  firstEdition: "Primera edición",
  wPromo: "Promo W",
};

export function esVariante(valor: string): valor is Variante {
  return (VARIANTES as readonly string[]).includes(valor);
}

/**
 * Texto para mostrar. Una variante que el catálogo traiga y este módulo no
 * conozca se muestra tal cual en vez de ocultarse: es mejor un nombre feo que
 * una variante invisible que el usuario no puede elegir.
 */
export function etiquetaVariante(valor: string): string {
  return esVariante(valor) ? ETIQUETAS[valor] : valor;
}

export type VariantesClasificadas = {
  // Variantes conocidas, sin repetir y en el orden fijo de VARIANTES.
  conocidas: Variante[];
  // Las demás, sin repetir y en orden alfabético.
  desconocidas: string[];
};

export function clasificarVariantes(variantes: readonly string[]): VariantesClasificadas {
  const presentes = new Set(variantes.map((v) => v.trim()).filter((v) => v !== ""));
  return {
    conocidas: VARIANTES.filter((v) => presentes.has(v)),
    desconocidas: [...presentes].filter((v) => !esVariante(v)).sort((a, b) => a.localeCompare(b)),
  };
}

/** Todas las variantes en orden de presentación: primero las conocidas. */
export function ordenarVariantes(variantes: readonly string[]): string[] {
  const { conocidas, desconocidas } = clasificarVariantes(variantes);
  return [...conocidas, ...desconocidas];
}

/** "Normal, Reverse holo, Holo" o `vacio` si no hay ninguna. */
export function describirVariantes(variantes: readonly string[], vacio = "Ninguna"): string {
  const ordenadas = ordenarVariantes(variantes);
  return ordenadas.length > 0 ? ordenadas.map(etiquetaVariante).join(", ") : vacio;
}
