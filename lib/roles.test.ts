import { beforeEach, describe, expect, it, vi } from "vitest";

// La autorización real la hacen las funciones SQL. Estas pruebas verifican que
// la entrada inválida no llega a la base y que los errores se traducen sin
// filtrar el detalle de Postgres.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { asignarRol, listarPerfiles } from "./roles";

const USUARIO = "3f2b8c1e-5d4a-4b7e-9c2d-1a0f6e8b7c95";

function base(respuesta: { data?: unknown; error?: { code?: string; message?: string } | null }) {
  const cliente = { rpc: vi.fn().mockResolvedValue({ data: null, error: null, ...respuesta }) };
  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return cliente;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("asignarRol", () => {
  it("llama a asignar_rol con el usuario y el rol validados", async () => {
    const cliente = base({});

    expect(await asignarRol({ usuarioId: USUARIO, rol: "administrador" })).toEqual({ ok: true, datos: null });
    expect(cliente.rpc).toHaveBeenCalledWith("asignar_rol", { p_usuario_id: USUARIO, p_rol: "administrador" });
  });

  it.each([
    ["un rol que ya no existe", { usuarioId: USUARIO, rol: "superusuario" }],
    ["el rol viejo de usuario", { usuarioId: USUARIO, rol: "usuario_normal" }],
    ["un id manipulado", { usuarioId: "1 or 1=1", rol: "usuario" }],
    ["una entrada vacía", {}],
  ])("rechaza %s sin llamar a la base", async (_, entrada) => {
    const resultado = await asignarRol(entrada);

    expect(resultado.ok).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([
    ["42501", "No tienes permiso para realizar esta acción."],
    ["P0002", "El usuario no existe."],
    ["23514", "El sistema debe conservar al menos un administrador."],
  ])("traduce el código %s de la base", async (code, mensaje) => {
    base({ error: { code, message: "detalle interno" } });

    expect(await asignarRol({ usuarioId: USUARIO, rol: "usuario" })).toEqual({ ok: false, error: mensaje });
  });

  it("no muestra el detalle de un error inesperado", async () => {
    base({ error: { code: "XX000", message: "detalle interno de postgres" } });

    const resultado = await asignarRol({ usuarioId: USUARIO, rol: "usuario" });

    expect(resultado).toEqual({ ok: false, error: "No se pudo completar la operación." });
  });
});

describe("listarPerfiles", () => {
  it("devuelve los perfiles que entrega la base", async () => {
    const perfiles = [{ id: USUARIO, nombre_visible: "ana", rol: "administrador", creado_en: "2026-11-02T00:00:00Z" }];
    base({ data: perfiles });

    expect(await listarPerfiles()).toEqual({ ok: true, datos: perfiles });
  });

  it("traduce el rechazo a un usuario sin Administración", async () => {
    base({ error: { code: "42501" } });

    expect(await listarPerfiles()).toEqual({ ok: false, error: "No tienes permiso para realizar esta acción." });
  });
});
