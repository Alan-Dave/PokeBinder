import { beforeEach, describe, expect, it, vi } from "vitest";

// Una Server Action es un endpoint público: estas pruebas le envían lo que
// enviaría un formulario manipulado y verifican que la validación de
// lib/auth.ts lo frena antes de llegar a Supabase Auth.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { recuperarAccion } from "./acciones";

const INICIAL = { error: null };

function formulario(campos: Record<string, string>) {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

function preparar(origen: string | null, error: { code?: string } | null = null) {
  vi.mocked(headers).mockResolvedValue({ get: (nombre: string) => (nombre === "origin" ? origen : null) } as never);
  const cliente = { auth: { resetPasswordForEmail: vi.fn().mockResolvedValue({ error }) } };
  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return cliente;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(headers).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("recuperarAccion", () => {
  it("pide el correo con el correo normalizado y el destino del mismo origen", async () => {
    const cliente = preparar("https://poke-binder.vercel.app");
    const estado = await recuperarAccion(INICIAL, formulario({ correo: "  Ana@Correo.CL " }));

    expect(cliente.auth.resetPasswordForEmail).toHaveBeenCalledWith("ana@correo.cl", {
      redirectTo: "https://poke-binder.vercel.app/auth/callback",
    });
    expect(estado.error).toBeNull();
    expect(estado.aviso).toContain("Si el correo está registrado");
  });

  it("usa solo el origen: una ruta agregada no llega al enlace", async () => {
    const cliente = preparar("https://poke-binder.vercel.app/ruta/maliciosa?x=1");
    await recuperarAccion(INICIAL, formulario({ correo: "ana@correo.cl" }));

    expect(cliente.auth.resetPasswordForEmail).toHaveBeenCalledWith("ana@correo.cl", {
      redirectTo: "https://poke-binder.vercel.app/auth/callback",
    });
  });

  it("rechaza un correo inválido sin llamar a Supabase", async () => {
    const cliente = preparar("https://poke-binder.vercel.app");
    const estado = await recuperarAccion(INICIAL, formulario({ correo: "no-es-correo" }));

    expect(estado.error).toBe("El correo no es válido.");
    expect(cliente.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("rechaza que falte el campo correo", async () => {
    const cliente = preparar("https://poke-binder.vercel.app");
    const estado = await recuperarAccion(INICIAL, formulario({}));

    expect(estado.error).not.toBeNull();
    expect(cliente.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it.each([null, "javascript:alert(1)", "ftp://sitio.cl", "no-es-url"])(
    "no envía el correo si el origen es %j",
    async (origen) => {
      const cliente = preparar(origen);
      const estado = await recuperarAccion(INICIAL, formulario({ correo: "ana@correo.cl" }));

      expect(estado.error).toBe("No se pudo enviar el correo. Inténtalo de nuevo.");
      expect(cliente.auth.resetPasswordForEmail).not.toHaveBeenCalled();
    },
  );

  it("informa cuando Supabase limita los intentos", async () => {
    preparar("https://poke-binder.vercel.app", { code: "over_email_send_rate_limit" });
    const estado = await recuperarAccion(INICIAL, formulario({ correo: "ana@correo.cl" }));

    expect(estado.error).toBe("Demasiados intentos. Espera unos minutos e inténtalo de nuevo.");
  });

  it("no revela el detalle de un fallo inesperado y lo registra sin el correo", async () => {
    preparar("https://poke-binder.vercel.app", { code: "unexpected_failure" });
    const estado = await recuperarAccion(INICIAL, formulario({ correo: "ana@correo.cl" }));

    expect(estado.error).toBe("No se pudo enviar el correo. Inténtalo de nuevo más tarde.");
    const registro = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(registro).toContain("unexpected_failure");
    expect(registro).not.toContain("ana@correo.cl");
  });
});
