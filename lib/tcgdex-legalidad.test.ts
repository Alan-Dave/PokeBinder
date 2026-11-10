import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { descargarLegalidad } from "./tcgdex";

afterEach(() => vi.unstubAllGlobals());

const json = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado });

function simularApi(cuerpo: () => Response) {
  const fetchFalso = vi.fn(async () => cuerpo());
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

describe("descargarLegalidad", () => {
  it("lee los dos formatos de la carta", async () => {
    const fetchFalso = simularApi(() => json({ legal: { standard: false, expanded: true } }));

    expect(await descargarLegalidad("en", "sv01-001")).toEqual({ standard: false, expanded: true });
    expect(fetchFalso).toHaveBeenCalledWith(
      "https://api.tcgdex.net/v2/en/cards/sv01-001",
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("completa con null el formato que no informa", async () => {
    simularApi(() => json({ legal: { expanded: true } }));

    expect(await descargarLegalidad("en", "sv01-001")).toEqual({ standard: null, expanded: true });
  });

  it.each([
    ["sin el campo legal", () => json({ name: "Pineco" })],
    ["con legal vacío", () => json({ legal: {} })],
    ["con valores que no son booleanos", () => json({ legal: { standard: "sí" } })],
    ["con error HTTP", () => json({}, 404)],
    ["con un JSON roto", () => new Response("{no es json")],
  ])("devuelve null %s", async (_, cuerpo) => {
    simularApi(cuerpo);

    expect(await descargarLegalidad("en", "sv01-001")).toBeNull();
  });

  it("devuelve null si falla la red", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("red")));

    expect(await descargarLegalidad("en", "sv01-001")).toBeNull();
  });

  it("no consulta con un id_api inválido", async () => {
    const fetchFalso = simularApi(() => json({ legal: { standard: true } }));

    expect(await descargarLegalidad("en", "../../x")).toBeNull();
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
