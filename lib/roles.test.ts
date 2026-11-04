import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { listarPerfiles } from "./roles";

function base(respuesta: { data?: unknown; error?: { code?: string } | null }) {
  const cliente = { rpc: vi.fn().mockResolvedValue({ data: null, error: null, ...respuesta }) };
  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return cliente;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("listarPerfiles", () => {
  it("devuelve los perfiles que entrega la base", async () => {
    const perfiles = [{ id: "u1", nombre_visible: "Ana", rol: "superusuario", creado_en: "2026-01-01T00:00:00Z" }];
    const cliente = base({ data: perfiles });

    expect(await listarPerfiles()).toEqual({ ok: true, datos: perfiles });
    expect(cliente.rpc).toHaveBeenCalledWith("listar_perfiles");
  });

  it("traduce el rechazo a quien no es superusuario", async () => {
    base({ error: { code: "42501" } });

    expect(await listarPerfiles()).toEqual({ ok: false, error: "No tienes permiso para realizar esta acción." });
  });

  it("oculta el detalle de un fallo inesperado", async () => {
    base({ error: { code: "XX000" } });

    expect(await listarPerfiles()).toEqual({ ok: false, error: "No se pudo completar la operación." });
  });

  it("trata un error sin código como inesperado", async () => {
    base({ error: {} });

    expect(await listarPerfiles()).toEqual({ ok: false, error: "No se pudo completar la operación." });
  });
});
