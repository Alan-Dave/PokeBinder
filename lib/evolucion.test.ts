import { describe, expect, it } from "vitest";
import { calcularEvolucion, type PuntoPrecio } from "./evolucion";

const p = (cartaId: number, fecha: string, mercado: number, acabado = "normal"): PuntoPrecio => ({
  cartaId,
  acabado,
  fecha,
  mercado,
});
const fila = (cartaId: number, cantidad = 1, variante = "normal") => ({ cartaId, variante, cantidad });

describe("calcularEvolucion", () => {
  it("suma precio por cantidad en cada fecha", () => {
    const r = calcularEvolucion(
      [fila(1, 2), fila(2, 1)],
      [p(1, "2026-11-01", 1), p(1, "2026-11-02", 2), p(2, "2026-11-01", 10), p(2, "2026-11-02", 10)],
    );

    expect(r.puntos).toEqual([
      { fecha: "2026-11-01", valor: 12 },
      { fecha: "2026-11-02", valor: 14 },
    ]);
    expect(r).toMatchObject({ filasValuadas: 2, filasSinPrecio: 0 });
  });

  it("arrastra el último precio conocido cuando una carta no tiene registro ese día", () => {
    const r = calcularEvolucion(
      [fila(1), fila(2)],
      [p(1, "2026-11-01", 1), p(2, "2026-11-01", 5), p(1, "2026-11-03", 3)],
    );

    expect(r.puntos.map((x) => x.valor)).toEqual([6, 8]);
  });

  it("empieza cuando todas las cartas ya tienen precio, para no simular un alza", () => {
    const r = calcularEvolucion(
      [fila(1), fila(2)],
      [p(1, "2026-11-01", 1), p(1, "2026-11-02", 1), p(2, "2026-11-02", 5)],
    );

    expect(r.puntos).toEqual([{ fecha: "2026-11-02", valor: 6 }]);
  });

  it("no suma errores de punto flotante", () => {
    const r = calcularEvolucion([fila(1, 3), fila(2)], [p(1, "2026-11-01", 0.1), p(2, "2026-11-01", 0.2)]);

    expect(r.puntos[0].valor).toBe(0.5);
  });

  it("separa por acabado según la variante del inventario", () => {
    const r = calcularEvolucion(
      [fila(1, 1, "holo")],
      [p(1, "2026-11-01", 1, "normal"), p(1, "2026-11-01", 50, "holofoil")],
    );

    expect(r.puntos[0].valor).toBe(50);
  });

  it("cuenta aparte las filas sin historial o sin acabado equivalente en vez de valuarlas en 0", () => {
    const r = calcularEvolucion(
      [fila(1), fila(2), fila(3, 1, "firstEdition")],
      [p(1, "2026-11-01", 4), p(3, "2026-11-01", 99)],
    );

    expect(r).toMatchObject({ filasValuadas: 1, filasSinPrecio: 2 });
    expect(r.puntos).toEqual([{ fecha: "2026-11-01", valor: 4 }]);
  });

  it("ordena el historial aunque llegue desordenado", () => {
    const r = calcularEvolucion([fila(1)], [p(1, "2026-11-03", 3), p(1, "2026-11-01", 1)]);

    expect(r.puntos.map((x) => x.fecha)).toEqual(["2026-11-01", "2026-11-03"]);
  });

  it("sin nada que valuar devuelve una serie vacía", () => {
    expect(calcularEvolucion([], [])).toEqual({ puntos: [], filasValuadas: 0, filasSinPrecio: 0 });
    expect(calcularEvolucion([fila(1)], [])).toMatchObject({ puntos: [], filasSinPrecio: 1 });
  });
});
