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
      json({
        pricing: { tcgplayer: { unit: "USD", updated: "2026-11-04", normal: { marketPrice: 0.12, lowPrice: 0.01 } } },
      }),
    );

    expect(await descargarPrecios("en", "sv01-001")).toEqual({
      moneda: "USD",
      actualizado: "2026-11-04",
      acabados: [{ acabado: "normal", mercado: 0.12, bajo: 0.01, medio: null, productoId: null }],
      cardmarket: null,
    });
    expect(fetchFalso).toHaveBeenCalledWith(
      "https://api.tcgdex.net/v2/en/cards/sv01-001",
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it.each([
    ["sin el campo pricing", () => json({ name: "Pineco" })],
    ["con pricing sin ninguna tienda", () => json({ pricing: {} })],
    [
      "con Cardmarket en otra moneda y sin TCGplayer",
      () => json({ pricing: { cardmarket: { unit: "USD", trend: 1 } } }),
    ],
    [
      "con TCGplayer en otra moneda",
      () => json({ pricing: { tcgplayer: { unit: "EUR", normal: { marketPrice: 1 } } } }),
    ],
    [
      "con precios que no son números",
      () => json({ pricing: { tcgplayer: { unit: "USD", normal: { marketPrice: "caro" } } } }),
    ],
    ["con precios negativos", () => json({ pricing: { tcgplayer: { unit: "USD", normal: { marketPrice: -5 } } } })],
    ["con error HTTP", () => json({}, 404)],
    ["con un JSON roto", () => new Response("{no es json")],
  ])("devuelve null %s", async (_, cuerpo) => {
    simularApi(cuerpo);

    expect(await descargarPrecios("en", "sv01-001")).toBeNull();
  });

  it("lee también Cardmarket en euros, junto a TCGplayer", async () => {
    simularApi(() =>
      json({
        pricing: {
          tcgplayer: { unit: "USD", updated: "2026-11-04", normal: { marketPrice: 11.34, productId: 42402 } },
          cardmarket: { unit: "EUR", updated: "2026-11-07", idProduct: 273753, low: 0.09, trend: 6.05 },
        },
      }),
    );

    const r = await descargarPrecios("en", "base1-58");
    expect(r?.acabados[0]).toMatchObject({ acabado: "normal", mercado: 11.34, productoId: 42402 });
    expect(r?.cardmarket).toMatchObject({
      moneda: "EUR",
      productoId: 273753,
      normal: { minimo: 0.09, tendencia: 6.05 },
    });
  });

  it("devuelve la carta con solo Cardmarket, sin acabados de TCGplayer", async () => {
    simularApi(() => json({ pricing: { cardmarket: { unit: "EUR", trend: 2 } } }));

    const r = await descargarPrecios("en", "sv01-001");
    expect(r?.acabados).toEqual([]);
    expect(r?.cardmarket?.normal.tendencia).toBe(2);
  });

  it("descarta un id de producto que no sea un entero positivo, para que no llegue a un enlace", async () => {
    simularApi(() => json({ pricing: { cardmarket: { unit: "EUR", trend: 2, idProduct: "../../evil" } } }));

    const r = await descargarPrecios("en", "sv01-001");
    expect(r?.cardmarket?.productoId).toBeNull();
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
