import { describe, expect, it } from "vitest";
import { legalidadMazoSchema, respuestaLegalidadTcgdexSchema } from "./legalidad";

describe("legalidadMazoSchema", () => {
  it.each(["standard", "expanded"])("acepta el formato %s", (formato) => {
    expect(legalidadMazoSchema.parse({ mazoId: 3, formato })).toEqual({ mazoId: 3, formato });
  });

  it.each([
    [{ mazoId: 0, formato: "standard" }, "El identificador del mazo no es válido."],
    [{ mazoId: -1, formato: "standard" }, "El identificador del mazo no es válido."],
    [{ mazoId: 1.5, formato: "standard" }, "El identificador del mazo no es válido."],
    [{ mazoId: "3", formato: "standard" }, "El identificador del mazo no es válido."],
    [{ mazoId: 3, formato: "unlimited" }, "El formato no es válido."],
    [{ mazoId: 3, formato: "" }, "El formato no es válido."],
    [{ mazoId: 3 }, "El formato no es válido."],
    [{ mazoId: 3, formato: "standard' OR 1=1" }, "El formato no es válido."],
  ])("rechaza %j", (entrada, mensaje) => {
    const r = legalidadMazoSchema.safeParse(entrada);

    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].message).toBe(mensaje);
  });
});

describe("respuestaLegalidadTcgdexSchema", () => {
  it("lee los dos formatos", () => {
    expect(respuestaLegalidadTcgdexSchema.parse({ legal: { standard: false, expanded: true }, otro: 1 })).toEqual({
      legal: { standard: false, expanded: true },
    });
  });

  it("trata como desconocido lo que no sea booleano", () => {
    const r = respuestaLegalidadTcgdexSchema.parse({ legal: { standard: "sí", expanded: 1 } });

    expect(r.legal).toEqual({ standard: undefined, expanded: undefined });
  });

  it("acepta una respuesta sin legal o con legal inválido", () => {
    expect(respuestaLegalidadTcgdexSchema.parse({}).legal).toBeUndefined();
    expect(respuestaLegalidadTcgdexSchema.parse({ legal: "x" }).legal).toBeUndefined();
  });
});
