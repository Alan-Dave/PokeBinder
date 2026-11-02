/**
 * Cálculo de cobertura de inventario para las cartas de un mazo (PBI-17).
 *
 * Separado de lib/mazos.ts (que importa "server-only") para poder probar esta
 * lógica con Vitest: "server-only" lanza una excepción fuera de un bundle de
 * servidor de Next.js, así que un módulo que lo importe no se puede probar
 * directamente (mismo motivo por el que lib/roles.ts e lib/imagenes.ts no
 * testean su función async, solo el esquema zod).
 */

export type CartaMazo = { carta_id: number; cantidad: number };
export type CartaInventario = { carta_id: number; cantidad: number };

export type CoberturaCarta = {
  carta_id: number;
  en_mazo: number;
  en_inventario: number;
  cubierta: boolean;
  faltante: number;
};

/**
 * `inventario` ya viene sumado por carta_id (todas las variantes juntas): a
 * este cálculo no le importa qué variante es cada copia, solo si el usuario
 * tiene suficientes copias en total.
 */
export function calcularCobertura(
  mazoCartas: CartaMazo[],
  inventario: CartaInventario[],
): CoberturaCarta[] {
  const enInventario = new Map(inventario.map((i) => [i.carta_id, i.cantidad]));

  return mazoCartas.map((carta) => {
    const disponible = enInventario.get(carta.carta_id) ?? 0;
    const faltante = Math.max(0, carta.cantidad - disponible);
    return {
      carta_id: carta.carta_id,
      en_mazo: carta.cantidad,
      en_inventario: disponible,
      cubierta: faltante === 0,
      faltante,
    };
  });
}
