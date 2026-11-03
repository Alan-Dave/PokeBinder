import { z } from "zod";

export const FORMATOS_EXPORTACION = ["csv", "xlsx"] as const;

// El formato llega en la URL: solo se aceptan los valores de la lista.
export const exportarInventarioSchema = z.object({
  formato: z.enum(FORMATOS_EXPORTACION, { message: "El formato debe ser csv o xlsx." }).default("csv"),
});
