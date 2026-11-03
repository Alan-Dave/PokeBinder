import { describe, expect, it } from "vitest";
import {
  CUADRICULAS,
  colocarCartaSchema,
  crearBinderSchema,
  cuadriculaDe,
  dimensionesDe,
  obtenerBinderSchema,
  quitarCartaSchema,
} from "./binders";

describe("cuadrículas", () => {
  it("dimensionesDe y cuadriculaDe son inversas para las cuatro cuadrículas", () => {
    for (const c of CUADRICULAS) {
      const { filas, columnas } = dimensionesDe(c);
      expect(cuadriculaDe(filas, columnas)).toBe(c);
    }
  });

  it("cuadriculaDe rechaza tamaños que no existen", () => {
    expect(cuadriculaDe(2, 3)).toBeNull();
    expect(cuadriculaDe(5, 5)).toBeNull();
    expect(cuadriculaDe(0, 0)).toBeNull();
  });
});

describe("crearBinderSchema", () => {
  it("acepta un binder válido y usa 1 página por defecto", () => {
    expect(crearBinderSchema.parse({ nombre: "  Mi binder ", cuadricula: "3x3" })).toEqual({
      nombre: "Mi binder",
      cuadricula: "3x3",
      paginas: 1,
    });
  });

  it.each(["2x3", "5x5", "3X3", "", "3x3 ", "../"])("rechaza la cuadrícula %j", (cuadricula) => {
    expect(crearBinderSchema.safeParse({ nombre: "a", cuadricula }).success).toBe(false);
  });

  it.each(["", "   ", "x".repeat(61)])("rechaza el nombre %j", (nombre) => {
    expect(crearBinderSchema.safeParse({ nombre, cuadricula: "2x2" }).success).toBe(false);
  });

  it.each([0, -1, 101, 1.5, Number.NaN])("rechaza %s páginas", (paginas) => {
    expect(crearBinderSchema.safeParse({ nombre: "a", cuadricula: "2x2", paginas }).success).toBe(false);
  });

  it("no deja pasar usuario_id aunque se lo manden", () => {
    const resultado = crearBinderSchema.parse({ nombre: "a", cuadricula: "2x2", usuario_id: "otro" });
    expect(resultado).not.toHaveProperty("usuario_id");
  });
});

describe("obtenerBinderSchema", () => {
  it("usa la página 1 por defecto", () => {
    expect(obtenerBinderSchema.parse({ binderId: 3 })).toEqual({ binderId: 3, pagina: 1 });
  });

  it.each([0, -2, 1.5, Number.NaN])("rechaza el binder %s", (binderId) => {
    expect(obtenerBinderSchema.safeParse({ binderId }).success).toBe(false);
  });
});

describe("colocarCartaSchema y quitarCartaSchema", () => {
  const valida = { binderId: 1, pagina: 2, posicion: 15, inventarioId: 9 };

  it("acepta la última casilla de una cuadrícula 4x4", () => {
    expect(colocarCartaSchema.safeParse(valida).success).toBe(true);
    expect(quitarCartaSchema.safeParse(valida).success).toBe(true);
  });

  it.each([-1, 16, 1.5, Number.NaN])("rechaza la casilla %s", (posicion) => {
    expect(colocarCartaSchema.safeParse({ ...valida, posicion }).success).toBe(false);
  });

  it.each([0, 101, -1])("rechaza la página %s", (pagina) => {
    expect(colocarCartaSchema.safeParse({ ...valida, pagina }).success).toBe(false);
  });

  it("rechaza ids que no son enteros positivos", () => {
    expect(colocarCartaSchema.safeParse({ ...valida, inventarioId: 0 }).success).toBe(false);
    expect(colocarCartaSchema.safeParse({ ...valida, inventarioId: "9" }).success).toBe(false);
  });
});
