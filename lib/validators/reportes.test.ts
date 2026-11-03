import { describe, expect, it } from "vitest";
import { exportarFaltantesSchema, faltantesSchema } from "./reportes";

describe("faltantesSchema", () => {
  it.each(["sv1", "swsh12pt5", "base1", "TG", "sv3.5", "a-b_c"])("acepta el set %s", (setId) => {
    expect(faltantesSchema.parse({ setId, idioma: "en" })).toEqual({ setId, idioma: "en" });
  });

  it("recorta espacios del set", () => {
    expect(faltantesSchema.parse({ setId: "  sv1 ", idioma: "es" }).setId).toBe("sv1");
  });

  it.each([
    ["vacío", ""],
    ["solo espacios", "   "],
    ["demasiado largo", "a".repeat(31)],
    ["con espacio interno", "sv 1"],
    ["inyección SQL", "x' OR '1'='1"],
    ["comodín de filtro", "sv1,idioma.eq.es"],
    ["ruta", "../x"],
    ["comillas", 'a"b'],
    ["número", 1],
    ["nulo", null],
  ])("rechaza un set %s", (_, setId) => {
    expect(faltantesSchema.safeParse({ setId, idioma: "en" }).success).toBe(false);
  });

  it.each(["", "xx", "EN", 1, undefined])("rechaza el idioma %j", (idioma) => {
    const r = faltantesSchema.safeParse({ setId: "sv1", idioma });
    expect(r.success).toBe(false);
  });

  it("rechaza la entrada ausente", () => {
    expect(faltantesSchema.safeParse({}).success).toBe(false);
  });
});

describe("exportarFaltantesSchema", () => {
  it("usa csv por defecto", () => {
    expect(exportarFaltantesSchema.parse({ setId: "sv1", idioma: "en" }).formato).toBe("csv");
  });

  it("acepta xlsx y rechaza otros formatos", () => {
    expect(exportarFaltantesSchema.parse({ setId: "sv1", idioma: "en", formato: "xlsx" }).formato).toBe("xlsx");
    expect(exportarFaltantesSchema.safeParse({ setId: "sv1", idioma: "en", formato: "pdf" }).success).toBe(false);
  });
});
