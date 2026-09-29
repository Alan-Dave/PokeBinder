import { describe, expect, it } from "vitest";
import { obtenerUrlsImagenesSchema } from "./imagenes";

describe("obtenerUrlsImagenesSchema", () => {
  it("acepta una lista de ids válida", () => {
    const entrada = { cartaIds: [1, 2, 3] };
    expect(obtenerUrlsImagenesSchema.parse(entrada)).toEqual(entrada);
  });

  it("acepta hasta 30 ids", () => {
    const entrada = { cartaIds: Array.from({ length: 30 }, (_, i) => i + 1) };
    expect(obtenerUrlsImagenesSchema.safeParse(entrada).success).toBe(true);
  });

  it("rechaza más de 30 ids", () => {
    const entrada = { cartaIds: Array.from({ length: 31 }, (_, i) => i + 1) };
    expect(obtenerUrlsImagenesSchema.safeParse(entrada).success).toBe(false);
  });

  it("rechaza una lista vacía", () => {
    expect(obtenerUrlsImagenesSchema.safeParse({ cartaIds: [] }).success).toBe(false);
  });

  it("rechaza ids no positivos", () => {
    expect(obtenerUrlsImagenesSchema.safeParse({ cartaIds: [0] }).success).toBe(false);
    expect(obtenerUrlsImagenesSchema.safeParse({ cartaIds: [-1] }).success).toBe(false);
  });

  it("rechaza ids no enteros, útil contra inyección vía tipo", () => {
    expect(obtenerUrlsImagenesSchema.safeParse({ cartaIds: [1.5] }).success).toBe(false);
    expect(obtenerUrlsImagenesSchema.safeParse({ cartaIds: ["1 OR 1=1"] }).success).toBe(false);
  });
});
