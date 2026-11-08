import { describe, expect, it } from "vitest";
import {
  PAGINA_PANEL_MAX,
  panelColeccionSchema,
  parametrosDePanel,
  TEXTO_PANEL_MAX,
} from "./panel-coleccion";

describe("panelColeccionSchema", () => {
  it("sin nada usa búsqueda vacía y la página 1", () => {
    expect(panelColeccionSchema.parse({})).toEqual({ texto: "", pagina: 1 });
  });

  it("acepta todos los filtros y recorta el texto", () => {
    expect(panelColeccionSchema.parse({ texto: "  Sylveon ", categoriaId: 4, pagina: 3 })).toEqual({
      texto: "Sylveon",
      categoriaId: 4,
      pagina: 3,
    });
  });

  it("acepta el largo máximo y la última página", () => {
    expect(panelColeccionSchema.safeParse({ texto: "x".repeat(TEXTO_PANEL_MAX) }).success).toBe(true);
    expect(panelColeccionSchema.safeParse({ pagina: PAGINA_PANEL_MAX }).success).toBe(true);
  });

  it.each([
    ["texto demasiado largo", { texto: "x".repeat(TEXTO_PANEL_MAX + 1) }],
    ["texto que no es texto", { texto: 5 }],
    ["categoría cero", { categoriaId: 0 }],
    ["categoría negativa", { categoriaId: -3 }],
    ["categoría decimal", { categoriaId: 1.5 }],
    ["categoría NaN", { categoriaId: Number.NaN }],
    ["categoría en texto", { categoriaId: "1 OR 1=1" }],
    ["página cero", { pagina: 0 }],
    ["página decimal", { pagina: 1.5 }],
    ["página sobre el máximo", { pagina: PAGINA_PANEL_MAX + 1 }],
    ["página NaN", { pagina: Number.NaN }],
  ])("rechaza %s", (_, entrada) => {
    expect(panelColeccionSchema.safeParse(entrada).success).toBe(false);
  });
});

describe("parametrosDePanel", () => {
  it("sin parámetros da la búsqueda vacía en la página 1", () => {
    expect(parametrosDePanel(new URLSearchParams())).toEqual({ texto: "", categoriaId: undefined, pagina: 1 });
  });

  it("convierte la categoría y la página a número", () => {
    const r = parametrosDePanel(new URLSearchParams("texto=eon&categoria=7&pagina=2"));

    expect(r).toEqual({ texto: "eon", categoriaId: 7, pagina: 2 });
  });

  it("los parámetros vacíos cuentan como ausentes", () => {
    const r = parametrosDePanel(new URLSearchParams("categoria=&pagina="));

    expect(r).toEqual({ texto: "", categoriaId: undefined, pagina: 1 });
  });

  it.each(["abc", "1 OR 1=1", "../x", "0x10x"])("un número manipulado (%s) llega como NaN y el esquema lo rechaza", (valor) => {
    const categoria = parametrosDePanel(new URLSearchParams({ categoria: valor }));
    const pagina = parametrosDePanel(new URLSearchParams({ pagina: valor }));

    expect(panelColeccionSchema.safeParse(categoria).success).toBe(false);
    expect(panelColeccionSchema.safeParse(pagina).success).toBe(false);
  });
});
