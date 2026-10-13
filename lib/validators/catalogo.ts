import { z } from "zod";

// Mismos idiomas que acepta la ingesta (ingesta/migrar_catalogo.py).
export const IDIOMAS = ["en", "es", "fr", "pt", "ja", "zh"] as const;

export type Idioma = (typeof IDIOMAS)[number];

// Un campo vacío del formulario llega como "": equivale a "sin filtro".
const opcional = <T extends z.ZodType>(esquema: T) =>
  z.preprocess((valor) => (valor === "" ? undefined : valor), esquema.optional());

export const buscarCatalogoSchema = z.object({
  texto: opcional(
    z
      .string({ error: "La búsqueda debe ser texto." })
      .trim()
      .max(50, { error: "La búsqueda es demasiado larga." }),
  ),
  idioma: opcional(z.enum(IDIOMAS, { error: "El idioma no es válido." })),
  tipo: opcional(z.string({ error: "El tipo debe ser texto." }).trim().max(40)),
  rareza: opcional(z.string({ error: "La rareza debe ser texto." }).trim().max(60)),
  pagina: z
    .number({ error: "La página debe ser un número." })
    .int({ error: "La página debe ser un número entero." })
    .min(1, { error: "La página mínima es 1." })
    .default(1),
});

export type BuscarCatalogoInput = z.infer<typeof buscarCatalogoSchema>;

/**
 * Convierte lo que escribió el usuario en el patrón de una búsqueda por
 * prefijo (LIKE 'texto%'), sobre la columna nombre_busqueda (en minúsculas).
 *
 * En LIKE, % y _ son comodines y \ es el carácter de escape: si el texto del
 * usuario los trajera sin tratar, "50%" o "_" cambiarían el significado de la
 * búsqueda. Se escapan para que cuenten como letras. El asterisco se elimina
 * porque la API de PostgREST lo convierte en comodín por su cuenta.
 *
 * Esto no es defensa contra inyección SQL (el valor viaja como parámetro, no
 * concatenado), sino para que la búsqueda haga lo que el usuario escribió.
 */
export function patronPrefijo(texto: string): string {
  const limpio = texto.trim().toLowerCase().replaceAll("*", "");
  return `${limpio.replace(/[\\%_]/g, "\\$&")}%`;
}
