import { describe, expect, it } from "vitest";
import { calcularFaltantes, resumirInventario } from "./resumen";

const fila = (carta_id: number, cantidad: number, set_id: string, idioma: string, price: number | null) => ({
  carta_id,
  cantidad,
  cartas: { set_id, idioma, price },
});

describe("resumirInventario", () => {
  it("devuelve ceros con el inventario vacío", () => {
    expect(resumirInventario([])).toEqual({
      copias: 0,
      distintas: 0,
      valorEstimado: 0,
      sinPrecio: 0,
      porIdioma: [],
      porSet: [],
    });
  });

  it("suma copias, cartas distintas y valor", () => {
    const r = resumirInventario([fila(1, 2, "sv1", "en", 1.5), fila(2, 1, "sv1", "en", 10)]);

    expect(r.copias).toBe(3);
    expect(r.distintas).toBe(2);
    expect(r.valorEstimado).toBe(13);
  });

  it("cuenta una vez la carta que está en dos variantes", () => {
    const r = resumirInventario([fila(1, 1, "sv1", "en", 1), fila(1, 3, "sv1", "en", 1)]);

    expect(r.copias).toBe(4);
    expect(r.distintas).toBe(1);
    expect(r.porSet).toEqual([{ setId: "sv1", idioma: "en", copias: 4, distintas: 1 }]);
  });

  it("suma el valor sin acumular error de coma flotante", () => {
    const r = resumirInventario([fila(1, 3, "a", "en", 0.1), fila(2, 3, "a", "en", 0.2)]);

    expect(r.valorEstimado).toBe(0.9);
  });

  it("no suma las cartas sin precio y las cuenta aparte", () => {
    const r = resumirInventario([fila(1, 2, "a", "en", null), fila(1, 1, "a", "en", null), fila(2, 1, "a", "en", 5)]);

    expect(r.valorEstimado).toBe(5);
    expect(r.sinPrecio).toBe(1);
  });

  it("ignora en idioma y set la fila cuya carta ya no existe, pero cuenta la copia", () => {
    const r = resumirInventario([{ carta_id: 9, cantidad: 2, cartas: null }]);

    expect(r.copias).toBe(2);
    expect(r.distintas).toBe(1);
    expect(r.porIdioma).toEqual([]);
    expect(r.porSet).toEqual([]);
  });

  it("agrupa por idioma y ordena por copias, luego por nombre", () => {
    const r = resumirInventario([
      fila(1, 1, "a", "fr", 1),
      fila(2, 5, "a", "en", 1),
      fila(3, 1, "a", "es", 1),
    ]);

    expect(r.porIdioma.map((i) => i.idioma)).toEqual(["en", "es", "fr"]);
    expect(r.porIdioma[0]).toEqual({ idioma: "en", copias: 5, distintas: 1 });
  });

  it("separa el mismo set en dos idiomas y ordena por copias, set e idioma", () => {
    const r = resumirInventario([
      fila(1, 1, "b", "en", 1),
      fila(2, 1, "a", "es", 1),
      fila(3, 1, "a", "en", 1),
      fila(4, 4, "z", "en", 1),
    ]);

    expect(r.porSet.map((s) => `${s.setId}|${s.idioma}`)).toEqual(["z|en", "a|en", "a|es", "b|en"]);
  });
});

describe("calcularFaltantes", () => {
  const set = [
    { id: 1, nombre: "A", number: "10", rarity: "Common" },
    { id: 2, nombre: "B", number: "2", rarity: null },
    { id: 3, nombre: "C", number: "H1", rarity: "Rare" },
    { id: 4, nombre: "D", number: "1", rarity: "Common" },
  ];

  it("lista lo que no está en el inventario con numeración natural", () => {
    const r = calcularFaltantes(set, new Set([4]));

    expect(r.faltan.map((c) => c.number)).toEqual(["2", "10", "H1"]);
    expect(r.total).toBe(4);
    expect(r.tengo).toBe(1);
    expect(r.porcentaje).toBe(25);
  });

  it("no inventa faltantes si el set está completo", () => {
    const r = calcularFaltantes(set, new Set([1, 2, 3, 4]));

    expect(r.faltan).toEqual([]);
    expect(r.porcentaje).toBe(100);
  });

  it("ignora ids poseídos que no son del set", () => {
    const r = calcularFaltantes(set, new Set([999]));

    expect(r.tengo).toBe(0);
    expect(r.faltan).toHaveLength(4);
  });

  it("trata un set sin cartas como 0 %", () => {
    expect(calcularFaltantes([], new Set())).toEqual({ total: 0, tengo: 0, faltan: [], porcentaje: 0 });
  });

  it("redondea el porcentaje hacia abajo: nunca marca 100 % sin estar completo", () => {
    const grande = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, nombre: "X", number: String(i + 1), rarity: null }));
    const r = calcularFaltantes(grande, new Set(grande.slice(1).map((c) => c.id)));

    expect(r.porcentaje).toBe(99);
  });

  it("desempata por id si el número se repite", () => {
    const r = calcularFaltantes(
      [
        { id: 8, nombre: "B", number: "1", rarity: null },
        { id: 7, nombre: "A", number: "1", rarity: null },
      ],
      new Set(),
    );

    expect(r.faltan.map((c) => c.id)).toEqual([7, 8]);
  });
});
