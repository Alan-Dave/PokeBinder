import { describe, expect, it } from "vitest";
import {
  categoriasDeCartasSchema,
  crearCategoriaSchema,
  eliminarCategoriaSchema,
  NOMBRE_CATEGORIA_MAX,
  pertenenciaSchema,
  renombrarCategoriaSchema,
} from "./categorias";

describe("crearCategoriaSchema", () => {
  it("acepta un nombre y le quita los espacios de los bordes", () => {
    expect(crearCategoriaSchema.parse({ nombre: "  Mis Sylveon  " })).toEqual({ nombre: "Mis Sylveon" });
  });

  it.each([
    ["vacío", ""],
    ["solo espacios", "   "],
    ["demasiado largo", "x".repeat(NOMBRE_CATEGORIA_MAX + 1)],
    ["no es texto", 5],
    ["nulo", null],
  ])("rechaza un nombre %s", (_, nombre) => {
    expect(crearCategoriaSchema.safeParse({ nombre }).success).toBe(false);
  });

  it("acepta el largo máximo exacto", () => {
    expect(crearCategoriaSchema.safeParse({ nombre: "x".repeat(NOMBRE_CATEGORIA_MAX) }).success).toBe(true);
  });
});

describe("renombrarCategoriaSchema y eliminarCategoriaSchema", () => {
  it("piden un id entero positivo", () => {
    expect(renombrarCategoriaSchema.safeParse({ id: 3, nombre: "Nueva" }).success).toBe(true);
    expect(eliminarCategoriaSchema.safeParse({ id: 3 }).success).toBe(true);
  });

  it.each([0, -1, 1.5, Number.NaN, "3", null])("rechazan el id %s", (id) => {
    expect(renombrarCategoriaSchema.safeParse({ id, nombre: "x" }).success).toBe(false);
    expect(eliminarCategoriaSchema.safeParse({ id }).success).toBe(false);
  });
});

describe("pertenenciaSchema", () => {
  it("acepta una categoría y una carta con ids válidos", () => {
    expect(pertenenciaSchema.parse({ categoriaId: 1, inventarioId: 2 })).toEqual({ categoriaId: 1, inventarioId: 2 });
  });

  it.each([
    [{ categoriaId: 0, inventarioId: 2 }],
    [{ categoriaId: 1, inventarioId: -2 }],
    [{ categoriaId: 1 }],
    [{ categoriaId: "1 OR 1=1", inventarioId: 2 }],
  ])("rechaza %j", (entrada) => {
    expect(pertenenciaSchema.safeParse(entrada).success).toBe(false);
  });
});

describe("categoriasDeCartasSchema", () => {
  it("acepta hasta 30 ids", () => {
    expect(categoriasDeCartasSchema.safeParse(Array.from({ length: 30 }, (_, i) => i + 1)).success).toBe(true);
  });

  it("rechaza más de 30, ids inválidos y lo que no es lista", () => {
    expect(categoriasDeCartasSchema.safeParse(Array.from({ length: 31 }, (_, i) => i + 1)).success).toBe(false);
    expect(categoriasDeCartasSchema.safeParse([1, 0]).success).toBe(false);
    expect(categoriasDeCartasSchema.safeParse("1,2").success).toBe(false);
  });
});
