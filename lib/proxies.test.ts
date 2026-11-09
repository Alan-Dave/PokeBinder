import { describe, expect, it } from "vitest";
import {
  CARTA_ALTO_MM,
  CARTA_ANCHO_MM,
  CARTAS_POR_PAGINA,
  expandirCopias,
  marcasDeCorte,
  MARGEN_X_MM,
  MARGEN_Y_MM,
  mm,
  paginar,
  PAGINA_ALTO_MM,
  PAGINA_ANCHO_MM,
  posicionesPagina,
  nombreParaProxy,
  textoSeguro,
} from "./proxies";

describe("medidas", () => {
  it("la carta mide exactamente 63 × 88 mm", () => {
    expect(CARTA_ANCHO_MM).toBe(63);
    expect(CARTA_ALTO_MM).toBe(88);
  });

  it("convierte milímetros a puntos (72 pt = 25,4 mm)", () => {
    expect(mm(25.4)).toBeCloseTo(72, 10);
    expect(mm(63)).toBeCloseTo(178.5827, 3);
    expect(mm(88)).toBeCloseTo(249.4488, 3);
  });

  it("la hoja de 9 cartas cabe en A4 con márgenes simétricos y positivos", () => {
    expect(MARGEN_X_MM).toBe(10.5);
    expect(MARGEN_Y_MM).toBe(16.5);
    expect(2 * MARGEN_X_MM + 3 * CARTA_ANCHO_MM).toBe(PAGINA_ANCHO_MM);
    expect(2 * MARGEN_Y_MM + 3 * CARTA_ALTO_MM).toBe(PAGINA_ALTO_MM);
  });
});

describe("posicionesPagina", () => {
  const posiciones = posicionesPagina();

  it("da nueve casillas", () => {
    expect(posiciones).toHaveLength(CARTAS_POR_PAGINA);
  });

  it("deja cada carta dentro de la hoja", () => {
    for (const { x, y } of posiciones) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + mm(CARTA_ANCHO_MM)).toBeLessThanOrEqual(mm(PAGINA_ANCHO_MM) + 1e-9);
      expect(y + mm(CARTA_ALTO_MM)).toBeLessThanOrEqual(mm(PAGINA_ALTO_MM) + 1e-9);
    }
  });

  it("separa las cartas exactamente 63 mm en horizontal y 88 mm en vertical, sin solaparlas", () => {
    expect(posiciones[1].x - posiciones[0].x).toBeCloseTo(mm(63), 9);
    expect(posiciones[0].y - posiciones[3].y).toBeCloseTo(mm(88), 9);
    expect(posiciones[0].y).toBe(posiciones[1].y);
  });

  it("numera por filas de arriba a abajo", () => {
    expect(posiciones[0].y).toBeGreaterThan(posiciones[3].y);
    expect(posiciones[3].y).toBeGreaterThan(posiciones[6].y);
    expect(posiciones[0].x).toBe(posiciones[3].x);
  });
});

describe("marcasDeCorte", () => {
  const marcas = marcasDeCorte();
  const izq = mm(MARGEN_X_MM);
  const der = mm(PAGINA_ANCHO_MM - MARGEN_X_MM);
  const aba = mm(MARGEN_Y_MM);
  const arr = mm(PAGINA_ALTO_MM - MARGEN_Y_MM);

  it("pone una marca por borde: 4 verticales × 2 y 4 horizontales × 2", () => {
    expect(marcas).toHaveLength(16);
  });

  it("deja todas las marcas fuera del área de cartas", () => {
    for (const m of marcas) {
      for (const [x, y] of [
        [m.x1, m.y1],
        [m.x2, m.y2],
      ]) {
        const dentro = x > izq + 1e-9 && x < der - 1e-9 && y > aba + 1e-9 && y < arr - 1e-9;
        expect(dentro).toBe(false);
      }
    }
  });

  it("las marcas caben en la hoja", () => {
    for (const m of marcas) {
      for (const v of [m.x1, m.x2]) expect(v).toBeGreaterThanOrEqual(0);
      for (const v of [m.y1, m.y2]) expect(v).toBeGreaterThanOrEqual(0);
      for (const v of [m.x1, m.x2]) expect(v).toBeLessThanOrEqual(mm(PAGINA_ANCHO_MM));
      for (const v of [m.y1, m.y2]) expect(v).toBeLessThanOrEqual(mm(PAGINA_ALTO_MM));
    }
  });
});

describe("expandirCopias y paginar", () => {
  it("repite la carta tantas veces como copias", () => {
    const r = expandirCopias([
      { cartaId: 1, nombre: "A", cantidad: 3 },
      { cartaId: 2, nombre: "B", cantidad: 1 },
    ]);

    expect(r.map((c) => c.cartaId)).toEqual([1, 1, 1, 2]);
  });

  it("sin líneas no hay cartas", () => {
    expect(expandirCopias([])).toEqual([]);
  });

  it("reparte en hojas de nueve", () => {
    const hojas = paginar(Array.from({ length: 20 }, (_, i) => i));

    expect(hojas.map((h) => h.length)).toEqual([9, 9, 2]);
  });

  it("no genera hojas vacías", () => {
    expect(paginar([])).toEqual([]);
    expect(paginar([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });
});

describe("textoSeguro", () => {
  it("quita acentos", () => {
    expect(textoSeguro("Pokémon Épico")).toBe("Pokemon Epico");
  });

  it("descarta kana y hanzi", () => {
    expect(textoSeguro("ピカチュウ ex")).toBe("ex");
  });

  it("usa un texto genérico si no queda nada", () => {
    expect(textoSeguro("ピカチュウ")).toBe("Carta");
    expect(textoSeguro("   ")).toBe("Carta");
  });

  it("deja pasar el ASCII imprimible", () => {
    expect(textoSeguro("Mr. Mime V-UNION #1")).toBe("Mr. Mime V-UNION #1");
  });
});

describe("nombreParaProxy", () => {
  it("usa el nombre propio cuando tiene letras", () => {
    expect(nombreParaProxy("Pikachu", "Pikachu EN")).toBe("Pikachu");
    expect(nombreParaProxy("Pokémon Épico", null)).toBe("Pokémon Épico");
  });

  it("usa el de la edición en inglés cuando el propio no identifica la carta", () => {
    expect(nombreParaProxy("<>", "Team Rocket's Zapdos")).toBe("Team Rocket's Zapdos");
    expect(nombreParaProxy("ピカチュウ", "Pikachu")).toBe("Pikachu");
    expect(nombreParaProxy("", "Pikachu")).toBe("Pikachu");
  });

  it("si tampoco hay nombre en inglés útil, deja el propio", () => {
    expect(nombreParaProxy("<>", null)).toBe("<>");
    expect(nombreParaProxy("<>", "ピカチュウ")).toBe("<>");
  });

  it("expandirCopias conserva el nombre en inglés de cada copia", () => {
    const [primera] = expandirCopias([{ cartaId: 1, nombre: "<>", nombreEn: "Abra", cantidad: 2 }]);
    expect(primera.nombreEn).toBe("Abra");
  });
});
