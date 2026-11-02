import { z } from "zod";

// El catálogo pagina de 30 en 30 (ver CLAUDE.md): no tiene sentido pedir más
// URLs firmadas que cartas caben en una página.
export const obtenerUrlsImagenesSchema = z.object({
  cartaIds: z
    .array(z.number().int().positive())
    .min(1, "Se requiere al menos un id de carta.")
    .max(30, "No se pueden pedir más de 30 imágenes a la vez."),
});

export type ObtenerUrlsImagenesInput = z.infer<typeof obtenerUrlsImagenesSchema>;
