/**
 * Colores de la carpeta de cada binder (PBI-X10).
 *
 * El color sale del id del binder, así que es estable entre visitas y no hay
 * que guardarlo en la base. Las clases de Tailwind deben aparecer completas en
 * el código: no se pueden armar con una plantilla. El texto de la pestaña usa
 * el color que da contraste AA sobre su cubierta (blanco sobre rojo, azul y
 * verde; tinta sobre amarillo).
 */

export type ColorBinder = {
  nombre: "rojo" | "azul" | "verde" | "amarillo";
  cubierta: string;
  texto: string;
};

export const COLORES_BINDER: readonly ColorBinder[] = [
  { nombre: "rojo", cubierta: "bg-rojo", texto: "text-white" },
  { nombre: "azul", cubierta: "bg-azul", texto: "text-white" },
  { nombre: "verde", cubierta: "bg-verde", texto: "text-white" },
  { nombre: "amarillo", cubierta: "bg-amarillo", texto: "text-tinta" },
];

/** Color de un binder según su id. Un id inválido usa el primero, nunca falla. */
export function colorDeBinder(id: number): ColorBinder {
  const entero = Number.isFinite(id) ? Math.abs(Math.trunc(id)) : 0;
  return COLORES_BINDER[entero % COLORES_BINDER.length];
}
