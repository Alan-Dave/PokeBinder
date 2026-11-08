import { describe, expect, it } from "vitest";
import { construirArchivo } from "./archivo";

describe("construirArchivo", () => {
  it("arma un CSV con su tipo y la extensión", async () => {
    const a = await construirArchivo("csv", "informe", "Hoja", ["a"], [["x"]]);

    expect(a.nombre).toBe("informe.csv");
    expect(a.tipo).toBe("text/csv; charset=utf-8");
    expect(a.contenido).toContain("a\r\nx");
  });

  it("arma un xlsx (ZIP, firma PK) con su tipo y la extensión", async () => {
    const a = await construirArchivo("xlsx", "informe", "Hoja", ["a"], [["x"]]);

    expect(a.nombre).toBe("informe.xlsx");
    expect(a.tipo).toContain("spreadsheetml.sheet");
    expect((a.contenido as Uint8Array).slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));
  });
});
