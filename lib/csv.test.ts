import { describe, expect, it } from "vitest";
import { aCsv, neutralizarFormula } from "./csv";

const BOM = "﻿";

describe("aCsv", () => {
  it("escribe encabezados y filas con BOM y saltos CRLF", () => {
    expect(aCsv(["a", "b"], [["x", 1]])).toBe(`${BOM}a,b\r\nx,1\r\n`);
  });

  it("solo encabezados si no hay filas", () => {
    expect(aCsv(["a"], [])).toBe(`${BOM}a\r\n`);
  });

  it("deja vacías las celdas nulas e indefinidas", () => {
    expect(aCsv(["a", "b", "c"], [[null, undefined, "z"]])).toBe(`${BOM}a,b,c\r\n,,z\r\n`);
  });

  it.each([
    ["coma", "Pikachu, V", '"Pikachu, V"'],
    ["comillas", 'Dijo "hola"', '"Dijo ""hola"""'],
    ["salto de línea", "a\nb", '"a\nb"'],
  ])("entrecomilla un campo con %s", (_, entrada, esperado) => {
    expect(aCsv(["c"], [[entrada]])).toBe(`${BOM}c\r\n${esperado}\r\n`);
  });

  it("conserva tildes y caracteres japoneses", () => {
    expect(aCsv(["n"], [["Pokémon ピカチュウ"]])).toContain("Pokémon ピカチュウ");
  });

  it("no altera un número negativo", () => {
    expect(aCsv(["n"], [[-3]])).toBe(`${BOM}n\r\n-3\r\n`);
  });

  it.each(["=1+1", "+1", "-1", "@SUMA(A1)", "\tx", "\rx"])("neutraliza la fórmula %j", (texto) => {
    const contenido = aCsv(["c"], [[texto]]).slice(BOM.length);
    expect(contenido.startsWith("c\r\n'") || contenido.startsWith('c\r\n"\'')).toBe(true);
  });

  it("neutraliza una fórmula aunque también lleve comas", () => {
    expect(aCsv(["c"], [['=HYPERLINK("http://x","y")']])).toBe(
      `${BOM}c\r\n"'=HYPERLINK(""http://x"",""y"")"\r\n`,
    );
  });
});

describe("neutralizarFormula", () => {
  it("no toca el texto normal", () => {
    expect(neutralizarFormula("Charizard")).toBe("Charizard");
    expect(neutralizarFormula("a=b")).toBe("a=b");
  });
});
