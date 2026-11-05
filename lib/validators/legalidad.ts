import { z } from "zod";

// Los dos formatos que TCGdex informa por carta (campo "legal").
export const FORMATOS_LEGALIDAD = ["standard", "expanded"] as const;

export type FormatoLegalidad = (typeof FORMATOS_LEGALIDAD)[number];

export const NOMBRES_FORMATO: Record<FormatoLegalidad, string> = {
  standard: "Standard",
  expanded: "Expanded",
};

export const legalidadMazoSchema = z.object({
  mazoId: z
    .number({ error: "El identificador del mazo no es válido." })
    .int({ error: "El identificador del mazo no es válido." })
    .positive({ error: "El identificador del mazo no es válido." }),
  formato: z.enum(FORMATOS_LEGALIDAD, { error: "El formato no es válido." }),
});

export type LegalidadMazoInput = z.infer<typeof legalidadMazoSchema>;

// Respuesta de GET /v2/{idioma}/cards/{id}: solo se lee "legal". El resto no se
// usa ni se confía en ello. Un valor que no sea booleano cuenta como desconocido.
export const respuestaLegalidadTcgdexSchema = z.object({
  legal: z
    .object({
      standard: z.boolean().optional().catch(undefined),
      expanded: z.boolean().optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
});
