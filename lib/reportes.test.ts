import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { cambiarEstadoReporte, crearReporte, listarReportes, puedeRevisarReportes, SIN_SESION } from "./reportes";

type Resp = { data?: unknown; error?: { code?: string } | null };

/** Cliente falso: todas las consultas devuelven la misma respuesta, y se anotan las llamadas. */
function clienteFalso(opciones: { usuario?: boolean; respuesta?: Resp } = {}) {
  const { usuario = true, respuesta = {} } = opciones;
  const resultado = { data: null, error: null, ...respuesta };
  const llamadas: Record<string, unknown[]> = {};
  const consulta: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "update"]) {
    consulta[m] = (...args: unknown[]) => {
      (llamadas[m] ??= []).push(args);
      return consulta;
    };
  }
  consulta.insert = (fila: unknown) => {
    (llamadas.insert ??= []).push([fila]);
    return Promise.resolve(resultado);
  };
  consulta.limit = () => Promise.resolve(resultado);
  consulta.maybeSingle = () => Promise.resolve(resultado);

  const from = vi.fn(() => consulta);
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: usuario ? { id: "u1" } : null } }) },
    from,
  } as never);
  return { from, llamadas };
}

const reporte = { cartaId: 5, motivo: "nombre", detalle: "El nombre tiene una errata" };

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("crearReporte", () => {
  it("inserta sin enviar nunca el usuario ni el estado", async () => {
    const { from, llamadas } = clienteFalso();

    expect(await crearReporte(reporte)).toEqual({ ok: true, datos: null });
    expect(from).toHaveBeenCalledWith("reportes_catalogo");
    expect(llamadas.insert[0]).toEqual([{ carta_id: 5, motivo: "nombre", detalle: "El nombre tiene una errata" }]);
  });

  it("ignora un usuario o estado que venga en la entrada", async () => {
    const { llamadas } = clienteFalso();

    await crearReporte({ ...reporte, usuario_id: "otro", estado: "resuelto" });

    expect(llamadas.insert[0]).toEqual([{ carta_id: 5, motivo: "nombre", detalle: "El nombre tiene una errata" }]);
  });

  it("rechaza una entrada inválida sin tocar la base", async () => {
    const r = await crearReporte({ ...reporte, detalle: "corto" });

    expect(r.ok).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("pide sesión", async () => {
    clienteFalso({ usuario: false });

    expect(await crearReporte(reporte)).toEqual({ ok: false, error: SIN_SESION });
  });

  it.each([
    ["23505", "Ya enviaste un reporte abierto de ese tipo para esta carta."],
    ["23503", "La carta no existe."],
    ["42501", "No tienes permiso para realizar esta acción."],
  ])("traduce el error %s", async (code, mensaje) => {
    clienteFalso({ respuesta: { error: { code } } });

    expect(await crearReporte(reporte)).toEqual({ ok: false, error: mensaje });
  });

  it("explica el tope diario (check_violation)", async () => {
    clienteFalso({ respuesta: { error: { code: "23514" } } });

    const r = await crearReporte(reporte);

    expect(!r.ok && r.error).toContain("20 reportes por día");
  });

  it("oculta el detalle de un error inesperado", async () => {
    clienteFalso({ respuesta: { error: { code: "XX000" } } });

    expect(await crearReporte(reporte)).toEqual({ ok: false, error: "No se pudo completar la operación." });
  });

  it("registra un error sin código sin mostrarlo", async () => {
    clienteFalso({ respuesta: { error: {} } });

    expect((await crearReporte(reporte)).ok).toBe(false);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("puedeRevisarReportes", () => {
  it.each([
    ["administrador", true],
    ["superusuario", true],
    ["usuario_normal", false],
  ])("el rol %s -> %s", async (rol, esperado) => {
    clienteFalso({ respuesta: { data: { rol } } });

    expect(await puedeRevisarReportes()).toBe(esperado);
  });

  it("sin sesión o sin perfil no puede", async () => {
    clienteFalso({ usuario: false });
    expect(await puedeRevisarReportes()).toBe(false);

    clienteFalso({ respuesta: { data: null } });
    expect(await puedeRevisarReportes()).toBe(false);
  });
});

describe("listarReportes", () => {
  it("lista los abiertos por defecto", async () => {
    const { llamadas } = clienteFalso({ respuesta: { data: [{ id: 1 }] } });

    const r = await listarReportes();

    expect(r).toEqual({ ok: true, datos: [{ id: 1 }] });
    expect(llamadas.eq[0]).toEqual(["estado", "abierto"]);
  });

  it("filtra por el estado pedido", async () => {
    const { llamadas } = clienteFalso({ respuesta: { data: [] } });

    await listarReportes({ estado: "resuelto" });

    expect(llamadas.eq[0]).toEqual(["estado", "resuelto"]);
  });

  it("rechaza un estado inválido sin tocar la base", async () => {
    expect((await listarReportes({ estado: "todos" })).ok).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("pide sesión", async () => {
    clienteFalso({ usuario: false });

    expect(await listarReportes()).toEqual({ ok: false, error: SIN_SESION });
  });

  it("oculta el detalle de un error de la base", async () => {
    clienteFalso({ respuesta: { error: { code: "XX000" } } });

    expect(await listarReportes()).toEqual({ ok: false, error: "No se pudo completar la operación." });
  });
});

describe("cambiarEstadoReporte", () => {
  it("cierra el reporte y solo envía el estado", async () => {
    const { llamadas } = clienteFalso({ respuesta: { data: { id: 3 } } });

    expect(await cambiarEstadoReporte({ id: 3, estado: "resuelto" })).toEqual({ ok: true, datos: null });
    expect(llamadas.update[0]).toEqual([{ estado: "resuelto" }]);
  });

  it("si RLS oculta la fila (no es administrador) no confirma el cambio", async () => {
    clienteFalso({ respuesta: { data: null } });

    const r = await cambiarEstadoReporte({ id: 3, estado: "resuelto" });

    expect(r).toEqual({ ok: false, error: "El reporte no existe o no tienes permiso para cambiarlo." });
  });

  it("rechaza reabrir o un id inválido sin tocar la base", async () => {
    expect((await cambiarEstadoReporte({ id: 3, estado: "abierto" })).ok).toBe(false);
    expect((await cambiarEstadoReporte({ id: -3, estado: "resuelto" })).ok).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("pide sesión", async () => {
    clienteFalso({ usuario: false });

    expect(await cambiarEstadoReporte({ id: 3, estado: "resuelto" })).toEqual({ ok: false, error: SIN_SESION });
  });

  it("traduce el permiso denegado y oculta lo inesperado", async () => {
    clienteFalso({ respuesta: { error: { code: "42501" } } });
    expect(await cambiarEstadoReporte({ id: 3, estado: "resuelto" })).toEqual({
      ok: false,
      error: "No tienes permiso para realizar esta acción.",
    });

    clienteFalso({ respuesta: { error: { code: "XX000" } } });
    expect(await cambiarEstadoReporte({ id: 3, estado: "resuelto" })).toEqual({
      ok: false,
      error: "No se pudo completar la operación.",
    });
  });
});
