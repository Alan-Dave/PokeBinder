import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { descargarPrecios } from "./tcgdex";

afterEach(() => vi.unstubAllGlobals());

const json = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado });

function simularApi(cuerpo: () => Response) {
  const fetchFalso = vi.fn(async () => cuerpo());
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

describe("descargarPrecios", () => {
  it("lee el precio de mercado de TCGplayer en dólares", async () => {
    const fetchFalso = simularApi(() =>
      json({ pricing: { tcgplayer: { unit: "USD", updated: "2026-11-04", normal: { marketPrice: 0.12, lowPrice: 0.01 } } } }),
    );

    expect(await descargarPrecios("en", "sv01-001")).toEqual({
      moneda: "USD",
      actualizado: "2026-11-04",
      acabados: [{ acabado: "normal", mercado: 0.12 }],
    });
    expect(fetchFalso).toHaveBeenCalledWith(
      "https://api.tcgdex.net/v2/en/cards/sv01-001",
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it.each([
    ["sin el campo pricing", () => json({ name: "Pineco" })],
    ["con pricing sin TCGplayer", () => json({ pricing: { cardmarket: { unit: "EUR", trend: 1 } } })],
    ["con TCGplayer en otra moneda", () => json({ pricing: { tcgplayer: { unit: "EUR", normal: { marketPrice: 1 } } } })],
    ["con precios que no son números", () => json({ pricing: { tcgplayer: { unit: "USD", normal: { marketPrice: "caro" } } } })],
    ["con precios negativos", () => json({ pricing: { tcgplayer: { unit: "USD", normal: { marketPrice: -5 } } } })],
    ["con error HTTP", () => json({}, 404)],
    ["con un JSON roto", () => new Response("{no es json")],
  ])("devuelve null %s", async (_, cuerpo) => {
    simularApi(cuerpo);

    expect(await descargarPrecios("en", "sv01-001")).toBeNull();
  });

  it("devuelve null si falla la red", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("red")));

    expect(await descargarPrecios("en", "sv01-001")).toBeNull();
  });

  it("no consulta con un id_api inválido", async () => {
    const fetchFalso = simularApi(() => json({}));

    expect(await descargarPrecios("en", "../../x")).toBeNull();
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
