import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
// redirect de Next.js corta la ejecución lanzando una excepción.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((ruta: string) => {
    throw new Error(`REDIRECT ${ruta}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
// La firma se prueba en lib/recuperacion.test.ts; aquí se decide si el permiso vale.
vi.mock("@/lib/recuperacion", async (original) => ({
  ...(await original<typeof import("@/lib/recuperacion")>()),
  permisoValido: vi.fn(),
}));

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { permisoValido } from "@/lib/recuperacion";
import { createClient } from "@/lib/supabase/server";
import { restablecerAccion } from "./acciones";

const INICIAL = { error: null };
const CLAVE = "una clave nueva y larga";

function formulario(campos: Record<string, string>) {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

function preparar({ sesion = true, permiso = true, errorActualizar = null as { code?: string } | null } = {}) {
  const almacen = { get: vi.fn().mockReturnValue({ value: "permiso" }), delete: vi.fn() };
  vi.mocked(cookies).mockResolvedValue(almacen as never);
  vi.mocked(permisoValido).mockReturnValue(permiso);

  const cliente = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: sesion ? { id: "u1", email: "ana@correo.cl" } : null } }),
      updateUser: vi.fn().mockResolvedValue({ error: errorActualizar }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: { nombre_visible: "Ana", rol: "usuario_normal" } }) }),
      }),
    }),
  };
  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return { cliente, almacen };
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(redirect).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("restablecerAccion", () => {
  it("cambia la contraseña, cierra las otras sesiones, gasta el permiso y redirige", async () => {
    const { cliente, almacen } = preparar();

    await expect(restablecerAccion(INICIAL, formulario({ contrasena: CLAVE, confirmacion: CLAVE }))).rejects.toThrow(
      "REDIRECT /",
    );

    expect(cliente.auth.updateUser).toHaveBeenCalledWith({ password: CLAVE });
    expect(cliente.auth.signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(almacen.delete).toHaveBeenCalledWith({ name: "pb_recuperacion", path: "/restablecer" });
  });

  it("rechaza sin permiso firmado aunque haya sesión", async () => {
    const { cliente } = preparar({ permiso: false });
    const estado = await restablecerAccion(INICIAL, formulario({ contrasena: CLAVE, confirmacion: CLAVE }));

    expect(estado.error).toContain("El enlace venció");
    expect(cliente.auth.updateUser).not.toHaveBeenCalled();
  });

  it("rechaza sin sesión", async () => {
    const { cliente } = preparar({ sesion: false });
    const estado = await restablecerAccion(INICIAL, formulario({ contrasena: CLAVE, confirmacion: CLAVE }));

    expect(estado.error).toContain("El enlace venció");
    expect(cliente.auth.updateUser).not.toHaveBeenCalled();
  });

  it("exige que las dos contraseñas coincidan", async () => {
    const { cliente } = preparar();
    const estado = await restablecerAccion(
      INICIAL,
      formulario({ contrasena: CLAVE, confirmacion: "otra distinta y larga" }),
    );

    expect(estado.error).toBe("Las contraseñas no coinciden.");
    expect(cliente.auth.updateUser).not.toHaveBeenCalled();
  });

  it("exige el largo mínimo", async () => {
    const { cliente } = preparar();
    const estado = await restablecerAccion(INICIAL, formulario({ contrasena: "corta", confirmacion: "corta" }));

    expect(estado.error).toContain("al menos 12");
    expect(cliente.auth.updateUser).not.toHaveBeenCalled();
  });

  it("traduce same_password y weak_password", async () => {
    preparar({ errorActualizar: { code: "same_password" } });
    expect((await restablecerAccion(INICIAL, formulario({ contrasena: CLAVE, confirmacion: CLAVE }))).error).toBe(
      "La contraseña nueva debe ser distinta de la actual.",
    );

    preparar({ errorActualizar: { code: "weak_password" } });
    expect((await restablecerAccion(INICIAL, formulario({ contrasena: CLAVE, confirmacion: CLAVE }))).error).toContain(
      "demasiado débil",
    );
  });

  it("no revela el detalle de un fallo inesperado", async () => {
    preparar({ errorActualizar: { code: "algo_raro" } });
    const estado = await restablecerAccion(INICIAL, formulario({ contrasena: CLAVE, confirmacion: CLAVE }));

    expect(estado.error).toBe("No se pudo cambiar la contraseña.");
  });
});
