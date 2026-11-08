import { describe, expect, it } from "vitest";
import {
  agregarCartaAlMazoSchema,
  crearMazoSchema,
  eliminarMazoSchema,
  fijarCantidadEnMazoSchema,
  obtenerMazoSchema,
  quitarDelMazoSchema,
  cruzarMazoSchema,
} from "./mazos";

describe("cruzarMazoSchema", () => {
  it("acepta un id de mazo válido", () => {
    expect(cruzarMazoSchema.parse({ mazoId: 1 })).toEqual({ mazoId: 1 });
  });

  it("rechaza un id no entero", () => {
    expect(cruzarMazoSchema.safeParse({ mazoId: 1.5 }).success).toBe(false);
  });

  it("rechaza un id no positivo", () => {
    expect(cruzarMazoSchema.safeParse({ mazoId: 0 }).success).toBe(false);
    expect(cruzarMazoSchema.safeParse({ mazoId: -1 }).success).toBe(false);
  });

  it("rechaza un id que no es number, útil contra inyección vía tipo", () => {
    expect(cruzarMazoSchema.safeParse({ mazoId: "1 OR 1=1" }).success).toBe(false);
  });

  it("rechaza si falta el campo", () => {
    expect(cruzarMazoSchema.safeParse({}).success).toBe(false);
  });
});

describe("crearMazoSchema", () => {
  it("recorta el nombre", () => {
    expect(crearMazoSchema.parse({ nombre: "  Fuego  " })).toEqual({ nombre: "Fuego" });
  });

  it.each([
    ["vacío", { nombre: "" }],
    ["solo espacios", { nombre: "   " }],
    ["demasiado largo", { nombre: "a".repeat(61) }],
    ["que no es texto", { nombre: 5 }],
    ["ausente", {}],
  ])("rechaza un nombre %s", (_, entrada) => {
    expect(crearMazoSchema.safeParse(entrada).success).toBe(false);
  });
});

describe("ids de mazo y de carta", () => {
  it("aceptan enteros positivos", () => {
    expect(obtenerMazoSchema.parse({ mazoId: 3 })).toEqual({ mazoId: 3 });
    expect(eliminarMazoSchema.parse({ mazoId: 3 })).toEqual({ mazoId: 3 });
    expect(agregarCartaAlMazoSchema.parse({ mazoId: 3, cartaId: 9 })).toEqual({ mazoId: 3, cartaId: 9 });
    expect(quitarDelMazoSchema.parse({ mazoId: 3, cartaId: 9 })).toEqual({ mazoId: 3, cartaId: 9 });
  });

  it.each([
    ["mazo en cero", { mazoId: 0, cartaId: 9 }],
    ["carta negativa", { mazoId: 3, cartaId: -1 }],
    ["carta decimal", { mazoId: 3, cartaId: 1.5 }],
    ["mazo manipulado", { mazoId: "1 OR 1=1", cartaId: 9 }],
    ["carta ausente", { mazoId: 3 }],
  ])("rechazan %s", (_, entrada) => {
    expect(agregarCartaAlMazoSchema.safeParse(entrada).success).toBe(false);
    expect(quitarDelMazoSchema.safeParse(entrada).success).toBe(false);
  });
});

describe("fijarCantidadEnMazoSchema", () => {
  it("acepta de 1 a 60", () => {
    expect(fijarCantidadEnMazoSchema.safeParse({ mazoId: 1, cartaId: 2, cantidad: 1 }).success).toBe(true);
    expect(fijarCantidadEnMazoSchema.safeParse({ mazoId: 1, cartaId: 2, cantidad: 60 }).success).toBe(true);
  });

  it.each([0, 61, -3, 2.5, "4", Number.NaN])("rechaza la cantidad %s", (cantidad) => {
    expect(fijarCantidadEnMazoSchema.safeParse({ mazoId: 1, cartaId: 2, cantidad }).success).toBe(false);
  });
});
