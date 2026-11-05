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
import { iniciarSesionAccion } from "./acciones";

const INICIAL = { error: null };

function formulario(campos: Record<string, string>) {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

function sesion(error: { code?: string } | null = null) {
  const cliente = { auth: { signInWithPassword: vi.fn().mockResolvedValue({ error }) } };
  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return cliente;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(redirect).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("iniciarSesionAccion", () => {
  it("inicia sesión con el correo normalizado y redirige al inicio", async () => {
    const cliente = sesion();

    await expect(
      iniciarSesionAccion(INICIAL, formulario({ correo: " Ana@Correo.CL ", contrasena: "una clave larga" })),
    ).rejects.toThrow("REDIRECT /");
    expect(cliente.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "ana@correo.cl",
      password: "una clave larga",
    });
  });

  it.each([
    ["correo inválido", { correo: "no-es-correo", contrasena: "x" }],
    ["contraseña vacía", { correo: "ana@correo.cl", contrasena: "" }],
    ["contraseña sobre 72 caracteres", { correo: "ana@correo.cl", contrasena: "a".repeat(73) }],
    ["campos ausentes", {}],
  ])("rechaza %s sin llamar a Supabase", async (_, campos) => {
    const estado = await iniciarSesionAccion(INICIAL, formulario(campos));

    expect(estado.error).toBeTruthy();
    expect(createClient).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([
    ["invalid_credentials", "Correo o contraseña incorrectos."],
    ["email_not_confirmed", "Debes confirmar tu correo antes de iniciar sesión."],
    ["over_request_rate_limit", "Demasiados intentos. Espera unos minutos e inténtalo de nuevo."],
    ["unexpected_failure", "No se pudo iniciar sesión."],
  ])("traduce el error %s sin redirigir", async (code, mensaje) => {
    sesion({ code });

    const estado = await iniciarSesionAccion(
      INICIAL,
      formulario({ correo: "ana@correo.cl", contrasena: "una clave larga" }),
    );

    expect(estado).toEqual({ error: mensaje });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("no registra la contraseña ni el correo en el log", async () => {
    sesion({ code: "unexpected_failure" });

    await iniciarSesionAccion(INICIAL, formulario({ correo: "ana@correo.cl", contrasena: "una clave larga" }));

    const log = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(log).not.toContain("una clave larga");
    expect(log).not.toContain("ana@correo.cl");
  });
});
