import { describe, expect, it } from "vitest";
import {
  extraerCardmarket,
  formatearEur,
  precioCardmarketCatalogo,
  urlCardmarket,
  urlTcgplayer,
  precioDeCatalogo,
  etiquetaAcabado,
  extraerPrecios,
  formatearUsd,
  precioDeVariante,
  valorDeColeccion,
  type PreciosCarta,
} from "./precios";

const PRECIOS: PreciosCarta = {
  moneda: "USD",
  actualizado: "2026-11-04T22:54:33.189Z",
  acabados: [
    { acabado: "holofoil", mercado: 10.5 },
    { acabado: "normal", mercado: 0.12 },
    { acabado: "reverse-holofoil", mercado: 0.22 },
  ],
};

describe("extraerPrecios", () => {
  it("toma el precio de mercado de cada acabado, ordenado", () => {
    const r = extraerPrecios({
      unit: "USD",
      updated: "2026-11-04",
      normal: { marketPrice: 0.12 },
      "reverse-holofoil": { marketPrice: 0.22 },
    });

    expect(r).toEqual({
      moneda: "USD",
      actualizado: "2026-11-04",
      acabados: [
        { acabado: "normal", mercado: 0.12, bajo: null, medio: null, productoId: null },
        { acabado: "reverse-holofoil", mercado: 0.22, bajo: null, medio: null, productoId: null },
      ],
    });
  });

  it("ignora los acabados sin precio de mercado", () => {
    const r = extraerPrecios({ unit: "USD", normal: { marketPrice: 1 }, holofoil: {}, otro: null });

    expect(r?.acabados).toEqual([{ acabado: "normal", mercado: 1, bajo: null, medio: null, productoId: null }]);
  });

  it("conserva el precio más bajo, el medio y el id de producto cuando la fuente los trae", () => {
    const r = extraerPrecios({
      unit: "USD",
      normal: { marketPrice: 11.34, lowPrice: 2.3, midPrice: 6.46, productId: 42402 },
    });

    expect(r?.acabados).toEqual([{ acabado: "normal", mercado: 11.34, bajo: 2.3, medio: 6.46, productoId: 42402 }]);
  });

  it("deja la fecha en null si la fuente no la trae", () => {
    expect(extraerPrecios({ unit: "USD", normal: { marketPrice: 1 } })?.actualizado).toBeNull();
  });

  it.each([
    ["sin datos", undefined],
    ["en otra moneda", { unit: "EUR", normal: { marketPrice: 1 } }],
    ["sin moneda", { normal: { marketPrice: 1 } }],
    ["sin ningún precio", { unit: "USD", normal: {} }],
  ])("devuelve null %s", (_, entrada) => {
    expect(extraerPrecios(entrada)).toBeNull();
  });
});

describe("precioDeVariante", () => {
  it.each([
    ["normal", 0.12],
    ["reverse", 0.22],
    ["holo", 10.5],
  ])("enlaza la variante %s con su acabado", (variante, esperado) => {
    expect(precioDeVariante(PRECIOS, variante)).toBe(esperado);
  });

  it("no inventa un precio para una variante sin acabado equivalente", () => {
    expect(precioDeVariante(PRECIOS, "firstEdition")).toBeNull();
    expect(precioDeVariante(PRECIOS, "wPromo")).toBeNull();
  });

  it("devuelve null si la carta no tiene ese acabado o no hay precios", () => {
    expect(precioDeVariante({ ...PRECIOS, acabados: [{ acabado: "normal", mercado: 1 }] }, "holo")).toBeNull();
    expect(precioDeVariante(null, "normal")).toBeNull();
    expect(precioDeVariante(undefined, "normal")).toBeNull();
  });
});

describe("valorDeColeccion", () => {
  it("suma precio por cantidad sin errores de punto flotante", () => {
    const r = valorDeColeccion([
      { precio: 0.1, cantidad: 3 },
      { precio: 0.2, cantidad: 1 },
    ]);

    expect(r).toEqual({ total: 0.5, conPrecio: 2, sinPrecio: 0 });
  });

  it("cuenta aparte las filas sin precio en vez de valuarlas en 0", () => {
    const r = valorDeColeccion([
      { precio: 2, cantidad: 2 },
      { precio: null, cantidad: 10 },
    ]);

    expect(r).toEqual({ total: 4, conPrecio: 1, sinPrecio: 1 });
  });

  it("una lista vacía vale cero", () => {
    expect(valorDeColeccion([])).toEqual({ total: 0, conPrecio: 0, sinPrecio: 0 });
  });
});

describe("formato", () => {
  it("formatea dólares con dos decimales y separador de miles", () => {
    expect(formatearUsd(1234.5)).toBe("US$ 1,234.50");
    expect(formatearUsd(0.12)).toBe("US$ 0.12");
  });

  it("traduce los acabados conocidos y deja el resto tal cual", () => {
    expect(etiquetaAcabado("holofoil")).toBe("Holo");
    expect(etiquetaAcabado("algo-nuevo")).toBe("algo-nuevo");
  });
});

