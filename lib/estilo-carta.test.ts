import { describe, expect, it } from "vitest";
import { estiloDeTipo } from "./estilo-carta";

describe("estiloDeTipo", () => {
  it("reconoce los tipos en inglés sin importar mayúsculas ni espacios", () => {
    expect(estiloDeTipo("Grass").chip).toContain("bg-verde");
    expect(estiloDeTipo(" FIRE ").chip).toContain("bg-rojo");
    expect(estiloDeTipo("water").chip).toContain("bg-azul");
  });

  it("reconoce los nombres en español, con o sin tilde", () => {
    expect(estiloDeTipo("Planta")).toEqual(estiloDeTipo("Grass"));
    expect(estiloDeTipo("Eléctrico")).toEqual(estiloDeTipo("Lightning"));
    expect(estiloDeTipo("Psíquico")).toEqual(estiloDeTipo("Psychic"));
    expect(estiloDeTipo("Metálico")).toEqual(estiloDeTipo("Metal"));
    expect(estiloDeTipo("Dragón")).toEqual(estiloDeTipo("Dragon"));
  });

  it("usa el estilo neutro para un tipo desconocido, vacío o ausente", () => {
    const neutro = estiloDeTipo("Incoloro");
    expect(estiloDeTipo("Tipo inventado")).toEqual(neutro);
    expect(estiloDeTipo("")).toEqual(neutro);
    expect(estiloDeTipo(null)).toEqual(neutro);
    expect(estiloDeTipo(undefined)).toEqual(neutro);
  });

  it("no se deja engañar por nombres de propiedades de objetos", () => {
    expect(estiloDeTipo("constructor")).toEqual(estiloDeTipo(null));
    expect(estiloDeTipo("__proto__")).toEqual(estiloDeTipo(null));
  });

  it("el texto de cada etiqueta es blanco o tinta, nunca otro color", () => {
    for (const tipo of [
      "Grass",
      "Fire",
      "Water",
      "Lightning",
      "Psychic",
      "Fighting",
      "Darkness",
      "Metal",
      "Dragon",
      "Fairy",
    ]) {
      expect(estiloDeTipo(tipo).chip).toMatch(/text-(white|tinta)/);
    }
  });
});
