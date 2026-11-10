import { describe, expect, it } from "vitest";
import { estadoDeCarta, evaluarLegalidad, type LegalidadCarta } from "./legalidad";

const LEGAL: LegalidadCarta = { standard: true, expanded: true };
const SOLO_EXPANDED: LegalidadCarta = { standard: false, expanded: true };

const linea = (cartaId: number, nombre = `Carta ${cartaId}`) => ({ cartaId, nombre });
const mapa = (...pares: [number, LegalidadCarta | null][]) => new Map(pares);

describe("estadoDeCarta", () => {
  it("lee el formato pedido", () => {
    expect(estadoDeCarta(SOLO_EXPANDED, "standard")).toBe("no-legal");
    expect(estadoDeCarta(SOLO_EXPANDED, "expanded")).toBe("legal");
  });

  it.each([null, undefined, { standard: null, expanded: true }])("%j no es verificable en Standard", (l) => {
    expect(estadoDeCarta(l, "standard")).toBe("no-verificable");
  });
});

describe("evaluarLegalidad", () => {
  it("el mazo es legal solo si todas las cartas lo son", () => {
    const r = evaluarLegalidad([linea(1), linea(2)], mapa([1, LEGAL], [2, LEGAL]), "standard");

    expect(r).toMatchObject({ veredicto: "legal", noLegales: 0, noVerificables: 0 });
  });

  it("una carta no legal hace no legal al mazo", () => {
    const r = evaluarLegalidad([linea(1), linea(2)], mapa([1, LEGAL], [2, SOLO_EXPANDED]), "standard");

    expect(r.veredicto).toBe("no-legal");
    expect(r.noLegales).toBe(1);
  });

  it("una carta sin información nunca da veredicto legal", () => {
    const r = evaluarLegalidad([linea(1), linea(2)], mapa([1, LEGAL], [2, null]), "standard");

    expect(r.veredicto).toBe("no-verificable");
    expect(r.noVerificables).toBe(1);
  });

  it("una carta ausente del mapa cuenta como no verificable", () => {
    expect(evaluarLegalidad([linea(1)], mapa(), "expanded").veredicto).toBe("no-verificable");
  });

  it("una carta no legal pesa más que una no verificable", () => {
    const r = evaluarLegalidad([linea(1), linea(2)], mapa([1, null], [2, SOLO_EXPANDED]), "standard");

    expect(r).toMatchObject({ veredicto: "no-legal", noLegales: 1, noVerificables: 1 });
  });

  it("el mismo mazo puede ser legal en Expanded y no en Standard", () => {
    const lineas = [linea(1)];
    const legalidades = mapa([1, SOLO_EXPANDED]);

    expect(evaluarLegalidad(lineas, legalidades, "standard").veredicto).toBe("no-legal");
    expect(evaluarLegalidad(lineas, legalidades, "expanded").veredicto).toBe("legal");
  });

  it("ordena primero las no legales, luego las no verificables y por nombre", () => {
    const r = evaluarLegalidad(
      [linea(1, "Zubat"), linea(2, "Abra"), linea(3, "Mew"), linea(4, "Eevee")],
      mapa([1, SOLO_EXPANDED], [2, LEGAL], [3, null], [4, SOLO_EXPANDED]),
      "standard",
    );

    expect(r.cartas.map((c) => [c.nombre, c.estado])).toEqual([
      ["Eevee", "no-legal"],
      ["Zubat", "no-legal"],
      ["Mew", "no-verificable"],
      ["Abra", "legal"],
    ]);
  });

  it("desempata por id cuando el nombre se repite", () => {
    const r = evaluarLegalidad([linea(9, "Pikachu"), linea(2, "Pikachu")], mapa([9, LEGAL], [2, LEGAL]), "standard");

    expect(r.cartas.map((c) => c.cartaId)).toEqual([2, 9]);
  });
});
