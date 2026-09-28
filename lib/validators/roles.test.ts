import { describe, expect, it } from "vitest";
import { asignarRolSchema } from "./roles";

const entradaValida = {
  usuarioId: "3f2b8c1e-5d4a-4b7e-9c2d-1a0f6e8b7c95",
  rol: "administrador",
};

describe("asignarRolSchema", () => {
  it("acepta un uuid y un rol existente", () => {
    expect(asignarRolSchema.parse(entradaValida)).toEqual(entradaValida);
  });

  it.each(["superusuario", "administrador", "usuario_normal"])("acepta el rol %s", (rol) => {
    expect(asignarRolSchema.safeParse({ ...entradaValida, rol }).success).toBe(true);
  });

  it("rechaza un rol que no existe", () => {
    const resultado = asignarRolSchema.safeParse({ ...entradaValida, rol: "admin" });
    expect(resultado.success).toBe(false);
  });

  it("rechaza el rol con mayúsculas", () => {
    const resultado = asignarRolSchema.safeParse({ ...entradaValida, rol: "Superusuario" });
    expect(resultado.success).toBe(false);
  });

  it("rechaza un identificador que no es uuid", () => {
    const resultado = asignarRolSchema.safeParse({ ...entradaValida, usuarioId: "1 or 1=1" });
    expect(resultado.success).toBe(false);
  });

  it("rechaza campos faltantes", () => {
    expect(asignarRolSchema.safeParse({ rol: "administrador" }).success).toBe(false);
    expect(asignarRolSchema.safeParse({ usuarioId: entradaValida.usuarioId }).success).toBe(false);
  });

  it("descarta campos extra en vez de pasarlos a la base", () => {
    const resultado = asignarRolSchema.parse({ ...entradaValida, id: "otro" });
    expect(resultado).not.toHaveProperty("id");
  });
});
