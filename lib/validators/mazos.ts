import { z } from "zod";

// El id de un mazo es bigint generated always as identity: llega como number
// desde la Data API, igual que el id de una carta (ver lib/validators/imagenes.ts).
export const cruzarMazoSchema = z.object({
  mazoId: z.number().int().positive({ error: "El identificador del mazo no es válido." }),
});

export type CruzarMazoInput = z.infer<typeof cruzarMazoSchema>;
