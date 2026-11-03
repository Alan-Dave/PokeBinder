import { describe, expect, it } from "vitest";
import { INCLINACION_MAX, INCLINACION_NEUTRA, calcularInclinacion } from "./inclinacion";

const caja = { left: 100, top: 50, width: 200, height: 300 };

describe("calcularInclinacion", () => {
  it("deja la carta quieta con el puntero en el centro", () => {
    expect(calcularInclinacion(200, 200, caja)).toEqual(INCLINACION_NEUTRA);
  });

  it("inclina al máximo hacia el borde donde está el puntero", () => {
    const derecha = calcularInclinacion(300, 200, caja);
    expect(derecha.rotY).toBe(INCLINACION_MAX);
    expect(derecha.brilloX).toBe(100);

    const izquierda = calcularInclinacion(100, 200, caja);
    expect(izquierda.rotY).toBe(-INCLINACION_MAX);
    expect(izquierda.brilloX).toBe(0);

    const arriba = calcularInclinacion(200, 50, caja);
    expect(arriba.rotX).toBe(INCLINACION_MAX);
    expect(arriba.brilloY).toBe(0);

    const abajo = calcularInclinacion(200, 350, caja);
    expect(abajo.rotX).toBe(-INCLINACION_MAX);
    expect(abajo.brilloY).toBe(100);
  });

  it("interpola entre el centro y el borde", () => {
    const { rotY, brilloX } = calcularInclinacion(250, 200, caja);
    expect(rotY).toBe(INCLINACION_MAX / 2);
    expect(brilloX).toBe(75);
  });

  it("trata un puntero fuera de la carta como si estuviera en su borde", () => {
    const fuera = calcularInclinacion(9999, -9999, caja);
    expect(fuera.rotY).toBe(INCLINACION_MAX);
    expect(fuera.rotX).toBe(INCLINACION_MAX);
    expect(fuera.brilloX).toBe(100);
    expect(fuera.brilloY).toBe(0);
  });

  it("vuelve al estado neutro con coordenadas no numéricas", () => {
    expect(calcularInclinacion(Number.NaN, 200, caja)).toEqual(INCLINACION_NEUTRA);
    expect(calcularInclinacion(200, Number.POSITIVE_INFINITY, caja)).toEqual(INCLINACION_NEUTRA);
  });

  it("vuelve al estado neutro con una caja sin tamaño", () => {
    expect(calcularInclinacion(10, 10, { ...caja, width: 0 })).toEqual(INCLINACION_NEUTRA);
    expect(calcularInclinacion(10, 10, { ...caja, height: -5 })).toEqual(INCLINACION_NEUTRA);
    expect(calcularInclinacion(10, 10, { ...caja, left: Number.NaN })).toEqual(INCLINACION_NEUTRA);
  });
});
