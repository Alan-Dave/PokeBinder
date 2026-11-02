import { beforeEach, describe, expect, it, vi } from "vitest";

// La autorización la hace cambiar_estado_cuenta en la base. Estas pruebas
// verifican el orden de los dos pasos: Supabase Auth (clave secreta) nunca se
// toca si la base no autorizó, y un fallo de Auth revierte la base.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/correo", async (original) => ({
  ...(await original<typeof import("@/lib/correo")>()),
  enviarCorreo: vi.fn(),
}));

import { enviarCorreo } from "@/lib/correo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cambiarEstadoCuenta } from "./cuentas";

const USUARIO = "3f2b8c1e-5d4a-4b7e-9c2d-1a0f6e8b7c95";
const DESHABILITAR = { usuarioId: USUARIO, habilitar: false, motivo: "Abuso del sistema" };

type Respuesta = { data?: unknown; error?: { code?: string } | null };

const CORREO = "carla@correo.cl";

function preparar(rpc: Respuesta[], auth: { error: { code?: string } | null } = { error: null }) {
  const base = { rpc: vi.fn() };
  for (const r of rpc) base.rpc.mockResolvedValueOnce({ data: null, error: null, ...r });
  const admin = { auth: { admin: { updateUserById: vi.fn().mockResolvedValue({ data: { user: { email: CORREO } }, ...auth }) } } };
  vi.mocked(createClient).mockResolvedValue(base as never);
  vi.mocked(createAdminClient).mockReturnValue(admin as never);
  return { base, updateUserById: admin.auth.admin.updateUserById };
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(createAdminClient).mockReset();
  vi.mocked(enviarCorreo).mockReset().mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("cambiarEstadoCuenta", () => {
  it("deshabilita en la base y luego bloquea en Supabase Auth", async () => {
    const { base, updateUserById } = preparar([{ data: true }]);

    expect(await cambiarEstadoCuenta(DESHABILITAR)).toEqual({ ok: true, datos: { avisoEnviado: true } });
    expect(base.rpc).toHaveBeenCalledWith("cambiar_estado_cuenta", {
      p_usuario_id: USUARIO,
      p_habilitar: false,
      p_motivo: "Abuso del sistema",
    });
    expect(updateUserById).toHaveBeenCalledWith(USUARIO, { ban_duration: "876000h" });
  });

  it("al habilitar quita el bloqueo en Supabase Auth", async () => {
    const { updateUserById } = preparar([{ data: true }]);

    expect(await cambiarEstadoCuenta({ ...DESHABILITAR, habilitar: true })).toEqual({
      ok: true,
      datos: { avisoEnviado: true },
    });
    expect(updateUserById).toHaveBeenCalledWith(USUARIO, { ban_duration: "none" });
  });

  it.each([
    ["un motivo corto", { ...DESHABILITAR, motivo: "no" }],
    ["un id manipulado", { ...DESHABILITAR, usuarioId: "1 or 1=1" }],
    ["habilitar como texto", { ...DESHABILITAR, habilitar: "false" }],
  ])("rechaza %s sin tocar la base ni Auth", async (_, entrada) => {
    const resultado = await cambiarEstadoCuenta(entrada);

    expect(resultado.ok).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it.each([
    ["42501", "No tienes permiso para realizar esta acción."],
    ["P0002", "El usuario no existe."],
    ["23514", "El sistema debe conservar al menos un administrador habilitado."],
  ])("si la base rechaza (%s) no toca Supabase Auth", async (code, mensaje) => {
    preparar([{ error: { code } }]);

    expect(await cambiarEstadoCuenta(DESHABILITAR)).toEqual({ ok: false, error: mensaje });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("si Supabase Auth falla, revierte el cambio en la base", async () => {
    const { base } = preparar([{ data: true }, { data: true }], { error: { code: "unexpected_failure" } });

    const resultado = await cambiarEstadoCuenta(DESHABILITAR);

    expect(resultado.ok).toBe(false);
    expect(base.rpc).toHaveBeenCalledTimes(2);
    expect(base.rpc).toHaveBeenLastCalledWith("cambiar_estado_cuenta", {
      p_usuario_id: USUARIO,
      p_habilitar: true,
      p_motivo: "Reversión automática: Supabase Auth no aplicó el cambio.",
    });
  });

  it("si la cuenta ya estaba así y Auth falla, no revierte nada", async () => {
    const { base } = preparar([{ data: false }], { error: { code: "unexpected_failure" } });

    expect((await cambiarEstadoCuenta(DESHABILITAR)).ok).toBe(false);
    expect(base.rpc).toHaveBeenCalledTimes(1);
  });

  it("si la cuenta ya estaba así, igual aplica el estado en Auth (repara un desacuerdo)", async () => {
    const { updateUserById } = preparar([{ data: false }]);

    expect(await cambiarEstadoCuenta(DESHABILITAR)).toEqual({ ok: true, datos: { avisoEnviado: null } });
    expect(updateUserById).toHaveBeenCalled();
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it("el log de un fallo de Auth lleva solo el código", async () => {
    preparar([{ data: true }, { data: true }], { error: { code: "user_not_found" } });

    await cambiarEstadoCuenta(DESHABILITAR);

    const log = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(log).toContain("user_not_found");
    expect(log).not.toContain("Abuso del sistema");
  });

  it("avisa por correo a la dirección de la cuenta, con el motivo", async () => {
    preparar([{ data: true }]);

    await cambiarEstadoCuenta(DESHABILITAR);

    expect(enviarCorreo).toHaveBeenCalledWith(
      expect.objectContaining({
        para: CORREO,
        asunto: "Tu cuenta de PokeBinder fue deshabilitada",
        texto: expect.stringContaining("Abuso del sistema"),
      }),
    );
  });

  it("si el correo no sale, el cambio se mantiene y lo informa", async () => {
    const { base } = preparar([{ data: true }]);
    vi.mocked(enviarCorreo).mockResolvedValue(false);

    expect(await cambiarEstadoCuenta(DESHABILITAR)).toEqual({ ok: true, datos: { avisoEnviado: false } });
    expect(base.rpc).toHaveBeenCalledTimes(1);
  });

  it("si Supabase Auth falla, no envía el aviso", async () => {
    preparar([{ data: true }, { data: true }], { error: { code: "unexpected_failure" } });

    await cambiarEstadoCuenta(DESHABILITAR);

    expect(enviarCorreo).not.toHaveBeenCalled();
  });
});
