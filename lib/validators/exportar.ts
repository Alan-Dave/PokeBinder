import { z } from "zod";

export const FORMATOS_EXPORTACION = ["csv", "xlsx"] as const;

export type FormatoExportacion = (typeof FORMATOS_EXPORTACION)[number];

// El formato llega en la URL: solo se aceptan los valores de la lista.
export const formatoExportacion = z
  .enum(FORMATOS_EXPORTACION, { message: "El formato debe ser csv o xlsx." })
  .default("csv");

export const exportarInventarioSchema = z.object({
  formato: formatoExportacion,
});
