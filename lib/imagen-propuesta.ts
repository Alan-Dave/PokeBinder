import "server-only";

import sharp from "sharp";

/**
 * Validación y recodificación de las imágenes que proponen los usuarios.
 *
 * El formato se decide por los primeros bytes del archivo, no por la
 * extensión ni por el tipo MIME: esos los elige quien sube. SVG y GIF quedan
 * fuera (el SVG puede llevar JavaScript). Lo que pasa se recodifica siempre a
 * WebP: así se descarta cualquier contenido extra escondido en el archivo y
 * los metadatos (EXIF, por ejemplo la ubicación GPS), que sharp no copia salvo
 * que se le pida.
 */

export type Formato = "jpeg" | "png" | "webp";

// Proporción de una carta (63 × 88 mm) a una resolución que se lee bien.
const ANCHO_MAX = 734;
const ALTO_MAX = 1024;
// Una imagen de pocos KB puede declarar dimensiones enormes y agotar la
// memoria al descomprimirse (bomba de descompresión).
const PIXELES_MAX = 40_000_000;
// Mismo límite que el bucket Propuestas.
const SALIDA_MAX_BYTES = 1024 * 1024;

export function detectarFormato(bytes: Uint8Array): Formato | null {
  const empieza = (firma: number[], desde = 0) => firma.every((b, i) => bytes[desde + i] === b);

  if (empieza([0xff, 0xd8, 0xff])) return "jpeg";
  if (empieza([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  // RIFF....WEBP
  if (empieza([0x52, 0x49, 0x46, 0x46]) && empieza([0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}

export type ImagenRecodificada = { ok: true; webp: Buffer } | { ok: false; error: string };

export async function recodificarAWebp(bytes: Uint8Array): Promise<ImagenRecodificada> {
  const formato = detectarFormato(bytes);
  if (!formato) return { ok: false, error: "La imagen debe ser JPEG, PNG o WebP." };

  try {
    const webp = await sharp(bytes, { limitInputPixels: PIXELES_MAX, failOn: "error" })
      // Aplica la orientación EXIF antes de que los metadatos se descarten.
      .rotate()
      .resize(ANCHO_MAX, ALTO_MAX, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    if (webp.length > SALIDA_MAX_BYTES) return { ok: false, error: "La imagen es demasiado pesada." };
    return { ok: true, webp };
  } catch {
    // Archivo corrupto, truncado o demasiado grande para descomprimir.
    return { ok: false, error: "No se pudo leer la imagen." };
  }
}
