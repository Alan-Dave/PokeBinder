import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/reportes", () => ({ obtenerResumenInventario: vi.fn() }));

import { obtenerResumenInventario } from "@/lib/reportes";
import { createClient } from "@/lib/supabase/server";
import { obtenerDashboard, SETS_MAX } from "./dashboard";

type Conteo = { count: number | null; error: { code: string } | null };

/** Cliente falso: cada consulta de conteo responde con la siguiente de la lista. */
function cliente(conteos: Conteo[]) {
  const cola = [...conteos];
  const filtros: unknown[][] = [];
  const from = vi.fn(() => {
    const consulta: Record<string, unknown> = {};
    consulta.select = (...args: unknown[]) => {
      filtros.push(["select", ...args]);
      return consulta;
    };
    consulta.eq = (...args: unknown[]) => {
      filtros.push(["eq", ...args]);
      return consulta;
    };
    consulta.then = (r: (v: unknown) => unknown) => Promise.resolve(cola.shift() ?? { count: 0, error: null }).then(r);
    return consulta;
  });
  vi.mocked(createClient).mockResolvedValue({ from } as never);
  return { from, filtros };
}

const resumen = (porSet: { setId: string; idioma: string; copias: number; distintas: number }[], extra = {}) => ({
  ok: true as const,
  datos: {
    copias: porSet.reduce((n, s) => n + s.copias, 0),
    distintas: porSet.reduce((n, s) => n + s.distintas, 0),
    valorEstimado: 12.5,
    sinPrecio: 0,
    porIdioma: [],
    porSet,
    nombresSet: {},
    ...extra,
  },
});

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(obtenerResumenInventario).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("obtenerDashboard", () => {
  it.each([{ idioma: "klingon" }, { setId: "sv1; drop table" }])(
    "rechaza el filtro %j sin consultar",
    async (entrada) => {
      const r = await obtenerDashboard(entrada);

      expect(r.ok).toBe(false);
      expect(obtenerResumenInventario).not.toHaveBeenCalled();
      expect(createClient).not.toHaveBeenCalled();
    },
  );

  it("propaga el error del resumen (por ejemplo, sin sesión)", async () => {
    vi.mocked(obtenerResumenInventario).mockResolvedValue({ ok: false, error: "Se requiere una sesión iniciada." });

    expect(await obtenerDashboard()).toEqual({ ok: false, error: "Se requiere una sesión iniciada." });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("calcula el avance de cada set con el total de cartas del catálogo", async () => {
    vi.mocked(obtenerResumenInventario).mockResolvedValue(
      resumen([{ setId: "sv1", idioma: "en", copias: 4, distintas: 3 }]),
    );
    const { filtros } = cliente([{ count: 10, error: null }]);

    const r = await obtenerDashboard();

    expect(r.ok && r.datos.analisis.sets[0]).toMatchObject({ tengo: 3, total: 10, faltan: 7, porcentaje: 30 });
    expect(r.ok && r.datos.analisis.masCercano?.setId).toBe("sv1");
    expect(filtros).toContainEqual(["eq", "set_id", "sv1"]);
    expect(filtros).toContainEqual(["eq", "idioma", "en"]);
  });

  it("pasa los filtros validados al resumen", async () => {
    vi.mocked(obtenerResumenInventario).mockResolvedValue(resumen([]));
    cliente([]);

    await obtenerDashboard({ idioma: "", setId: " ", rareza: "" });

    expect(obtenerResumenInventario).toHaveBeenCalledWith({});
    await obtenerDashboard({ idioma: "es" });
    expect(obtenerResumenInventario).toHaveBeenLastCalledWith({ idioma: "es" });
  });

  it("solo cuenta los sets con más copias", async () => {
    const muchos = Array.from({ length: SETS_MAX + 5 }, (_, i) => ({
      setId: `s${i}`,
      idioma: "en",
      copias: 20 - i,
      distintas: 1,
    }));
    vi.mocked(obtenerResumenInventario).mockResolvedValue(resumen(muchos));
    const { from } = cliente([]);

    const r = await obtenerDashboard();

    expect(from).toHaveBeenCalledTimes(SETS_MAX);
    expect(r.ok && r.datos.analisis.sets).toHaveLength(0);
  });

  it("un conteo sin dato se trata como set desconocido", async () => {
    vi.mocked(obtenerResumenInventario).mockResolvedValue(
      resumen([{ setId: "sv1", idioma: "en", copias: 1, distintas: 1 }]),
    );
    cliente([{ count: null, error: null }]);

    const r = await obtenerDashboard();

    expect(r.ok && r.datos.analisis.sets).toEqual([]);
  });

  it("oculta el detalle de un fallo al contar", async () => {
    vi.mocked(obtenerResumenInventario).mockResolvedValue(
      resumen([{ setId: "sv1", idioma: "en", copias: 1, distintas: 1 }]),
    );
    cliente([{ count: null, error: { code: "XX000" } }]);

    expect(await obtenerDashboard()).toEqual({ ok: false, error: "No se pudo generar el dashboard." });
  });
});
