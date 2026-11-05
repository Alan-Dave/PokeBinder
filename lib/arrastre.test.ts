import { describe, expect, it } from "vitest";
import { decidirSoltar, MENSAJE_OCUPADA, MENSAJE_SOLO_QUITAR_DEL_BINDER } from "./arrastre";

const ocupadas = new Set([0, 3]);
const deCasilla = (posicion: number) => ({ tipo: "casilla" as const, posicion });
const deInventario = (inventarioId: number) => ({ tipo: "inventario" as const, inventarioId });

describe("decidirSoltar", () => {
  it("no hace nada si se suelta fuera de una zona", () => {
    expect(decidirSoltar(deCasilla(0), null, ocupadas)).toBeNull();
    expect(decidirSoltar(deInventario(9), null, ocupadas)).toBeNull();
  });

  describe("desde una casilla", () => {
    it("mueve a una casilla vacía", () => {
      expect(decidirSoltar(deCasilla(0), deCasilla(1), ocupadas)).toEqual({
        accion: { tipo: "mover", desde: 0, hasta: 1 },
      });
    });

    it("rechaza una casilla ocupada: no intercambia ni reemplaza", () => {
      expect(decidirSoltar(deCasilla(0), deCasilla(3), ocupadas)).toEqual({ error: MENSAJE_OCUPADA });
    });

    it("ignora soltar sobre la misma casilla", () => {
      expect(decidirSoltar(deCasilla(0), deCasilla(0), ocupadas)).toBeNull();
    });

    it("quita la carta al soltarla en la zona de quitar", () => {
      expect(decidirSoltar(deCasilla(3), { tipo: "quitar" }, ocupadas)).toEqual({
        accion: { tipo: "quitar", posicion: 3 },
      });
    });
  });

  describe("desde el inventario", () => {
    it("coloca en una casilla vacía", () => {
      expect(decidirSoltar(deInventario(42), deCasilla(2), ocupadas)).toEqual({
        accion: { tipo: "colocar", inventarioId: 42, posicion: 2 },
      });
    });

    it("rechaza una casilla ocupada: no reemplaza", () => {
      expect(decidirSoltar(deInventario(42), deCasilla(0), ocupadas)).toEqual({ error: MENSAJE_OCUPADA });
    });

    it("no se puede «quitar» algo que no está en el binder", () => {
      expect(decidirSoltar(deInventario(42), { tipo: "quitar" }, ocupadas)).toEqual({
        error: MENSAJE_SOLO_QUITAR_DEL_BINDER,
      });
    });
  });
});
