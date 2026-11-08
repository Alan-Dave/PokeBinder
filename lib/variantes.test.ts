import { describe, expect, it } from "vitest";
import {
  VARIANTES,
  clasificarVariantes,
  describirVariantes,
  esVariante,
  etiquetaVariante,
  ordenarVariantes,
} from "./variantes";

describe("esVariante", () => {
  it("reconoce las variantes del catálogo", () => {
    expect(VARIANTES.every(esVariante)).toBe(true);
  });

  it("distingue mayúsculas y rechaza lo desconocido", () => {
    expect(esVariante("Holo")).toBe(false);
    expect(esVariante("")).toBe(false);
    expect(esVariante("toString")).toBe(false);
    expect(esVariante("__proto__")).toBe(false);
  });
});

describe("etiquetaVariante", () => {
  it("devuelve el nombre en español", () => {
    expect(etiquetaVariante("reverse")).toBe("Reverse holo");
    expect(etiquetaVariante("firstEdition")).toBe("Primera edición");
  });

  it("muestra tal cual una variante desconocida", () => {
    expect(etiquetaVariante("stamped")).toBe("stamped");
    expect(etiquetaVariante("constructor")).toBe("constructor");
  });
});

describe("clasificarVariantes", () => {
  it("ordena las conocidas con el orden fijo, sin importar cómo lleguen", () => {
    expect(clasificarVariantes(["holo", "normal", "reverse"]).conocidas).toEqual([
      "normal",
      "reverse",
      "holo",
    ]);
  });

  it("separa las desconocidas y las ordena alfabéticamente", () => {
    expect(clasificarVariantes(["zeta", "holo", "alfa"])).toEqual({
      conocidas: ["holo"],
      desconocidas: ["alfa", "zeta"],
    });
  });

  it("quita repetidas, espacios y vacías", () => {
    expect(clasificarVariantes(["holo", " holo ", "", "  ", "holo"])).toEqual({
      conocidas: ["holo"],
      desconocidas: [],
    });
  });

  it("acepta una lista vacía", () => {
    expect(clasificarVariantes([])).toEqual({ conocidas: [], desconocidas: [] });
  });

  it("no modifica la lista de entrada", () => {
    const entrada = ["holo", "normal"];
    clasificarVariantes(entrada);
    expect(entrada).toEqual(["holo", "normal"]);
  });
});

describe("ordenarVariantes", () => {
  it("pone primero las conocidas y después las desconocidas", () => {
    expect(ordenarVariantes(["x", "holo", "normal"])).toEqual(["normal", "holo", "x"]);
  });
});

describe("describirVariantes", () => {
  it("une las etiquetas en orden", () => {
    expect(describirVariantes(["holo", "normal", "reverse"])).toBe("Normal, Reverse holo, Holo");
  });

  it("usa el texto de reemplazo cuando no hay variantes", () => {
    expect(describirVariantes([])).toBe("Ninguna");
    expect(describirVariantes([], "Sin variantes")).toBe("Sin variantes");
  });
});