describe("precioDeCatalogo", () => {
  const precios = {
    moneda: "USD" as const,
    actualizado: null,
    acabados: [
      { acabado: "normal", mercado: 0.5 },
      { acabado: "reverse-holofoil", mercado: 2 },
    ],
  };

  it("sin precios o sin variantes no hay precio", () => {
    expect(precioDeCatalogo(null, ["normal"])).toBeNull();
    expect(precioDeCatalogo(undefined, ["normal"])).toBeNull();
    expect(precioDeCatalogo(precios, [])).toBeNull();
  });

  it("con una sola variante con precio, lo muestra tal cual", () => {
    expect(precioDeCatalogo(precios, ["normal"])).toEqual({ monto: 0.5, desde: false });
  });

  it("con varias variantes de distinto precio, toma el más bajo y avisa «desde»", () => {
    expect(precioDeCatalogo(precios, ["reverse", "normal"])).toEqual({ monto: 0.5, desde: true });
  });

  it("si las variantes cuestan lo mismo, no avisa «desde»", () => {
    const iguales = {
      ...precios,
      acabados: [
        { acabado: "normal", mercado: 1 },
        { acabado: "holofoil", mercado: 1 },
      ],
    };
    expect(precioDeCatalogo(iguales, ["normal", "holo"])).toEqual({ monto: 1, desde: false });
  });

  it("ignora las variantes sin precio o que no enlazan con un acabado", () => {
    expect(precioDeCatalogo(precios, ["holo", "promo"])).toBeNull();
    expect(precioDeCatalogo(precios, ["holo", "normal"])).toEqual({ monto: 0.5, desde: false });
  });
});

describe("extraerCardmarket", () => {
  const bloque = {
    unit: "EUR",
    updated: "2026-11-07",
    idProduct: 273753,
    low: 0.09,
    trend: 6.05,
    avg7: 6.82,
    avg30: 11.1,
    "trend-holo": 36.37,
  };

  it("lee la versión normal y la holo, y deja en null lo que no trae", () => {
    expect(extraerCardmarket(bloque)).toEqual({
      moneda: "EUR",
      actualizado: "2026-11-07",
      productoId: 273753,
      normal: { minimo: 0.09, tendencia: 6.05, promedio7: 6.82, promedio30: 11.1 },
      holo: { minimo: null, tendencia: 36.37, promedio7: null, promedio30: null },
    });
  });

  it.each([
    ["sin datos", undefined],
    ["en otra moneda (no se convierte)", { ...bloque, unit: "USD" }],
    ["sin moneda", { ...bloque, unit: undefined }],
    ["sin ningún precio", { unit: "EUR", idProduct: 1 }],
  ])("devuelve null %s", (_, entrada) => {
    expect(extraerCardmarket(entrada)).toBeNull();
  });

  it("deja el id y la fecha en null si la fuente no los trae", () => {
    const r = extraerCardmarket({ unit: "EUR", trend: 1 });
    expect(r?.productoId).toBeNull();
    expect(r?.actualizado).toBeNull();
  });
});

describe("precioCardmarketCatalogo", () => {
  const linea = (tendencia: number | null) => ({ minimo: null, tendencia, promedio7: null, promedio30: null });
  const cm = (normal: number | null, holo: number | null) => ({
    moneda: "EUR" as const,
    actualizado: null,
    productoId: null,
    normal: linea(normal),
    holo: linea(holo),
  });

  it("sin datos no hay precio", () => {
    expect(precioCardmarketCatalogo(null)).toBeNull();
    expect(precioCardmarketCatalogo(undefined)).toBeNull();
    expect(precioCardmarketCatalogo(cm(null, null))).toBeNull();
  });

  it("con una sola versión, la muestra tal cual", () => {
    expect(precioCardmarketCatalogo(cm(2, null))).toEqual({ monto: 2, desde: false });
    expect(precioCardmarketCatalogo(cm(null, 5))).toEqual({ monto: 5, desde: false });
  });

  it("con dos versiones de distinto precio, toma la más baja y avisa «desde»", () => {
    expect(precioCardmarketCatalogo(cm(6, 36))).toEqual({ monto: 6, desde: true });
  });

  it("si cuestan lo mismo no avisa «desde»", () => {
    expect(precioCardmarketCatalogo(cm(3, 3))).toEqual({ monto: 3, desde: false });
  });
});

describe("enlaces a las tiendas", () => {
  it("arman la URL solo con un id entero positivo", () => {
    expect(urlTcgplayer(42402)).toBe("https://www.tcgplayer.com/product/42402");
    expect(urlCardmarket(273753)).toBe("https://www.cardmarket.com/en/Pokemon/Products?idProduct=273753");
  });

  it.each([null, undefined, 0, -3, 1.5, Number.NaN])("no arman enlace con el id %s", (id) => {
    expect(urlTcgplayer(id)).toBeNull();
    expect(urlCardmarket(id)).toBeNull();
  });
});

describe("formatearEur", () => {
  it("usa el símbolo del euro y dos decimales", () => {
    expect(formatearEur(6.05)).toBe("€ 6.05");
    expect(formatearEur(1234.5)).toBe("€ 1,234.50");
  });
});
