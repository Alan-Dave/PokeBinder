import { describe, expect, it } from "vitest";
import { loginSchema, registroSchema } from "./auth";

const registroValido = {
  correo: "ana@correo.cl",
  contrasena: "una-clave-larga-123",
  nombreVisible: "Ana",
};

describe("registroSchema", () => {
  it("acepta una entrada válida", () => {
    expect(registroSchema.parse(registroValido)).toEqual(registroValido);
  });

  it("normaliza el correo: sin espacios y en minúsculas", () => {
    const r = registroSchema.parse({ ...registroValido, correo: "  Ana@Correo.CL " });
    expect(r.correo).toBe("ana@correo.cl");
  });

  it.each(["ana", "ana@", "@correo.cl", "ana correo@x.cl", ""])("rechaza el correo %j", (correo) => {
    expect(registroSchema.safeParse({ ...registroValido, correo }).success).toBe(false);
  });

  it("rechaza un correo demasiado largo", () => {
    const correo = `${"a".repeat(250)}@x.cl`;
    expect(registroSchema.safeParse({ ...registroValido, correo }).success).toBe(false);
  });

  it("rechaza una contraseña de menos de 12 caracteres", () => {
    expect(registroSchema.safeParse({ ...registroValido, contrasena: "a".repeat(11) }).success).toBe(false);
  });

  it("acepta una contraseña de exactamente 12 y de exactamente 72 caracteres", () => {
    expect(registroSchema.safeParse({ ...registroValido, contrasena: "a".repeat(12) }).success).toBe(true);
    expect(registroSchema.safeParse({ ...registroValido, contrasena: "a".repeat(72) }).success).toBe(true);
  });

  it("rechaza una contraseña de más de 72 caracteres", () => {
    expect(registroSchema.safeParse({ ...registroValido, contrasena: "a".repeat(73) }).success).toBe(false);
  });

  it("no recorta la contraseña: los espacios cuentan", () => {
    const contrasena = "  doce espacios  ";
    expect(registroSchema.parse({ ...registroValido, contrasena }).contrasena).toBe(contrasena);
  });

  it("recorta el nombre visible y exige de 3 a 30 caracteres", () => {
    expect(registroSchema.parse({ ...registroValido, nombreVisible: "  Ana " }).nombreVisible).toBe("Ana");
    expect(registroSchema.safeParse({ ...registroValido, nombreVisible: "Al" }).success).toBe(false);
    expect(registroSchema.safeParse({ ...registroValido, nombreVisible: "  A  " }).success).toBe(false);
    expect(registroSchema.safeParse({ ...registroValido, nombreVisible: "x".repeat(31) }).success).toBe(false);
  });

  it("rechaza campos faltantes o que no son texto", () => {
    expect(registroSchema.safeParse({}).success).toBe(false);
    expect(registroSchema.safeParse({ ...registroValido, correo: null }).success).toBe(false);
    expect(registroSchema.safeParse({ ...registroValido, contrasena: 12345678901234 }).success).toBe(false);
  });

  it("descarta campos que no existen: no se puede pedir un rol al registrarse", () => {
    const r = registroSchema.parse({ ...registroValido, rol: "superusuario" });
    expect(r).not.toHaveProperty("rol");
  });
});

describe("loginSchema", () => {
  it("acepta correo y contraseña", () => {
    expect(loginSchema.parse({ correo: "Ana@Correo.cl", contrasena: "x" })).toEqual({
      correo: "ana@correo.cl",
      contrasena: "x",
    });
  });

  it("no aplica el largo mínimo de contraseña: no revela la regla", () => {
    expect(loginSchema.safeParse({ correo: "ana@correo.cl", contrasena: "corta" }).success).toBe(true);
  });

  it("rechaza una contraseña vacía o de más de 72 caracteres", () => {
    expect(loginSchema.safeParse({ correo: "ana@correo.cl", contrasena: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ correo: "ana@correo.cl", contrasena: "a".repeat(73) }).success).toBe(false);
  });

  it("rechaza un correo inválido o ausente", () => {
    expect(loginSchema.safeParse({ correo: "ana", contrasena: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ contrasena: "x" }).success).toBe(false);
  });
});
