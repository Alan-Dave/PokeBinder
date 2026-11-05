import ExcelJS from "exceljs";
import type { CeldaCsv } from "@/lib/csv";

/**
 * Serialización a Excel (.xlsx) para PBI-22. No toca la base ni la red.
 *
 * Los valores se escriben siempre como texto o número, nunca como objetos
 * `{ formula }`: ExcelJS los guarda como datos, así que un nombre como
 * «=1+1» queda como texto y no se ejecuta (a diferencia del CSV, que debe
 * neutralizarlo, ver lib/csv.ts).
 */

export async function aXlsx(
  hoja: string,
  encabezados: readonly string[],
  filas: readonly (readonly CeldaCsv[])[],
): Promise<Uint8Array> {
  const libro = new ExcelJS.Workbook();
  const pagina = libro.addWorksheet(hoja);
  pagina.addRow([...encabezados]).font = { bold: true };
  for (const fila of filas) pagina.addRow(fila.map((valor) => valor ?? null));
  // Ancho según el contenido, con tope, para que se lea sin ajustar a mano.
  pagina.columns.forEach((columna, i) => {
    const largo = Math.max(encabezados[i].length, ...filas.map((f) => String(f[i] ?? "").length));
    columna.width = Math.min(Math.max(largo + 2, 10), 50);
  });
  return new Uint8Array(await libro.xlsx.writeBuffer());
}
