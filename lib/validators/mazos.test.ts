import { describe, expect, it } from "vitest";
import { cruzarMazoSchema } from "./mazos";

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
