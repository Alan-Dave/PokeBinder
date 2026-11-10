import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { aXlsx } from "./xlsx";

async function leer(bytes: Uint8Array) {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(bytes as unknown as ArrayBuffer);
  return libro;
}

describe("aXlsx", () => {
  it("escribe la hoja con encabezados en negrita y las filas", async () => {
    const libro = await leer(await aXlsx("Inventario", ["Nombre", "Cantidad"], [["Pikachu", 2]]));
    const hoja = libro.getWorksheet("Inventario")!;

    expect(hoja.getRow(1).values).toEqual([undefined, "Nombre", "Cantidad"]);
    expect(hoja.getRow(1).font?.bold).toBe(true);
    expect(hoja.getRow(2).values).toEqual([undefined, "Pikachu", 2]);
  });

  it("deja vacías las celdas nulas", async () => {
    const hoja = (await leer(await aXlsx("H", ["a", "b"], [[null, undefined]]))).getWorksheet("H")!;

    expect(hoja.getCell("A2").value).toBeNull();
    expect(hoja.getCell("B2").value).toBeNull();
  });

  it("guarda un texto que parece fórmula como texto, no como fórmula", async () => {
    const hoja = (await leer(await aXlsx("H", ["c"], [["=1+1"]]))).getWorksheet("H")!;

    expect(hoja.getCell("A2").value).toBe("=1+1");
    expect(hoja.getCell("A2").formula).toBeUndefined();
  });

  it("limita el ancho de columna", async () => {
    const hoja = (await leer(await aXlsx("H", ["c"], [["x".repeat(500)]]))).getWorksheet("H")!;

    expect(hoja.getColumn(1).width).toBe(50);
  });
});
