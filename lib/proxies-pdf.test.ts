import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_SUPABASE_URL: "https://proyecto.supabase.co" } }));
vi.mock("@/lib/catalogo", () => ({ urlsImagenesOpcionales: vi.fn() }));
vi.mock("@/lib/imagen-hd", () => ({ obtenerImagenHd: vi.fn() }));
vi.mock("@/lib/mazos", () => ({ obtenerMazo: vi.fn() }));

import { urlsImagenesOpcionales } from "@/lib/catalogo";
import { obtenerImagenHd } from "@/lib/imagen-hd";
import { obtenerMazo } from "@/lib/mazos";
import { PROXIES_MAX } from "./proxies";
import { generarProxiesMazo } from "./proxies-pdf";

// Una imagen real mínima: así sharp la convierte de verdad.
async function imagen(formato: "webp" | "png" = "webp") {
  const base = sharp({ create: { width: 60, height: 84, channels: 3, background: "#cc3300" } });
  return new Uint8Array(await (formato === "webp" ? base.webp() : base.png()).toBuffer());
}

const linea = (cartaId: number, cantidad: number, nombre = `Carta ${cartaId}`) => ({
  cartaId,
  cantidad,
  nombre,
  idApi: `x${cartaId}`,
  idioma: "en",
  stage: null,
});

function mazo(lineas: ReturnType<typeof linea>[]) {
  vi.mocked(obtenerMazo).mockResolvedValue({
    ok: true,
    datos: { mazo: { id: 5, nombre: "Fuego" }, lineas, reglas: {} as never },
  });
}

async function paginas(pdf: Uint8Array) {
  const doc = await PDFDocument.load(pdf);
  return doc.getPages();
}

// El dibujo de cada imagen lleva su tamaño exacto en puntos (63 x 88 mm).
const MATRIZ_CARTA = /178\.58267\d* 0 0 249\.44881\d* 0 0 cm/g;

// pdf-lib comprime el contenido de cada hoja: se descomprime para leer sus operadores de dibujo.
async function contenido(r: { ok: boolean; datos?: { pdf: Uint8Array } }) {
  const doc = await PDFDocument.load(r.datos?.pdf ?? new Uint8Array());
  let salida = "";
  for (const pagina of doc.getPages()) {
    const bruto = pagina.node.Contents();
    const flujos = bruto instanceof PDFArray ? bruto.asArray().map((o) => doc.context.lookup(o)) : [bruto];
    for (const flujo of flujos) {
      if (flujo instanceof PDFRawStream) salida += Buffer.from(decodePDFRawStream(flujo).decode()).toString("latin1");
    }
  }
  return salida;
}

