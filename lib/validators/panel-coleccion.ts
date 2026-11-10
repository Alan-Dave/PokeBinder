import { z } from "zod";

// Una página del panel: el mismo tamaño que el catálogo y que el tope de
// imágenes que se piden a la vez (ver lib/validators/imagenes.ts).
export const TAMANO_PANEL = 30;
export const TEXTO_PANEL_MAX = 50;
// Tope de páginas: acota cuánto puede recorrer una sola petición manipulada.
export const PAGINA_PANEL_MAX = 1000;

export const panelColeccionSchema = z.object({
  texto: z
    .string({ error: "La búsqueda debe ser texto." })
    .trim()
    .max(TEXTO_PANEL_MAX, { error: `La búsqueda admite hasta ${TEXTO_PANEL_MAX} caracteres.` })
    .default(""),
  categoriaId: z
    .number({ error: "La categoría no es válida." })
    .int({ error: "La categoría no es válida." })
    .positive({ error: "La categoría no es válida." })
    .optional(),
  pagina: z
    .number({ error: "La página debe ser un número." })
    .int({ error: "La página debe ser un número entero." })
    .min(1, { error: "La página mínima es 1." })
    .max(PAGINA_PANEL_MAX, { error: `La página máxima es ${PAGINA_PANEL_MAX}.` })
    .default(1),
});

export type PanelColeccionInput = z.infer<typeof panelColeccionSchema>;

/**
 * Convierte los parámetros de la URL (siempre texto) en la entrada del esquema.
 * Un texto que no es número queda como NaN y el esquema lo rechaza: nunca se
 * "arregla" una entrada rara en silencio.
 */
export function parametrosDePanel(params: URLSearchParams): unknown {
  const categoria = params.get("categoria");
  const pagina = params.get("pagina");
  return {
    texto: params.get("texto") ?? "",
    categoriaId: categoria === null || categoria === "" ? undefined : Number(categoria),
    pagina: pagina === null || pagina === "" ? 1 : Number(pagina),
  };
}
