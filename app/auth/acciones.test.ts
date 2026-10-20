import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// redirect de Next.js corta la ejecución lanzando una excepción.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((ruta: string) => {
    throw new Error(`REDIRECT ${ruta}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { cerrarSesionAccion } from "./acciones";

function sesion(error: { code?: string } | null = null) {
  const cliente = { auth: { signOut: vi.fn().mockResolvedValue({ error }) } };
  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return cliente;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("cerrarSesionAccion", () => {
  it("cierra la sesión y redirige a /login", async () => {
    const cliente = sesion();

    await expect(cerrarSesionAccion()).rejects.toThrow("REDIRECT /login");
    expect(cliente.auth.signOut).toHaveBeenCalled();
  });

  it("redirige a /login aunque Supabase falle, registrando solo el código", async () => {
    sesion({ code: "session_not_found" });

    await expect(cerrarSesionAccion()).rejects.toThrow("REDIRECT /login");
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("session_not_found"));
  });
});