beforeEach(() => {
  vi.mocked(obtenerMazo).mockReset();
  vi.mocked(obtenerImagenHd).mockReset().mockResolvedValue(null);
  vi.mocked(urlsImagenesOpcionales).mockReset().mockResolvedValue({});
  vi.unstubAllGlobals();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("generarProxiesMazo: entrada y mazo", () => {
  it.each([{ mazoId: -1 }, { mazoId: "1 OR 1=1" }, {}])("rechaza %j sin tocar el mazo", async (entrada) => {
    const r = await generarProxiesMazo(entrada);

    expect(r.ok).toBe(false);
    expect(obtenerMazo).not.toHaveBeenCalled();
  });

  it("propaga el error de obtenerMazo (sin sesión o mazo ajeno)", async () => {
    vi.mocked(obtenerMazo).mockResolvedValue({ ok: false, error: "Se requiere una sesión iniciada." });

    expect(await generarProxiesMazo({ mazoId: 5 })).toEqual({ ok: false, error: "Se requiere una sesión iniciada." });
    expect(obtenerImagenHd).not.toHaveBeenCalled();
  });

  it("avisa si el mazo está vacío", async () => {
    mazo([]);

    expect(await generarProxiesMazo({ mazoId: 5 })).toEqual({
      ok: false,
      error: "El mazo está vacío: no hay nada que imprimir.",
    });
  });

  it("rechaza un mazo con más cartas que el tope", async () => {
    mazo([linea(1, PROXIES_MAX + 1)]);

    const r = await generarProxiesMazo({ mazoId: 5 });

    expect(!r.ok && r.error).toContain(`hasta ${PROXIES_MAX} cartas`);
    expect(obtenerImagenHd).not.toHaveBeenCalled();
  });
});

describe("generarProxiesMazo: el PDF", () => {
  it("genera una hoja A4 con cada carta a 63 x 88 mm", async () => {
    mazo([linea(1, 4), linea(2, 2)]);
    vi.mocked(obtenerImagenHd).mockResolvedValue({ bytes: await imagen() });

    const r = await generarProxiesMazo({ mazoId: 5 });

    expect(r.ok && r.datos.nombre).toBe("proxies-mazo-5.pdf");
    const hojas = await paginas(r.ok ? r.datos.pdf : new Uint8Array());
    expect(hojas).toHaveLength(1);
    expect(hojas[0].getWidth()).toBeCloseTo(595.2756, 3);
    expect(hojas[0].getHeight()).toBeCloseTo(841.8898, 3);
    expect((await contenido(r)).match(MATRIZ_CARTA)).toHaveLength(6);
  });

  it("pide cada imagen una sola vez aunque la carta se repita", async () => {
    mazo([linea(1, 4), linea(2, 2)]);
    vi.mocked(obtenerImagenHd).mockResolvedValue({ bytes: await imagen() });

    await generarProxiesMazo({ mazoId: 5 });

    expect(obtenerImagenHd).toHaveBeenCalledTimes(2);
  });

  it("reparte en varias hojas: 10 cartas son 2 hojas", async () => {
    mazo([linea(1, 4), linea(2, 4), linea(3, 2)]);
    vi.mocked(obtenerImagenHd).mockResolvedValue({ bytes: await imagen() });

    const r = await generarProxiesMazo({ mazoId: 5 });

    expect(await paginas(r.ok ? r.datos.pdf : new Uint8Array())).toHaveLength(2);
  });

  it("acepta una imagen PNG, no solo WebP", async () => {
    mazo([linea(1, 1)]);
    vi.mocked(obtenerImagenHd).mockResolvedValue({ bytes: await imagen("png") });

    const r = await generarProxiesMazo({ mazoId: 5 });

    expect(r.ok).toBe(true);
  });
});

describe("generarProxiesMazo: imagen de respaldo y recuadro", () => {
  const URL_BUCKET = "https://proyecto.supabase.co/storage/v1/object/sign/Images/a.webp?token=t";

  function respuestaFetch(bytes: Uint8Array, ok = true) {
    return vi.fn().mockResolvedValue({ ok, arrayBuffer: () => Promise.resolve(bytes.buffer.slice(0)) });
  }

  it("sin imagen HD usa la del bucket, sin seguir redirecciones", async () => {
    mazo([linea(1, 1)]);
    vi.mocked(urlsImagenesOpcionales).mockResolvedValue({ 1: URL_BUCKET });
    const fetchFalso = respuestaFetch(await imagen());
    vi.stubGlobal("fetch", fetchFalso);

    const r = await generarProxiesMazo({ mazoId: 5 });

    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(fetchFalso.mock.calls[0][1]).toMatchObject({ redirect: "error" });
    expect(await contenido(r)).toMatch(MATRIZ_CARTA);
  });

  it.each([
    ["host distinto del proyecto", "https://malo.example.com/a.webp"],
    ["http sin cifrar", "http://proyecto.supabase.co/a.webp"],
    ["URL inválida", "no es una url"],
  ])("no descarga de una URL con %s y dibuja un recuadro", async (_, url) => {
    mazo([linea(1, 1)]);
    vi.mocked(urlsImagenesOpcionales).mockResolvedValue({ 1: url });
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);

    const r = await generarProxiesMazo({ mazoId: 5 });

    expect(fetchFalso).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
    expect(await contenido(r)).not.toMatch(MATRIZ_CARTA);
  });

  it.each([
    ["respuesta con error", () => respuestaFetch(new Uint8Array([1]), false)],
    ["imagen demasiado grande", () => respuestaFetch(new Uint8Array(2 * 1024 * 1024 + 1))],
    ["archivo que no es una imagen", () => respuestaFetch(new Uint8Array([1, 2, 3, 4]))],
    ["fallo de red", () => vi.fn().mockRejectedValue(new Error("red"))],
  ])("si el bucket falla (%s) dibuja un recuadro y no rompe el PDF", async (_, fabricar) => {
    mazo([linea(1, 1)]);
    vi.mocked(urlsImagenesOpcionales).mockResolvedValue({ 1: URL_BUCKET });
    vi.stubGlobal("fetch", fabricar());

    const r = await generarProxiesMazo({ mazoId: 5 });

    expect(r.ok).toBe(true);
    expect(await paginas(r.ok ? r.datos.pdf : new Uint8Array())).toHaveLength(1);
  });

  it("si la imagen HD no es una imagen válida cae al bucket", async () => {
    mazo([linea(1, 1)]);
    vi.mocked(obtenerImagenHd).mockResolvedValue({ bytes: new Uint8Array([0, 1, 2, 3]) });
    vi.mocked(urlsImagenesOpcionales).mockResolvedValue({ 1: URL_BUCKET });
    const fetchFalso = respuestaFetch(await imagen());
    vi.stubGlobal("fetch", fetchFalso);

    const r = await generarProxiesMazo({ mazoId: 5 });

    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(await contenido(r)).toMatch(MATRIZ_CARTA);
  });

  it("sin ninguna imagen genera recuadros, incluso con nombres no latinos o muy largos", async () => {
    mazo([linea(1, 1, "ピカチュウ"), linea(2, 1, "Un nombre larguísimo ".repeat(10)), linea(3, 1, "Pokémon Épico")]);

    const r = await generarProxiesMazo({ mazoId: 5 });

    expect(r.ok).toBe(true);
    expect(await paginas(r.ok ? r.datos.pdf : new Uint8Array())).toHaveLength(1);
  });

  it("pide las URLs firmadas de 30 en 30", async () => {
    mazo(Array.from({ length: 35 }, (_, i) => linea(i + 1, 1)));

    await generarProxiesMazo({ mazoId: 5 });

    expect(vi.mocked(urlsImagenesOpcionales).mock.calls.map(([ids]) => ids.length)).toEqual([30, 5]);
  });

  it("oculta el detalle de un fallo inesperado", async () => {
    mazo([linea(1, 1)]);
    vi.mocked(obtenerImagenHd).mockRejectedValue(new Error("detalle interno"));

    expect(await generarProxiesMazo({ mazoId: 5 })).toEqual({ ok: false, error: "No se pudo generar el PDF." });
  });
});
