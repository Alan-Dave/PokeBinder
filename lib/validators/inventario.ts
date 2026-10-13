import { z } from "zod";

// Mismo rango que el check de public.inventario.cantidad.
export const CANTIDAD_MIN = 1;
export const CANTIDAD_MAX = 9999;

// Los ids de carta y de fila de inventario son bigint generated always as
// identity: llegan como number desde la Data API (ver lib/validators/mazos.ts).
const idCarta = z.number().int().positive({ error: "El identificador de la carta no es válido." });
const idFila = z.number().int().positive({ error: "El identificador del registro no es válido." });

const cantidad = z
  .number({ error: "La cantidad debe ser un número." })
  .int({ error: "La cantidad debe ser un número entero." })
  .min(CANTIDAD_MIN, { error: `La cantidad mínima es ${CANTIDAD_MIN}.` })
  .max(CANTIDAD_MAX, { error: `La cantidad máxima es ${CANTIDAD_MAX}.` });

// Qué variantes existen para cada carta lo decide la base (trigger
// inventario_valida_variante); aquí solo se acota la forma del texto.
const variante = z
  .string({ error: "La variante debe ser texto." })
  .trim()
  .min(1, { error: "Se requiere la variante." })
  .max(30, { error: "La variante es demasiado larga." });

export const agregarAlInventarioSchema = z.object({
  cartaId: idCarta,
  variante,
  cantidad,
});

export const cambiarCantidadSchema = z.object({
  id: idFila,
  cantidad,
});

export const eliminarDelInventarioSchema = z.object({
  id: idFila,
});

export const listarInventarioSchema = z.object({
  pagina: z
    .number({ error: "La página debe ser un número." })
    .int({ error: "La página debe ser un número entero." })
    .min(1, { error: "La página mínima es 1." })
    .default(1),
});

export type AgregarAlInventarioInput = z.infer<typeof agregarAlInventarioSchema>;
export type CambiarCantidadInput = z.infer<typeof cambiarCantidadSchema>;
export type EliminarDelInventarioInput = z.infer<typeof eliminarDelInventarioSchema>;
