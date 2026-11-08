import { describe, expect, it } from "vitest";
import { analizarCobertura } from "./analisis";

const set = (setId: string, distintas: number, copias = distintas, idioma = "en") => ({
  setId,
  idioma,
  copias,
  distintas,
});
const total = (setId: string, n: number, idioma = "en") => ({ setId, idioma, total: n });
const CTX = { copias: 10, sinPrecio: 0 };

describe("analizarCobertura: avance por set", () => {
  it("calcula tengo, faltan y porcentaje redondeado hacia abajo", () => {
    const r = analizarCobertura([set("sv1", 2, 5)], [total("sv1", 3)], CTX);

    expect(r.sets).toEqual([{ setId: "sv1", idioma: "en", copias: 5, tengo: 2, total: 3, faltan: 1, porcentaje: 66 }]);
  });

  it("solo marca 100 % cuando el set está completo", () => {
    const r = analizarCobertura([set("a", 199), set("b", 200)], [total("a", 200), total("b", 200)], CTX);

    expect(r.sets.map((s) => s.porcentaje)).toEqual([99, 100]);
  });

  it("ignora los sets sin total conocido o vacíos", () => {
    const r = analizarCobertura([set("sin", 1), set("cero", 1), set("ok", 1)], [total("cero", 0), total("ok", 4)], CTX);

    expect(r.sets.map((s) => s.setId)).toEqual(["ok"]);
  });

  it("distingue el mismo set en idiomas distintos", () => {
    const r = analizarCobertura(
      [set("sv1", 1, 1, "en"), set("sv1", 5, 5, "es")],
      [total("sv1", 10, "en"), total("sv1", 5, "es")],
      CTX,
    );

    expect(r.sets.map((s) => [s.idioma, s.faltan])).toEqual([
      ["en", 9],
      ["es", 0],
    ]);
  });

  it("limita tengo al total si los datos son inconsistentes", () => {
    const r = analizarCobertura([set("sv1", 12)], [total("sv1", 10)], CTX);

    expect(r.sets[0]).toMatchObject({ tengo: 10, faltan: 0, porcentaje: 100 });
  });
});

describe("analizarCobertura: set más cercano y completos", () => {
  it("elige el incompleto al que le faltan menos cartas", () => {
    const r = analizarCobertura(
      [set("a", 1), set("b", 8), set("c", 5)],
      [total("a", 3), total("b", 10), total("c", 10)],
      CTX,
    );

    expect(r.masCercano?.setId).toBe("b");
  });

  it("desempata por mayor porcentaje y luego por id", () => {
    const porPorcentaje = analizarCobertura([set("a", 8), set("b", 18)], [total("a", 10), total("b", 20)], CTX);
    expect(porPorcentaje.masCercano?.setId).toBe("b");

    const porId = analizarCobertura([set("z", 1), set("m", 1)], [total("z", 2), total("m", 2)], CTX);
    expect(porId.masCercano?.setId).toBe("m");
  });

  it("no considera un set completo como el más cercano", () => {
    const r = analizarCobertura([set("a", 5), set("b", 1)], [total("a", 5), total("b", 5)], CTX);

    expect(r.completos).toBe(1);
    expect(r.masCercano?.setId).toBe("b");
  });

  it("sin sets incompletos no hay más cercano", () => {
    const r = analizarCobertura([set("a", 5)], [total("a", 5)], CTX);

    expect(r.masCercano).toBeNull();
  });
});

describe("analizarCobertura: observaciones", () => {
  it("usa el nombre del set y el singular cuando falta una carta", () => {
    const r = analizarCobertura([set("sv1", 9)], [total("sv1", 10)], {
      ...CTX,
      nombresSet: { "sv1|en": "Scarlet & Violet" },
    });

    expect(r.observaciones).toEqual(["Te falta 1 carta para completar Scarlet & Violet (en)."]);
  });

  it("usa el id del set si no hay nombre y el plural para varias cartas", () => {
    const r = analizarCobertura([set("sv1", 7)], [total("sv1", 10)], CTX);

    expect(r.observaciones[0]).toBe("Te faltan 3 cartas para completar sv1 (en).");
  });

  it("cuenta los sets completados en singular y plural", () => {
    const uno = analizarCobertura([set("a", 2)], [total("a", 2)], CTX);
    expect(uno.observaciones).toEqual(["Has completado 1 set."]);

    const dos = analizarCobertura([set("a", 2), set("b", 3)], [total("a", 2), total("b", 3)], CTX);
    expect(dos.observaciones).toEqual(["Has completado 2 sets."]);
  });

  it("avisa de las cartas sin precio", () => {
    expect(analizarCobertura([], [], { copias: 3, sinPrecio: 1 }).observaciones).toEqual([
      "1 carta no tiene precio: el valor estimado es parcial.",
    ]);
    expect(analizarCobertura([], [], { copias: 3, sinPrecio: 4 }).observaciones).toEqual([
      "4 cartas no tienen precio: el valor estimado es parcial.",
    ]);
  });

  it("con inventario vacío invita a agregar cartas", () => {
    const r = analizarCobertura([], [], { copias: 0, sinPrecio: 0 });

    expect(r.observaciones).toEqual(["Aún no tienes cartas en el inventario: agrega algunas para ver tu avance."]);
  });
});
