import { z } from "zod";
import { IDIOMAS } from "@/lib/validators/catalogo";
import { formatoExportacion } from "@/lib/validators/exportar";

// Id de set tal como lo guarda el catálogo (sv1, swsh12pt5, base1, TG...):
// letras, dígitos y separadores comunes, hasta el límite de public.sets.id.
const setId = z
  .string({ error: "El set debe ser texto." })
  .trim()
  .min(1, { error: "Se requiere el set." })
  .max(30, { error: "El set es demasiado largo." })
  .regex(/^[A-Za-z0-9._-]+$/, { error: "El set solo puede tener letras, números, punto, guion y guion bajo." });

export const faltantesSchema = z.object({
  setId,
  idioma: z.enum(IDIOMAS, { error: "El idioma no es válido." }),
});

export const exportarFaltantesSchema = faltantesSchema.extend({
  formato: formatoExportacion,
});

export type FaltantesInput = z.infer<typeof faltantesSchema>;
