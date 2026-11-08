import { z } from "zod";

/**
 * Entradas de la imagen en alta definición (PBI-x2).
 *
 * El navegador solo manda el id numérico de la carta. El id_api y el idioma
 * salen de nuestra base; aun así se vuelven a validar antes de armar una URL
 * hacia un servicio externo: el origen de un dato no lo hace confiable.
 */

// Ruta /api/cartas/123/imagen-hd. Solo dígitos, de 1 a 15 y sin ceros a la
// izquierda: Number() aceptaría "1e3" o "0x10".
export const idCartaImagenSchema = z
  .string({ error: "El id de la carta debe ser texto." })
  .regex(/^[1-9]\d{0,14}$/, { error: "El id de la carta no es válido." })
  .transform(Number);

// Tamaño pedido en /imagen-hd?tam=. "min" es la miniatura del catálogo (~18 KB);
// sin parámetro se sirve la grande, como antes. Lista cerrada: cualquier otro
// valor se rechaza, nunca se arma una URL con él.
export const TAMANOS_IMAGEN = ["min", "hd"] as const;

export type TamanoImagen = (typeof TAMANOS_IMAGEN)[number];

export const tamanoImagenSchema = z
  .enum(TAMANOS_IMAGEN, { error: "El tamaño de la imagen no es válido." })
  .default("hd");

// Forma de los id de TCGdex y de nuestro id_api: "base1-4", "swsh3-136",
// "sv3pt5-1". Un guion, letras, dígitos y puntos; nada que pueda salirse de
// la ruta (sin "/", "?", "#", "%" ni "..").
export const idApiSchema = z
  .string()
  .max(50)
  .regex(/^[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*-[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*$/, {
    error: "El id_api no tiene un formato válido.",
  });

// Idiomas del catálogo que TCGdex entiende con el mismo código. El chino
// ("zh") no existe en TCGdex con ese código: esas cartas caen al inglés.
export const IDIOMAS_TCGDEX = ["en", "es", "fr", "pt", "ja"] as const;

export type IdiomaTcgdex = (typeof IDIOMAS_TCGDEX)[number];

export function esIdiomaTcgdex(idioma: string): idioma is IdiomaTcgdex {
  return (IDIOMAS_TCGDEX as readonly string[]).includes(idioma);
}

// Respuesta de GET /v2/{idioma}/cards/{id}: solo se lee "image". El resto no
// se usa ni se confía en ello.
export const respuestaCartaTcgdexSchema = z.object({
  image: z.string().max(300).optional(),
});
