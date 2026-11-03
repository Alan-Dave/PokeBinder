import { z } from "zod";
import { formatoExportacion } from "@/lib/validators/exportar";
import { idioma, opcional, rareza, setId } from "@/lib/validators/filtros";

export const faltantesSchema = z.object({
  setId,
  idioma,
  // Filtra las cartas del set que se comparan; vacío = todas.
  rareza: opcional(rareza),
});

export const exportarFaltantesSchema = faltantesSchema.extend({
  formato: formatoExportacion,
});

export type FaltantesInput = z.infer<typeof faltantesSchema>;
