import { describe, expect, it } from "vitest";
import { COLORES_BINDER, colorDeBinder } from "./estilo-binder";

describe("colorDeBinder", () => {
  it("el mismo id siempre da el mismo color", () => {
    expect(colorDeBinder(7)).toBe(colorDeBinder(7));
  });

  it("reparte los ids en los cuatro colores, en orden", () => {
    expect([1, 2, 3, 4, 5].map((id) => colorDeBinder(id).nombre)).toEqual(["azul", "verde", "amarillo", "rojo", "azul"]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])("un id inválido (%s) usa el primer color", (id) => {
    expect(colorDeBinder(id)).toBe(COLORES_BINDER[0]);
  });

  it("ignora el signo y los decimales", () => {
    expect(colorDeBinder(-2)).toBe(colorDeBinder(2));
    expect(colorDeBinder(2.9)).toBe(colorDeBinder(2));
  });

  it("el texto sobre el amarillo es oscuro y sobre el resto blanco (contraste)", () => {
    for (const c of COLORES_BINDER) expect(c.texto).toBe(c.nombre === "amarillo" ? "text-tinta" : "text-white");
  });
});
