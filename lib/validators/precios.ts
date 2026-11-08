import { z } from "zod";
import { idApiSchema } from "@/lib/validators/imagen-hd";

/**
 * Precios del mercado secundario (PBI-29, RF-07).
 *
 * La fuente es el campo "pricing.tcgplayer" que TCGdex publica por carta, en
 * dólares. No se convierte ninguna moneda: lo que se muestra es lo que informa
 * la fuente, con su fecha.
 */

// Tope de cartas distintas por consulta: coincide con una página de inventario.
export const CARTAS_PRECIO_MAX = 30;

export const cartaPrecioSchema = z.object({
  idApi: idApiSchema,
  idioma: z.string().max(10),
});

export const preciosCartasSchema = z
  .array(cartaPrecioSchema, { error: "La lista de cartas no es válida." })
  .max(CARTAS_PRECIO_MAX, { error: `Se pueden consultar hasta ${CARTAS_PRECIO_MAX} cartas a la vez.` });

export type CartaPrecio = z.infer<typeof cartaPrecioSchema>;

// Un precio válido es un número finito, no negativo y con un tope razonable;
// cualquier otra cosa (texto, null, negativo) cuenta como "sin precio".
const dinero = z.number().finite().min(0).max(10_000_000).optional().catch(undefined);

const acabado = z.object({ marketPrice: dinero }).passthrough().optional().catch(undefined);

// Respuesta de GET /v2/{idioma}/cards/{id}: solo se lee pricing.tcgplayer.
export const respuestaPreciosTcgdexSchema = z.object({
  pricing: z
    .object({
      tcgplayer: z
        .object({
          unit: z.string().optional().catch(undefined),
          updated: z.string().max(40).optional().catch(undefined),
        })
        .catchall(acabado)
        .optional()
        .catch(undefined),
    })
    .optional()
    .catch(undefined),
});
