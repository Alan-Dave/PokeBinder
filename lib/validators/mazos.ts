import { z } from "zod";

// El id de un mazo es bigint generated always as identity: llega como number
// desde la Data API, igual que el id de una carta (ver lib/validators/imagenes.ts).
const mazoId = z
  .number({ error: "El identificador del mazo no es válido." })
  .int({ error: "El identificador del mazo no es válido." })
  .positive({ error: "El identificador del mazo no es válido." });

const cartaId = z
  .number({ error: "El identificador de la carta no es válido." })
  .int({ error: "El identificador de la carta no es válido." })
  .positive({ error: "El identificador de la carta no es válido." });

// Mismo rango que el check de public.mazo_cartas.cantidad.
export const CANTIDAD_MAZO_MIN = 1;
export const CANTIDAD_MAZO_MAX = 60;

export const NOMBRE_MAZO_MAX = 60;

export const cruzarMazoSchema = z.object({
  mazoId: z.number().int().positive({ error: "El identificador del mazo no es válido." }),
});

export type CruzarMazoInput = z.infer<typeof cruzarMazoSchema>;

export const crearMazoSchema = z.object({
  nombre: z
    .string({ error: "El nombre del mazo es obligatorio." })
    .trim()
    .min(1, { error: "El nombre del mazo es obligatorio." })
    .max(NOMBRE_MAZO_MAX, { error: `El nombre del mazo admite hasta ${NOMBRE_MAZO_MAX} caracteres.` }),
});

export const obtenerMazoSchema = z.object({ mazoId });

export const eliminarMazoSchema = z.object({ mazoId });

export const agregarCartaAlMazoSchema = z.object({ mazoId, cartaId });

export const fijarCantidadEnMazoSchema = z.object({
  mazoId,
  cartaId,
  cantidad: z
    .number({ error: "La cantidad debe ser un número." })
    .int({ error: "La cantidad debe ser un número entero." })
    .min(CANTIDAD_MAZO_MIN, { error: `La cantidad mínima es ${CANTIDAD_MAZO_MIN}.` })
    .max(CANTIDAD_MAZO_MAX, { error: `La cantidad máxima es ${CANTIDAD_MAZO_MAX}.` }),
});

export const quitarDelMazoSchema = z.object({ mazoId, cartaId });
