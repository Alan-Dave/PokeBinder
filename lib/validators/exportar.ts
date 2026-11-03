import { z } from "zod";
import { filtrosInventarioSchema } from "@/lib/validators/filtros";

export const FORMATOS_EXPORTACION = ["csv", "xlsx"] as const;

export type FormatoExportacion = (typeof FORMATOS_EXPORTACION)[number];

// El formato llega en la URL: solo se aceptan los valores de la lista.
export const formatoExportacion = z
  .enum(FORMATOS_EXPORTACION, { message: "El formato debe ser csv o xlsx." })
  .default("csv");

// Además del formato, la exportación acepta los mismos filtros que el reporte.
export const exportarInventarioSchema = filtrosInventarioSchema.extend({
  formato: formatoExportacion,
});
