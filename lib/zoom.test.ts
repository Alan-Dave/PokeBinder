import { describe, expect, it } from "vitest";
import { ZOOM_MAX, ZOOM_MIN, limitarZoom, zoomPorClic, zoomPorRueda } from "./zoom";

describe("limitarZoom", () => {
  it("respeta los límites", () => {
    expect(limitarZoom(0.2)).toBe(ZOOM_MIN);
    expect(limitarZoom(99)).toBe(ZOOM_MAX);
    expect(limitarZoom(2.5)).toBe(2.5);
  });

  it("vuelve al mínimo con valores no numéricos", () => {
    expect(limitarZoom(Number.NaN)).toBe(ZOOM_MIN);
    expect(limitarZoom(Number.POSITIVE_INFINITY)).toBe(ZOOM_MIN);
  });
});

describe("zoomPorRueda", () => {
  it("acerca hacia arriba y aleja hacia abajo", () => {
    expect(zoomPorRueda(1, -100)).toBe(1.25);
    expect(zoomPorRueda(2, 100)).toBe(1.75);
  });

  it("no pasa de los límites", () => {
    expect(zoomPorRueda(ZOOM_MAX, -100)).toBe(ZOOM_MAX);
    expect(zoomPorRueda(ZOOM_MIN, 100)).toBe(ZOOM_MIN);
  });

  it("ignora una rueda sin movimiento", () => {
    expect(zoomPorRueda(2, 0)).toBe(2);
    expect(zoomPorRueda(2, Number.NaN)).toBe(2);
  });
});

describe("zoomPorClic", () => {
  it("acerca de a un paso y reinicia al llegar al máximo", () => {
    expect(zoomPorClic(1)).toBe(2);
    expect(zoomPorClic(2)).toBe(3);
    expect(zoomPorClic(3)).toBe(4);
    expect(zoomPorClic(ZOOM_MAX)).toBe(ZOOM_MIN);
  });

  it("parte del entero inferior si el zoom venía de la rueda", () => {
    expect(zoomPorClic(1.75)).toBe(2);
  });
});
