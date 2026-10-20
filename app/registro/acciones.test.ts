import { beforeEach, describe, expect, it, vi } from "vitest";

// Una Server Action es un endpoint público: estas pruebas le envían lo que
// enviaría un formulario manipulado y verifican que la validación de
// lib/auth.ts lo frena antes de llegar a Supabase Auth.
vi.mock("server-only", () => ({}));
// redirect de Next.js corta la ejecución lanzando una excepción.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((ruta: string) => {
    throw new Error(`REDIRECT ${ruta}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { registrarAccion } from "./acciones";

const INICIAL = { error: null };

const VALIDO = { correo: "ana@correo.cl", contrasena: "una clave larga", nombreVisible: "Ana" };

function formulario(campos: Record<string, string>) {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

function sesion(respuesta: { session?: unknown; error?: { code?: string } | null } = {}) {
  const cliente = {
    auth: {
      signUp: vi.fn().mockResolvedValue({
        data: { session: "session" in respuesta ? respuesta.session : { access_token: "t" } },
        error: respuesta.error ?? null,
      }),
    },
  };
  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return cliente;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(redirect).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("registrarAccion", () => {
  it("crea la cuenta y redirige al inicio cuando hay sesión", async () => {
    const cliente = sesion();

    await expect(registrarAccion(INICIAL, formulario(VALIDO))).rejects.toThrow("REDIRECT /");
    expect(cliente.auth.signUp).toHaveBeenCalledWith({
      email: "ana@correo.cl",
      password: "una clave larga",
      options: { data: { nombre_visible: "Ana" } },
    });
  });

  it("avisa que falta confirmar el correo cuando no hay sesión", async () => {
    sesion({ session: null });

    const estado = await registrarAccion(INICIAL, formulario(VALIDO));

    expect(estado.error).toBeNull();
    expect(estado.aviso).toMatch(/Revisa tu correo/);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("ignora un rol enviado en el formulario", async () => {
    const cliente = sesion();

    await expect(registrarAccion(INICIAL, formulario({ ...VALIDO, rol: "superusuario" }))).rejects.toThrow();
    expect(JSON.stringify(cliente.auth.signUp.mock.calls)).not.toContain("superusuario");
  });

  it.each([
    ["correo inválido", { ...VALIDO, correo: "no-es-correo" }],
    ["contraseña bajo 12 caracteres", { ...VALIDO, contrasena: "corta" }],
    ["contraseña sobre 72 caracteres", { ...VALIDO, contrasena: "a".repeat(73) }],
    ["nombre bajo 3 caracteres", { ...VALIDO, nombreVisible: "A" }],
    ["nombre sobre 30 caracteres", { ...VALIDO, nombreVisible: "A".repeat(31) }],
    ["campos ausentes", {}],
  ])("rechaza %s sin llamar a Supabase", async (_, campos) => {
    const estado = await registrarAccion(INICIAL, formulario(campos));

    expect(estado.error).toBeTruthy();
    expect(createClient).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([
    ["over_email_send_rate_limit", "Demasiados intentos. Espera unos minutos e inténtalo de nuevo."],
    ["weak_password", "La contraseña es demasiado débil. Usa una más larga y menos común."],
    // Mismo mensaje si el correo ya existe: no revela qué cuentas hay.
    ["user_already_exists", "No se pudo crear la cuenta. Si ya tienes una, inicia sesión."],
  ])("traduce el error %s sin redirigir", async (code, mensaje) => {
    sesion({ error: { code } });

    expect(await registrarAccion(INICIAL, formulario(VALIDO))).toEqual({ error: mensaje });
    expect(redirect).not.toHaveBeenCalled();
  });
});
