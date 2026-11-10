import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { cambiarContrasenaAccion } from "./acciones";

const INICIAL = { error: null };
const ACTUAL = "la clave que tengo hoy";
const NUEVA = "una clave nueva y larga";

function formulario(campos: Record<string, string>) {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

const VALIDO = { contrasenaActual: ACTUAL, contrasena: NUEVA, confirmacion: NUEVA };

function preparar({
  sesion = true,
  errorVerificar = null as { code?: string } | null,
  errorActualizar = null as { code?: string } | null,
} = {}) {
  const cliente = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: sesion ? { id: "u1", email: "ana@correo.cl" } : null } }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: errorVerificar }),
      updateUser: vi.fn().mockResolvedValue({ error: errorActualizar }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  };
  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return cliente;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("cambiarContrasenaAccion", () => {
  it("verifica la contraseña actual, guarda la nueva y cierra las otras sesiones", async () => {
    const cliente = preparar();
    const estado = await cambiarContrasenaAccion(INICIAL, formulario(VALIDO));

    expect(cliente.auth.signInWithPassword).toHaveBeenCalledWith({ email: "ana@correo.cl", password: ACTUAL });
    expect(cliente.auth.updateUser).toHaveBeenCalledWith({ password: NUEVA });
    expect(cliente.auth.signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(estado.error).toBeNull();
    expect(estado.aviso).toContain("actualizada");
  });

  it("no cambia nada si la contraseña actual es incorrecta", async () => {
    const cliente = preparar({ errorVerificar: { code: "invalid_credentials" } });
    const estado = await cambiarContrasenaAccion(INICIAL, formulario(VALIDO));

    expect(estado.error).toBe("La contraseña actual no es correcta.");
    expect(cliente.auth.updateUser).not.toHaveBeenCalled();
  });

  it("exige sesión", async () => {
    const cliente = preparar({ sesion: false });
    const estado = await cambiarContrasenaAccion(INICIAL, formulario(VALIDO));

    expect(estado.error).toBe("Debes iniciar sesión para cambiar tu contraseña.");
    expect(cliente.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("exige que la nueva sea distinta de la actual", async () => {
    const cliente = preparar();
    const estado = await cambiarContrasenaAccion(
      INICIAL,
      formulario({ contrasenaActual: NUEVA, contrasena: NUEVA, confirmacion: NUEVA }),
    );

    expect(estado.error).toBe("La contraseña nueva debe ser distinta de la actual.");
    expect(cliente.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("exige que la confirmación coincida y el largo mínimo", async () => {
    const cliente = preparar();
    expect(
      (await cambiarContrasenaAccion(INICIAL, formulario({ ...VALIDO, confirmacion: "otra cosa larga!!" }))).error,
    ).toBe("Las contraseñas no coinciden.");
    expect(
      (await cambiarContrasenaAccion(INICIAL, formulario({ ...VALIDO, contrasena: "corta", confirmacion: "corta" })))
        .error,
    ).toContain("al menos 12");
    expect(cliente.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("exige la contraseña actual", async () => {
    const cliente = preparar();
    const estado = await cambiarContrasenaAccion(INICIAL, formulario({ contrasena: NUEVA, confirmacion: NUEVA }));

    expect(estado.error).not.toBeNull();
    expect(cliente.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("informa cuando Supabase limita los intentos", async () => {
    preparar({ errorVerificar: { code: "over_request_rate_limit" } });
    const estado = await cambiarContrasenaAccion(INICIAL, formulario(VALIDO));

    expect(estado.error).toBe("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.");
  });

  it("no revela el detalle de un fallo al guardar", async () => {
    preparar({ errorActualizar: { code: "algo_raro" } });
    const estado = await cambiarContrasenaAccion(INICIAL, formulario(VALIDO));

    expect(estado.error).toBe("No se pudo cambiar la contraseña.");
  });
});
