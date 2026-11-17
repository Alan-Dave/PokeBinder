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
  it("pide a la base la página y el tamaño, y devuelve la porción con su total", async () => {
    const fila = { id: "u1", nombre_visible: "Ana", rol: "superusuario", creado_en: "2026-01-01T00:00:00Z" };
    // count(*) llega como bigint: puede venir como texto.
    const cliente = base({ data: [{ ...fila, total: "25" }] });

    expect(await listarPerfiles({ pagina: "3" })).toEqual({
      ok: true,
      datos: { perfiles: [fila], total: 25, pagina: 3, porPagina: 10 },
    });
    expect(cliente.rpc).toHaveBeenCalledWith("listar_perfiles", { p_pagina: 3, p_tamano: 10 });
  });

  it("usa la página 1 si no se indica", async () => {
    const cliente = base({ data: [] });

    await listarPerfiles();

    expect(cliente.rpc).toHaveBeenCalledWith("listar_perfiles", { p_pagina: 1, p_tamano: 10 });
  });

  it("devuelve una lista vacía y total 0 si la página pasa del final", async () => {
    base({ data: [] });

    expect(await listarPerfiles({ pagina: "9" })).toEqual({
      ok: true,
      datos: { perfiles: [], total: 0, pagina: 9, porPagina: 10 },
    });
  });

  it.each(["0", "-1", "1.5", "abc", "100001"])("rechaza la página %s sin consultar la base", async (pagina) => {
    const cliente = base({ data: [] });

    const resultado = await listarPerfiles({ pagina });

    expect(resultado.ok).toBe(false);
    expect(cliente.rpc).not.toHaveBeenCalled();
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
