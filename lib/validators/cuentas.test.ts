import { describe, expect, it } from "vitest";
import { cambiarEstadoCuentaSchema } from "./cuentas";

const valida = {
  usuarioId: "3f2b8c1e-5d4a-4b7e-9c2d-1a0f6e8b7c95",
  habilitar: false,
  motivo: "Abuso del sistema",
};

describe("cambiarEstadoCuentaSchema", () => {
  it("acepta una entrada válida y recorta el motivo", () => {
    expect(cambiarEstadoCuentaSchema.parse({ ...valida, motivo: "  Abuso del sistema  " })).toEqual(valida);
  });

  it.each([
    ["motivo corto", { ...valida, motivo: "abc" }],
    ["motivo solo con espacios", { ...valida, motivo: "        " }],
    ["motivo de más de 300 caracteres", { ...valida, motivo: "a".repeat(301) }],
    ["habilitar como texto", { ...valida, habilitar: "false" }],
    ["id manipulado", { ...valida, usuarioId: "1 or 1=1" }],
    ["sin motivo", { usuarioId: valida.usuarioId, habilitar: true }],
  ])("rechaza %s", (_, entrada) => {
    expect(cambiarEstadoCuentaSchema.safeParse(entrada).success).toBe(false);
  });

  it("descarta campos extra en vez de pasarlos a la base", () => {
    expect(cambiarEstadoCuentaSchema.parse({ ...valida, rol: "administrador" })).not.toHaveProperty("rol");
  });
});
