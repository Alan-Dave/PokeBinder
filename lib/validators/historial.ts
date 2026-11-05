import { z } from "zod";

/**
 * Entradas del historial de precios (PBI-30, RF-10).
 */

export const DIAS_MIN = 7;
export const DIAS_MAX = 365;
export const DIAS_POR_DEFECTO = 90;

export const evolucionSchema = z.object({
  dias: z
    .number({ error: "El período no es válido." })
    .int({ error: "El período no es válido." })
    .min(DIAS_MIN, { error: `El período mínimo es de ${DIAS_MIN} días.` })
    .max(DIAS_MAX, { error: `El período máximo es de ${DIAS_MAX} días.` })
    .default(DIAS_POR_DEFECTO),
});

// Tope de cartas por registro: una página de inventario trae como mucho 30.
export const REGISTROS_MAX = 100;

// Lo que se guarda en precios_historial. Los precios vienen de TCGdex, pero se
// validan igual: el origen de un dato no lo hace confiable.
export const registroPreciosSchema = z
  .array(
    z.object({
      cartaId: z.number().int().positive(),
      acabados: z
        .array(
          z.object({
            acabado: z.string().min(1).max(40),
            mercado: z.number().finite().min(0).max(10_000_000),
          }),
        )
        .max(10),
    }),
  )
  .max(REGISTROS_MAX);

// Fila de precios_historial tal como la devuelve la API (numeric puede llegar
// como texto según el cliente).
export const filaHistorialSchema = z.object({
  carta_id: z.coerce.number().int().positive(),
  acabado: z.string(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mercado: z.coerce.number().finite().min(0),
});

export const filaInventarioValorSchema = z.object({
  carta_id: z.coerce.number().int().positive(),
  variante: z.string(),
  cantidad: z.coerce.number().int().positive(),
});
