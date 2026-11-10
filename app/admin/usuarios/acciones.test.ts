import { beforeEach, describe, expect, it, vi } from "vitest";

// Una Server Action es un endpoint público: estas pruebas le envían lo que
// enviaría un formulario manipulado y verifican que la validación de
// lib/roles.ts lo frena antes de llegar a la base.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cambiarRolAccion } from "./acciones";

const INICIAL = { error: null, exito: false };
const USUARIO = "3f2b8c1e-5d4a-4b7e-9c2d-1a0f6e8b7c95";

function formulario(campos: Record<string, string>) {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

function base(error: { code?: string } | null = null) {
  const cliente = { rpc: vi.fn().mockResolvedValue({ data: null, error }) };
  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return cliente;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(revalidatePath).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("cambiarRolAccion", () => {
  it("asigna el rol y refresca la página", async () => {
    const cliente = base();

    const r = await cambiarRolAccion(INICIAL, formulario({ usuarioId: USUARIO, rol: "administrador" }));

    expect(r).toEqual({ error: null, exito: true });
    expect(cliente.rpc).toHaveBeenCalledWith("asignar_rol", { p_usuario_id: USUARIO, p_rol: "administrador" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/usuarios");
  });

  it.each([
    ["rol que no existe", { usuarioId: USUARIO, rol: "root" }],
    ["rol vacío", { usuarioId: USUARIO, rol: "" }],
    ["id que no es uuid", { usuarioId: "1 OR 1=1", rol: "administrador" }],
    ["sin id", { rol: "administrador" }],
    ["sin rol", { usuarioId: USUARIO }],
  ])("rechaza %s sin llamar a la base", async (_, campos) => {
    const r = await cambiarRolAccion(INICIAL, formulario(campos));

    expect(r.exito).toBe(false);
    expect(r.error).toBeTruthy();
    expect(createClient).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["42501", "No tienes permiso para realizar esta acción."],
    ["P0002", "El usuario no existe."],
    ["23514", "El sistema debe conservar al menos un administrador."],
  ])("traduce el error %s de la base", async (codigo, mensaje) => {
    base({ code: codigo });

    const r = await cambiarRolAccion(INICIAL, formulario({ usuarioId: USUARIO, rol: "usuario" }));

    expect(r).toEqual({ error: mensaje, exito: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("oculta el detalle de un fallo inesperado", async () => {
    base({ code: "XX000" });

    const r = await cambiarRolAccion(INICIAL, formulario({ usuarioId: USUARIO, rol: "usuario" }));

    expect(r).toEqual({ error: "No se pudo completar la operación.", exito: false });
  });
});
