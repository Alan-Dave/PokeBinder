import { describe, expect, it } from "vitest";
import { filtrosInventarioSchema } from "./filtros";
import { faltantesSchema } from "./reportes";

describe("filtrosInventarioSchema", () => {
  it("acepta la ausencia de filtros", () => {
    expect(filtrosInventarioSchema.parse({})).toEqual({});
  });

  it("trata vacío y solo espacios como sin filtro", () => {
    expect(filtrosInventarioSchema.parse({ idioma: "", setId: "  ", rareza: "\t" })).toEqual({});
  });

  it("acepta y recorta los filtros válidos", () => {
    expect(filtrosInventarioSchema.parse({ idioma: "es", setId: " sv1 ", rareza: " Rare " })).toEqual({
      idioma: "es",
      setId: "sv1",
      rareza: "Rare",
    });
  });

  it.each([
    ["idioma inexistente", { idioma: "xx" }],
    ["idioma con mayúsculas", { idioma: "EN" }],
    ["set con inyección", { setId: "x' OR '1'='1" }],
    ["set con coma de filtro", { setId: "sv1,idioma.eq.es" }],
    ["set demasiado largo", { setId: "a".repeat(31) }],
    ["rareza demasiado larga", { rareza: "a".repeat(61) }],
    ["rareza que no es texto", { rareza: 5 }],
  ])("rechaza %s", (_, entrada) => {
    expect(filtrosInventarioSchema.safeParse(entrada).success).toBe(false);
  });
});

describe("faltantesSchema con rareza", () => {
  it("la rareza es opcional", () => {
    expect(faltantesSchema.parse({ setId: "sv1", idioma: "en" })).toEqual({ setId: "sv1", idioma: "en" });
    expect(faltantesSchema.parse({ setId: "sv1", idioma: "en", rareza: "" })).toEqual({ setId: "sv1", idioma: "en" });
  });

  it("acepta una rareza y rechaza una demasiado larga", () => {
    expect(faltantesSchema.parse({ setId: "sv1", idioma: "en", rareza: "Rare" }).rareza).toBe("Rare");
    expect(faltantesSchema.safeParse({ setId: "sv1", idioma: "en", rareza: "a".repeat(61) }).success).toBe(false);
  });
});
