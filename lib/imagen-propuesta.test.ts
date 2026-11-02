import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { detectarFormato, recodificarAWebp } from "./imagen-propuesta";

// Imágenes reales generadas en memoria: se prueba sharp de verdad, no un simulacro.
const lienzo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } } });

const png = () => lienzo(40, 56).png().toBuffer();
const jpeg = () => lienzo(40, 56).jpeg().toBuffer();
const webp = () => lienzo(40, 56).webp().toBuffer();
const gif = () => lienzo(40, 56).gif().toBuffer();
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe("detectarFormato", () => {
  it("reconoce JPEG, PNG y WebP por sus primeros bytes", async () => {
    expect(detectarFormato(await jpeg())).toBe("jpeg");
    expect(detectarFormato(await png())).toBe("png");
    expect(detectarFormato(await webp())).toBe("webp");
  });

  it.each([
    ["un SVG (aunque se llame .png)", svg],
    ["un archivo vacío", Buffer.alloc(0)],
    ["un PDF", Buffer.from("%PDF-1.7\n")],
  ])("rechaza %s", (_, bytes) => {
    expect(detectarFormato(bytes)).toBeNull();
  });

  it("rechaza un GIF", async () => {
    expect(detectarFormato(await gif())).toBeNull();
  });
});

describe("recodificarAWebp", () => {
  it.each([
    ["PNG", png],
    ["JPEG", jpeg],
    ["WebP", webp],
  ])("convierte un %s a WebP", async (_, crear) => {
    const resultado = await recodificarAWebp(await crear());

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect((await sharp(resultado.webp).metadata()).format).toBe("webp");
  });

  it("reduce una imagen grande a 734 × 1024 como máximo, sin deformarla", async () => {
    const grande = await lienzo(2000, 2800).png().toBuffer();

    const resultado = await recodificarAWebp(grande);

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    const { width, height } = await sharp(resultado.webp).metadata();
    expect(width).toBeLessThanOrEqual(734);
    expect(height).toBeLessThanOrEqual(1024);
    expect(Math.abs(width! / height! - 2000 / 2800)).toBeLessThan(0.01);
  });

  it("no agranda una imagen chica", async () => {
    const resultado = await recodificarAWebp(await png());

    if (resultado.ok) expect((await sharp(resultado.webp).metadata()).width).toBe(40);
  });

  it("descarta los metadatos EXIF", async () => {
    const conExif = await lienzo(40, 56)
      .jpeg()
      .withMetadata({ exif: { IFD0: { Artist: "Ana", Copyright: "Ubicación privada" } } })
      .toBuffer();
    expect((await sharp(conExif).metadata()).exif).toBeDefined();

    const resultado = await recodificarAWebp(conExif);

    expect(resultado.ok).toBe(true);
    if (resultado.ok) expect((await sharp(resultado.webp).metadata()).exif).toBeUndefined();
  });

  it("rechaza un SVG sin intentar leerlo", async () => {
    expect(await recodificarAWebp(svg)).toEqual({ ok: false, error: "La imagen debe ser JPEG, PNG o WebP." });
  });

  it("rechaza un archivo con la firma de JPEG pero contenido corrupto", async () => {
    const falso = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from("no es una imagen")]);

    expect(await recodificarAWebp(falso)).toEqual({ ok: false, error: "No se pudo leer la imagen." });
  });
});
