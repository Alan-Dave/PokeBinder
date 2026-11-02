import { beforeEach, describe, expect, it, vi } from "vitest";

// Una Server Action es un endpoint público: estas pruebas le envían lo que
// enviaría un formulario manipulado y verifican que nada llega a la base ni
// a Supabase Auth sin pasar la validación de lib/cuentas.ts.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/correo", async (original) => ({
  ...(await original<typeof import("@/lib/correo")>()),
  enviarCorreo: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { enviarCorreo } from "@/lib/correo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cambiarEstadoCuentaAccion } from "./acciones";

const INICIAL = { error: null, exito: false };
const USUARIO = "3f2b8c1e-5d4a-4b7e-9c2d-1a0f6e8b7c95";

function formulario(campos: Record<string, string>) {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

function sesion() {
  const base = { rpc: vi.fn().mockResolvedValue({ data: true, error: null }) };
  const admin = { auth: { admin: { updateUserById: vi.fn().mockResolvedValue({ data: { user: { email: "carla@correo.cl" } }, error: null }) } } };
  vi.mocked(createClient).mockResolvedValue(base as never);
  vi.mocked(createAdminClient).mockReturnValue(admin as never);
  return base;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(createAdminClient).mockReset();
  vi.mocked(revalidatePath).mockReset();
  vi.mocked(enviarCorreo).mockReset().mockResolvedValue(true);
});

describe("cambiarEstadoCuentaAccion", () => {
  it.each([
    ["false", false],
    ["true", true],
  ])("convierte habilitar=%s y refresca /admin/cuentas", async (texto, valor) => {
    const base = sesion();

    const estado = await cambiarEstadoCuentaAccion(
      INICIAL,
      formulario({ usuarioId: USUARIO, habilitar: texto, motivo: "Abuso del sistema" }),
    );

    expect(estado).toEqual({ error: null, exito: true, aviso: null });
    expect(base.rpc).toHaveBeenCalledWith("cambiar_estado_cuenta", {
      p_usuario_id: USUARIO,
      p_habilitar: valor,
      p_motivo: "Abuso del sistema",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/cuentas");
  });

  it.each([
    ["habilitar con otro valor", { usuarioId: USUARIO, habilitar: "1", motivo: "Abuso del sistema" }],
    ["sin habilitar", { usuarioId: USUARIO, motivo: "Abuso del sistema" }],
    ["motivo vacío", { usuarioId: USUARIO, habilitar: "false", motivo: "" }],
    ["id manipulado", { usuarioId: "' or 1=1 --", habilitar: "false", motivo: "Abuso del sistema" }],
  ])("rechaza %s sin tocar la base ni Auth", async (_, campos) => {
    const estado = await cambiarEstadoCuentaAccion(INICIAL, formulario(campos));

    expect(estado.exito).toBe(false);
    expect(estado.error).toBeTruthy();
    expect(createClient).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("informa cuando el cambio se hizo pero el correo no salió", async () => {
    sesion();
    vi.mocked(enviarCorreo).mockResolvedValue(false);

    const estado = await cambiarEstadoCuentaAccion(
      INICIAL,
      formulario({ usuarioId: USUARIO, habilitar: "false", motivo: "Abuso del sistema" }),
    );

    expect(estado).toEqual({
      error: null,
      exito: true,
      aviso: "No se pudo enviar el aviso por correo al usuario.",
    });
  });
});
