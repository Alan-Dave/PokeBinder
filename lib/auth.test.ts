import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { iniciarSesion } from "./auth";

const CREDENCIALES = { correo: "ana@correo.cl", contrasena: "una clave larga" };

function auth(error: { code?: string } | null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { signInWithPassword: vi.fn().mockResolvedValue({ error }) },
  } as never);
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("iniciarSesion con una cuenta deshabilitada", () => {
  it("explica que la cuenta está deshabilitada", async () => {
    auth({ code: "user_banned" });

    expect(await iniciarSesion(CREDENCIALES)).toEqual({
      ok: false,
      error: "Tu cuenta está deshabilitada. Contacta a un administrador.",
    });
  });

  it("no lo registra como error inesperado", async () => {
    auth({ code: "user_banned" });

    await iniciarSesion(CREDENCIALES);

    expect(console.error).not.toHaveBeenCalled();
  });
});
