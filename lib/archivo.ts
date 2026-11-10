import { aCsv, type CeldaCsv } from "@/lib/csv";
import type { FormatoExportacion } from "@/lib/validators/exportar";
import { aXlsx } from "@/lib/xlsx";

/** Archivo listo para descargar: lo comparten todas las exportaciones. */
export type Archivo = { contenido: string | Uint8Array; tipo: string; nombre: string };

/**
 * Convierte una tabla al formato pedido. `nombre` va sin extensión: la pone el
 * formato. Nunca recibe texto del usuario como nombre de archivo.
 */
export async function construirArchivo(
  formato: FormatoExportacion,
  nombre: string,
  hoja: string,
  encabezados: readonly string[],
  filas: readonly (readonly CeldaCsv[])[],
): Promise<Archivo> {
  if (formato === "xlsx") {
    return {
      contenido: await aXlsx(hoja, encabezados, filas),
      tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      nombre: `${nombre}.xlsx`,
    };
  }
  return { contenido: aCsv(encabezados, filas), tipo: "text/csv; charset=utf-8", nombre: `${nombre}.csv` };
}
