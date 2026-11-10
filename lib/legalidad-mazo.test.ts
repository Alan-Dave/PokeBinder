import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/mazos", () => ({ obtenerMazo: vi.fn() }));
vi.mock("@/lib/tcgdex", () => ({ descargarLegalidad: vi.fn() }));

import { obtenerMazo } from "@/lib/mazos";
import { descargarLegalidad } from "@/lib/tcgdex";
import {
  LINEAS_MAX,
  obtenerLegalidadMazo,
  vaciarCacheLegalidad,
  VIGENCIA_ACIERTO_MS,
  VIGENCIA_FALLO_MS,
} from "./legalidad-mazo";

const linea = (cartaId: number, idioma = "en", nombre = `Carta ${cartaId}`) => ({
  cartaId,
  cantidad: 1,
  nombre,
  idApi: `sv01-${cartaId}`,
  idioma,
  stage: null,
});

function mazo(lineas: ReturnType<typeof linea>[]) {
  vi.mocked(obtenerMazo).mockResolvedValue({
    ok: true,
    datos: { mazo: { id: 5, nombre: "Fuego" }, lineas, reglas: {} as never },
  });
}

const LEGAL = { standard: true, expanded: true };
const SOLO_EXPANDED = { standard: false, expanded: true };

beforeEach(() => {
  vi.useRealTimers();
  vaciarCacheLegalidad();
  vi.mocked(obtenerMazo).mockReset();
  vi.mocked(descargarLegalidad).mockReset().mockResolvedValue(LEGAL);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("obtenerLegalidadMazo: entrada y mazo", () => {
  it.each([{ mazoId: -1, formato: "standard" }, { mazoId: 1, formato: "x" }, { mazoId: 1 }, {}])(
    "rechaza %j sin tocar el mazo ni TCGdex",
    async (entrada) => {
      const r = await obtenerLegalidadMazo(entrada);

      expect(r.ok).toBe(false);
      expect(obtenerMazo).not.toHaveBeenCalled();
      expect(descargarLegalidad).not.toHaveBeenCalled();
    },
  );

  it("propaga el error de obtenerMazo (sin sesión o mazo ajeno)", async () => {
    vi.mocked(obtenerMazo).mockResolvedValue({ ok: false, error: "El mazo no existe o no te pertenece." });

    expect(await obtenerLegalidadMazo({ mazoId: 5, formato: "standard" })).toEqual({
      ok: false,
      error: "El mazo no existe o no te pertenece.",
    });
    expect(descargarLegalidad).not.toHaveBeenCalled();
  });

  it("avisa si el mazo está vacío", async () => {
    mazo([]);

    expect(await obtenerLegalidadMazo({ mazoId: 5, formato: "standard" })).toEqual({
      ok: false,
      error: "El mazo está vacío: no hay nada que comprobar.",
    });
  });

  it("rechaza un mazo con demasiadas cartas distintas sin consultar", async () => {
    mazo(Array.from({ length: LINEAS_MAX + 1 }, (_, i) => linea(i + 1)));

    const r = await obtenerLegalidadMazo({ mazoId: 5, formato: "standard" });

    expect(!r.ok && r.error).toContain(`hasta ${LINEAS_MAX}`);
    expect(descargarLegalidad).not.toHaveBeenCalled();
  });
});

describe("obtenerLegalidadMazo: veredicto", () => {
  it("marca legal un mazo cuyas cartas TCGdex confirma", async () => {
    mazo([linea(1), linea(2)]);

    const r = await obtenerLegalidadMazo({ mazoId: 5, formato: "standard" });

    expect(r.ok && r.datos.veredicto).toBe("legal");
  });

  it("marca no legal en Standard y legal en Expanded", async () => {
    mazo([linea(1)]);
    vi.mocked(descargarLegalidad).mockResolvedValue(SOLO_EXPANDED);

    const standard = await obtenerLegalidadMazo({ mazoId: 5, formato: "standard" });
    const expanded = await obtenerLegalidadMazo({ mazoId: 5, formato: "expanded" });

    expect(standard.ok && standard.datos.veredicto).toBe("no-legal");
    expect(expanded.ok && expanded.datos.veredicto).toBe("legal");
  });

  it("si TCGdex no responde, el mazo no es verificable y nunca legal", async () => {
    mazo([linea(1)]);
    vi.mocked(descargarLegalidad).mockResolvedValue(null);

    const r = await obtenerLegalidadMazo({ mazoId: 5, formato: "standard" });

    expect(r.ok && r.datos.veredicto).toBe("no-verificable");
  });

  it("oculta el detalle de un fallo inesperado", async () => {
    mazo([linea(1)]);
    vi.mocked(descargarLegalidad).mockRejectedValue(new Error("detalle interno"));

    expect(await obtenerLegalidadMazo({ mazoId: 5, formato: "standard" })).toEqual({
      ok: false,
      error: "No se pudo comprobar la legalidad del mazo.",
    });
  });
});

describe("obtenerLegalidadMazo: idiomas", () => {
  it("prueba el idioma de la carta y luego el inglés", async () => {
    mazo([linea(1, "ja")]);
    vi.mocked(descargarLegalidad).mockResolvedValueOnce(null).mockResolvedValueOnce(LEGAL);

    const r = await obtenerLegalidadMazo({ mazoId: 5, formato: "standard" });

    expect(vi.mocked(descargarLegalidad).mock.calls.map(([i]) => i)).toEqual(["ja", "en"]);
    expect(r.ok && r.datos.veredicto).toBe("legal");
  });

  it("no repite la consulta en inglés para una carta en inglés", async () => {
    mazo([linea(1, "en")]);
    vi.mocked(descargarLegalidad).mockResolvedValue(null);

    await obtenerLegalidadMazo({ mazoId: 5, formato: "standard" });

    expect(descargarLegalidad).toHaveBeenCalledTimes(1);
  });

  it("el chino, que TCGdex no tiene, va directo al inglés", async () => {
    mazo([linea(1, "zh")]);

    await obtenerLegalidadMazo({ mazoId: 5, formato: "standard" });

    expect(vi.mocked(descargarLegalidad).mock.calls.map(([i]) => i)).toEqual(["en"]);
  });
});

describe("obtenerLegalidadMazo: caché", () => {
  it("no vuelve a consultar una carta ya conocida", async () => {
    mazo([linea(1)]);

    await obtenerLegalidadMazo({ mazoId: 5, formato: "standard" });
    await obtenerLegalidadMazo({ mazoId: 5, formato: "expanded" });

    expect(descargarLegalidad).toHaveBeenCalledTimes(1);
  });

  it("consulta una sola vez si dos peticiones piden la misma carta a la vez", async () => {
    mazo([linea(1)]);

    await Promise.all([
      obtenerLegalidadMazo({ mazoId: 5, formato: "standard" }),
      obtenerLegalidadMazo({ mazoId: 5, formato: "standard" }),
    ]);

    expect(descargarLegalidad).toHaveBeenCalledTimes(1);
  });

  it("un acierto vence a las 24 horas", async () => {
    vi.useFakeTimers();
    mazo([linea(1)]);

    await obtenerLegalidadMazo({ mazoId: 5, formato: "standard" });
    vi.advanceTimersByTime(VIGENCIA_ACIERTO_MS - 1);
    await obtenerLegalidadMazo({ mazoId: 5, formato: "standard" });
    expect(descargarLegalidad).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2);
    await obtenerLegalidadMazo({ mazoId: 5, formato: "standard" });
    expect(descargarLegalidad).toHaveBeenCalledTimes(2);
  });

  it("un fallo se reintenta pronto, no a las 24 horas", async () => {
    vi.useFakeTimers();
    mazo([linea(1)]);
    vi.mocked(descargarLegalidad).mockResolvedValueOnce(null).mockResolvedValue(LEGAL);

    const primero = await obtenerLegalidadMazo({ mazoId: 5, formato: "standard" });
    vi.advanceTimersByTime(VIGENCIA_FALLO_MS + 1);
    const segundo = await obtenerLegalidadMazo({ mazoId: 5, formato: "standard" });

    expect(primero.ok && primero.datos.veredicto).toBe("no-verificable");
    expect(segundo.ok && segundo.datos.veredicto).toBe("legal");
  });
});
