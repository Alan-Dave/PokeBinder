import { describe, expect, it } from "vitest";
import { calcularCobertura } from "./cobertura";

describe("calcularCobertura", () => {
  it("marca la carta como cubierta cuando el inventario alcanza exacto", () => {
    const resultado = calcularCobertura(
      [{ carta_id: 1, cantidad: 4 }],
      [{ carta_id: 1, cantidad: 4 }],
    );
    expect(resultado).toEqual([
      { carta_id: 1, en_mazo: 4, en_inventario: 4, cubierta: true, faltante: 0 },
    ]);
  });

  it("marca la carta como no cubierta y calcula cuánto falta", () => {
    const resultado = calcularCobertura(
      [{ carta_id: 1, cantidad: 4 }],
      [{ carta_id: 1, cantidad: 1 }],
    );
    expect(resultado[0]).toEqual({
      carta_id: 1,
      en_mazo: 4,
      en_inventario: 1,
      cubierta: false,
      faltante: 3,
    });
  });

  it("una carta que no está en el inventario cuenta como 0 disponible", () => {
    const resultado = calcularCobertura([{ carta_id: 1, cantidad: 2 }], []);
    expect(resultado[0]).toEqual({
      carta_id: 1,
      en_mazo: 2,
      en_inventario: 0,
      cubierta: false,
      faltante: 2,
    });
  });

  it("tener de más en el inventario no cuenta como faltante negativo", () => {
    const resultado = calcularCobertura(
      [{ carta_id: 1, cantidad: 1 }],
      [{ carta_id: 1, cantidad: 10 }],
    );
    expect(resultado[0].faltante).toBe(0);
    expect(resultado[0].cubierta).toBe(true);
  });

  it("procesa varias cartas de forma independiente", () => {
    const resultado = calcularCobertura(
      [
        { carta_id: 1, cantidad: 2 },
        { carta_id: 2, cantidad: 3 },
      ],
      [{ carta_id: 1, cantidad: 2 }],
    );
    expect(resultado).toHaveLength(2);
    expect(resultado.find((c) => c.carta_id === 1)?.cubierta).toBe(true);
    expect(resultado.find((c) => c.carta_id === 2)?.cubierta).toBe(false);
  });

  it("un mazo vacío da una lista vacía", () => {
    expect(calcularCobertura([], [{ carta_id: 1, cantidad: 5 }])).toEqual([]);
  });
});
