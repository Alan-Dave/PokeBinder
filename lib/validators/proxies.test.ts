import { describe, expect, it } from "vitest";
import { generarProxiesSchema } from "./proxies";

describe("generarProxiesSchema", () => {
  it("acepta un id de mazo válido", () => {
    expect(generarProxiesSchema.parse({ mazoId: 7 })).toEqual({ mazoId: 7 });
  });

  it.each([0, -1, 1.5, Number.NaN, "7", "1 OR 1=1", null, undefined])("rechaza el mazo %j", (mazoId) => {
    const r = generarProxiesSchema.safeParse({ mazoId });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].message).toBe("El identificador del mazo no es válido.");
  });

  it("rechaza la entrada ausente", () => {
    expect(generarProxiesSchema.safeParse({}).success).toBe(false);
  });
});
