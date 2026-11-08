import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { crearPermiso, permisoValido, VIGENCIA_SEGUNDOS } from "./recuperacion";

const SECRETO = "sb_secret_de_prueba";
const AHORA = 1_800_000_000_000;
const USUARIO = "11111111-1111-4111-8111-111111111111";

describe("permiso de restablecimiento", () => {
  it("acepta un permiso recién creado para el mismo usuario", () => {
    const permiso = crearPermiso(USUARIO, AHORA, SECRETO);
    expect(permisoValido(permiso, USUARIO, AHORA, SECRETO)).toBe(true);
  });

  it("lo rechaza para otro usuario", () => {
    const permiso = crearPermiso(USUARIO, AHORA, SECRETO);
    expect(permisoValido(permiso, "22222222-2222-4222-8222-222222222222", AHORA, SECRETO)).toBe(false);
  });

  it("lo rechaza cuando venció", () => {
    const permiso = crearPermiso(USUARIO, AHORA, SECRETO);
    const despues = AHORA + (VIGENCIA_SEGUNDOS + 1) * 1000;
    expect(permisoValido(permiso, USUARIO, despues, SECRETO)).toBe(false);
  });

  it("lo rechaza si se firmó con otra clave", () => {
    const permiso = crearPermiso(USUARIO, AHORA, "otra-clave");
    expect(permisoValido(permiso, USUARIO, AHORA, SECRETO)).toBe(false);
  });

  it("lo rechaza si se alarga la fecha de vencimiento", () => {
    const [vence, firma] = crearPermiso(USUARIO, AHORA, SECRETO).split(".");
    const alargado = `${Number(vence) + 100000}.${firma}`;
    expect(permisoValido(alargado, USUARIO, AHORA, SECRETO)).toBe(false);
  });

  it.each([undefined, "", "sin-punto", "a.b.c", "abc.firma", "1.5.x"])("rechaza el valor mal formado %j", (valor) => {
    expect(permisoValido(valor, USUARIO, AHORA, SECRETO)).toBe(false);
  });
});
