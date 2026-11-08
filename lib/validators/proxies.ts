import { z } from "zod";

// El id de un mazo es bigint generated always as identity: llega como number
// (ver lib/validators/mazos.ts).
export const generarProxiesSchema = z.object({
  mazoId: z
    .number({ error: "El identificador del mazo no es válido." })
    .int({ error: "El identificador del mazo no es válido." })
    .positive({ error: "El identificador del mazo no es válido." }),
});

export type GenerarProxiesInput = z.infer<typeof generarProxiesSchema>;
