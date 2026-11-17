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

function crearPerfiles(cantidad: number) {
  return Array.from({ length: cantidad }, (_, i) => ({
    id: `u${i + 1}`,
    nombre_visible: `Usuario ${i + 1}`,
    rol: "usuario_normal",
    creado_en: "2026-01-01T00:00:00Z",
  }));
}

describe("listarPerfiles", () => {
  it("devuelve los perfiles que entrega la base", async () => {
    const perfiles = [{ id: "u1", nombre_visible: "Ana", rol: "superusuario", creado_en: "2026-01-01T00:00:00Z" }];
    const cliente = base({ data: perfiles });

    expect(await listarPerfiles()).toEqual({
      ok: true,
      datos: { perfiles, total: 1, pagina: 1, porPagina: 10 },
    });
    expect(cliente.rpc).toHaveBeenCalledWith("listar_perfiles");
  });

  it("muestra solo 10 usuarios en la primera página", async () => {
    base({ data: crearPerfiles(25) });

    const resultado = await listarPerfiles({ pagina: "1" });

    expect(resultado.ok && resultado.datos.perfiles.map((p) => p.id)).toEqual(
      crearPerfiles(10).map((p) => p.id),
    );
    expect(resultado.ok && resultado.datos.total).toBe(25);
  });

  it("entrega el resto en la última página", async () => {
    base({ data: crearPerfiles(25) });

    const resultado = await listarPerfiles({ pagina: "3" });

    expect(resultado.ok && resultado.datos.perfiles.map((p) => p.id)).toEqual(["u21", "u22", "u23", "u24", "u25"]);
  });

  it("devuelve una lista vacía si la página pasa del final", async () => {
    base({ data: crearPerfiles(5) });

    const resultado = await listarPerfiles({ pagina: "4" });

    expect(resultado.ok && resultado.datos.perfiles).toEqual([]);
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
