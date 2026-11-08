import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/tcgdex", () => ({ descargarPrecios: vi.fn() }));

import { descargarPrecios } from "@/lib/tcgdex";
import {
  obtenerPreciosCartas,
  variantesDeId,
  vaciarCachePrecios,
  VIGENCIA_ACIERTO_MS,
  VIGENCIA_FALLO_MS,
} from "./precios-carta";

const PRECIOS = { moneda: "USD" as const, actualizado: null, acabados: [{ acabado: "normal", mercado: 1 }] };
const carta = (idApi: string, idioma = "en") => ({ idApi, idioma });

beforeEach(() => {
  vi.useRealTimers();
  vaciarCachePrecios();
  vi.mocked(descargarPrecios).mockReset().mockResolvedValue(PRECIOS);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("obtenerPreciosCartas: entrada", () => {
  it.each([
    ["algo que no es lista", "x"],
    ["un id_api con ruta", [carta("../../x")]],
    ["una carta sin idioma", [{ idApi: "sv01-001" }]],
    ["demasiadas cartas", Array.from({ length: 31 }, (_, i) => carta(`sv01-${i + 1}`))],
  ])("rechaza %s sin consultar a TCGdex", async (_, entrada) => {
    const r = await obtenerPreciosCartas(entrada);

    expect(r.size).toBe(0);
    expect(descargarPrecios).not.toHaveBeenCalled();
  });

  it("una carta con id inválido no deja sin precio a las demás", async () => {
    const r = await obtenerPreciosCartas([carta("../../x"), carta("sv01-001"), { idApi: "sv01-002" }]);

    expect(r.size).toBe(1);
    expect(r.get("sv01-001")).toEqual(PRECIOS);
    expect(descargarPrecios).toHaveBeenCalledTimes(1);
  });

  it("una lista vacía no consulta nada", async () => {
    expect((await obtenerPreciosCartas([])).size).toBe(0);
    expect(descargarPrecios).not.toHaveBeenCalled();
  });
});

describe("obtenerPreciosCartas: resultado", () => {
  it("devuelve los precios por id_api", async () => {
    const r = await obtenerPreciosCartas([carta("sv01-001"), carta("sv01-002")]);

    expect(r.get("sv01-001")).toEqual(PRECIOS);
    expect(r.get("sv01-002")).toEqual(PRECIOS);
  });

  it("una carta sin precio queda en null, no en 0", async () => {
    vi.mocked(descargarPrecios).mockResolvedValue(null);

    expect((await obtenerPreciosCartas([carta("sv01-001")])).get("sv01-001")).toBeNull();
  });

  it("consulta una sola vez la carta repetida en varias variantes", async () => {
    await obtenerPreciosCartas([carta("sv01-001"), carta("sv01-001")]);

    expect(descargarPrecios).toHaveBeenCalledTimes(1);
  });

  it("si algo falla, deja la carta sin precio y no revela el detalle", async () => {
    vi.mocked(descargarPrecios).mockRejectedValue(new Error("detalle interno"));

    const r = await obtenerPreciosCartas([carta("sv01-001")]);

    expect(r.get("sv01-001")).toBeNull();
  });
});

describe("obtenerPreciosCartas: idiomas", () => {
  it("prueba el idioma de la carta y luego el inglés", async () => {
    vi.mocked(descargarPrecios).mockResolvedValueOnce(null).mockResolvedValueOnce(PRECIOS);

    const r = await obtenerPreciosCartas([carta("base1-004", "ja")]);

    expect(vi.mocked(descargarPrecios).mock.calls.map(([i]) => i)).toEqual(["ja", "en"]);
    expect(r.get("base1-004")).toEqual(PRECIOS);
  });

  it("el chino va directo al inglés", async () => {
    await obtenerPreciosCartas([carta("base1-004", "zh")]);

    expect(vi.mocked(descargarPrecios).mock.calls.map(([i]) => i)).toEqual(["en"]);
  });
});

describe("variantesDeId y relleno de ceros", () => {
  it.each([
    ["swsh11-43", ["swsh11-43", "swsh11-043"]],
    ["sv10-6", ["sv10-6", "sv10-006"]],
    ["sv10-060", ["sv10-060"]],
    ["swsh10.5tg-TG01", ["swsh10.5tg-TG01"]],
    ["base1-58", ["base1-58", "base1-058"]],
    // Sets de Escarlata y Púrpura con otro nombre en TCGdex.
    ["sv2-11", ["sv2-11", "sv02-11", "sv02-011"]],
    ["sv2-011", ["sv2-011", "sv02-011"]],
    ["sv4pt5-101", ["sv4pt5-101", "sv04.5-101"]],
    ["sv3pt5-7", ["sv3pt5-7", "sv03.5-7", "sv03.5-007"]],
    ["sv8pt5-100", ["sv8pt5-100", "sv08.5-100"]],
    ["sv04.5-101", ["sv04.5-101"]],
    // No se traduce nada que no esté comprobado.
    ["swsh9.5tg-TG01", ["swsh9.5tg-TG01"]],
    ["sv10-060", ["sv10-060"]],
    ["sv1x-5", ["sv1x-5", "sv1x-005"]],
    ["singuion", ["singuion"]],
  ])("%s", (id, esperado) => {
    expect(variantesDeId(id)).toEqual(esperado);
  });

  it("si el id sin ceros no existe, prueba el rellenado", async () => {
    vi.mocked(descargarPrecios).mockResolvedValueOnce(null).mockResolvedValueOnce(PRECIOS);

    const r = await obtenerPreciosCartas([carta("swsh11-43")]);

    expect(vi.mocked(descargarPrecios).mock.calls.map(([, id]) => id)).toEqual(["swsh11-43", "swsh11-043"]);
    expect(r.get("swsh11-43")).toEqual(PRECIOS);
  });
});

describe("obtenerPreciosCartas: caché", () => {
  it("no vuelve a consultar una carta ya conocida", async () => {
    await obtenerPreciosCartas([carta("sv01-001")]);
    await obtenerPreciosCartas([carta("sv01-001")]);

    expect(descargarPrecios).toHaveBeenCalledTimes(1);
  });

  it("consulta una sola vez si dos peticiones piden la misma carta a la vez", async () => {
    await Promise.all([obtenerPreciosCartas([carta("sv01-001")]), obtenerPreciosCartas([carta("sv01-001")])]);

    expect(descargarPrecios).toHaveBeenCalledTimes(1);
  });

  it("un acierto vence a las 6 horas", async () => {
    vi.useFakeTimers();

    await obtenerPreciosCartas([carta("sv01-001")]);
    vi.advanceTimersByTime(VIGENCIA_ACIERTO_MS - 1);
    await obtenerPreciosCartas([carta("sv01-001")]);
    expect(descargarPrecios).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2);
    await obtenerPreciosCartas([carta("sv01-001")]);
    expect(descargarPrecios).toHaveBeenCalledTimes(2);
  });

  it("un fallo se reintenta pronto", async () => {
    vi.useFakeTimers();
    vi.mocked(descargarPrecios).mockResolvedValueOnce(null).mockResolvedValue(PRECIOS);

    const primero = await obtenerPreciosCartas([carta("sv01-001")]);
    vi.advanceTimersByTime(VIGENCIA_FALLO_MS + 1);
    const segundo = await obtenerPreciosCartas([carta("sv01-001")]);

    expect(primero.get("sv01-001")).toBeNull();
    expect(segundo.get("sv01-001")).toEqual(PRECIOS);
  });
});
