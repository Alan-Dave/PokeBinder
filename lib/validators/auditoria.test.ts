import { describe, expect, it } from "vitest";
import { listarAuditoriaSchema } from "./auditoria";

describe("listarAuditoriaSchema", () => {
  it("usa la página 1 si no se indica", () => {
    expect(listarAuditoriaSchema.parse({})).toEqual({ pagina: 1 });
  });

  it("trata los campos vacíos del formulario como sin filtro", () => {
    expect(listarAuditoriaSchema.parse({ pagina: "", accion: "  " })).toEqual({ pagina: 1 });
  });

  it("acepta una página como texto y una acción válida", () => {
    expect(listarAuditoriaSchema.parse({ pagina: "3", accion: "cambio_rol" })).toEqual({
      pagina: 3,
      accion: "cambio_rol",
    });
  });

  it.each(["0", "-1", "1.5", "abc", "100001"])("rechaza la página %s", (pagina) => {
    expect(listarAuditoriaSchema.safeParse({ pagina }).success).toBe(false);
  });

  it.each(["CAMBIO_ROL", "cambio rol", "x; drop table auditoria;--", "a".repeat(51)])(
    "rechaza la acción %s",
    (accion) => {
      expect(listarAuditoriaSchema.safeParse({ accion }).success).toBe(false);
    },
  );
});
