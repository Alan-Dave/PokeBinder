import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { INVENTARIO_MAX, obtenerEvolucionValor, SIN_SESION } from "./evolucion-valor";

type Resp = { data?: unknown[] | null; error?: { code?: string } | null };

/**
 * El inventario termina en .limit() y el historial en .range(): son los dos
 * métodos que devuelven la promesa. `historial` entrega una respuesta por llamada.
 */
function clienteFalso(opciones: { usuario?: boolean; inventario?: Resp; historial?: Resp[] }) {
  const { usuario = true, inventario = { data: [] }, historial = [{ data: [] }] } = opciones;
  const cola = [...historial];
  const rango = vi.fn(() => Promise.resolve({ data: null, error: null, ...(cola.shift() ?? { data: [] }) }));
  const filtros: Record<string, unknown> = {};
  const consulta: Record<string, unknown> = {};
  for (const m of ["select", "order", "gte"]) consulta[m] = () => consulta;
  consulta.in = (_c: string, ids: unknown) => {
    filtros.ids = ids;
    return consulta;
  };
  consulta.limit = () => Promise.resolve({ data: null, error: null, ...inventario });
  consulta.range = rango;

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: usuario ? { id: "u1" } : null } }) },
    from: vi.fn(() => consulta),
  } as never);
  return { rango };
}

const inv = (carta_id: number, cantidad = 1, variante = "normal") => ({ carta_id, variante, cantidad });
const h = (carta_id: number, fecha: string, mercado: number | string, acabado = "normal") => ({
  carta_id,
  acabado,
  fecha,
  mercado,
});

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("obtenerEvolucionValor", () => {
  it.each([{ dias: 3 }, { dias: 400 }, { dias: 1.5 }, { dias: "x" }, { dias: NaN }])(
    "rechaza el período %j sin tocar la base",
    async (entrada) => {
      const r = await obtenerEvolucionValor(entrada);

      expect(r.ok).toBe(false);
      expect(createClient).not.toHaveBeenCalled();
    },
  );

  it("pide sesión", async () => {
    clienteFalso({ usuario: false });

    expect(await obtenerEvolucionValor({})).toEqual({ ok: false, error: SIN_SESION });
  });

  it("calcula la evolución cruzando inventario e historial (numeric llega como texto)", async () => {
    clienteFalso({
      inventario: { data: [inv(1, 2)] },
      historial: [{ data: [h(1, "2026-11-01", "1.50"), h(1, "2026-11-02", 2)] }],
    });

    const r = await obtenerEvolucionValor({ dias: 30 });

    expect(r.ok && r.datos.puntos).toEqual([
      { fecha: "2026-11-01", valor: 3 },
      { fecha: "2026-11-02", valor: 4 },
    ]);
    expect(r.ok && r.datos).toMatchObject({ dias: 30, inventarioRecortado: false });
  });

  it("usa 90 días si no se indica el período", async () => {
    clienteFalso({});

    const r = await obtenerEvolucionValor();

    expect(r.ok && r.datos.dias).toBe(90);
  });

  it("descarta filas con formato inesperado en vez de fallar", async () => {
    clienteFalso({
      inventario: { data: [inv(1), { carta_id: "x" }] },
      historial: [{ data: [h(1, "2026-11-01", 5), { carta_id: 1, fecha: "ayer" }] }],
    });

    const r = await obtenerEvolucionValor({});

    expect(r.ok && r.datos.puntos).toEqual([{ fecha: "2026-11-01", valor: 5 }]);
  });

  it("sin inventario no consulta el historial", async () => {
    const { rango } = clienteFalso({ inventario: { data: [] } });

    const r = await obtenerEvolucionValor({});

    expect(rango).not.toHaveBeenCalled();
    expect(r.ok && r.datos.puntos).toEqual([]);
  });

  it("pagina el historial cuando una página viene llena", async () => {
    const llena = Array.from({ length: 1000 }, (_, i) => h(1, `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, 1));
    const { rango } = clienteFalso({ inventario: { data: [inv(1)] }, historial: [{ data: llena }, { data: [] }] });

    await obtenerEvolucionValor({});

    expect(rango).toHaveBeenCalledTimes(2);
  });

  it("consulta el historial por lotes de cartas", async () => {
    const { rango } = clienteFalso({
      inventario: { data: Array.from({ length: 26 }, (_, i) => inv(i + 1)) },
    });

    await obtenerEvolucionValor({});

    expect(rango).toHaveBeenCalledTimes(2);
  });

  it("avisa si el inventario se recortó por el tope", async () => {
    clienteFalso({ inventario: { data: Array.from({ length: INVENTARIO_MAX }, (_, i) => inv(i + 1)) } });

    const r = await obtenerEvolucionValor({});

    expect(r.ok && r.datos.inventarioRecortado).toBe(true);
  });

  it("oculta el detalle si falla el inventario o el historial", async () => {
    clienteFalso({ inventario: { error: { code: "XX000" } } });
    const a = await obtenerEvolucionValor({});
    clienteFalso({ inventario: { data: [inv(1)] }, historial: [{ error: { code: "XX000" } }] });
    const b = await obtenerEvolucionValor({});

    const esperado = { ok: false, error: "No se pudo calcular la evolución del valor." };
    expect(a).toEqual(esperado);
    expect(b).toEqual(esperado);
  });

  it("oculta el detalle de un fallo inesperado", async () => {
    vi.mocked(createClient).mockRejectedValue(new Error("detalle interno"));

    expect(await obtenerEvolucionValor({})).toEqual({
      ok: false,
      error: "No se pudo calcular la evolución del valor.",
    });
  });
});
