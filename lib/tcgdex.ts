import "server-only";

import { extraerPrecios, type PreciosCarta } from "@/lib/precios";
import {
  idApiSchema,
  respuestaCartaTcgdexSchema,
  type IdiomaTcgdex,
} from "@/lib/validators/imagen-hd";
import { respuestaPreciosTcgdexSchema } from "@/lib/validators/precios";

/**
 * Cliente mínimo de TCGdex (PBI-x2).
 *
 * El servidor hace las peticiones; el navegador nunca recibe una URL externa
 * ni la manda. Defensas contra SSRF y descargas abusivas:
 *  - los hosts permitidos están fijos en el código;
 *  - la URL de la imagen que devuelve la API se valida (https, host exacto,
 *    sin credenciales ni puerto, ruta de la forma esperada) antes de usarla;
 *  - no se siguen redirecciones (una redirección podría apuntar a otro host);
 *  - tiempo y tamaño máximos, y la imagen debe ser realmente WebP.
 */

export const HOST_API = "api.tcgdex.net";
export const HOST_IMAGENES = "assets.tcgdex.net";

export const TIEMPO_MAXIMO_MS = 12_000;
export const BYTES_MAXIMOS_JSON = 64 * 1024;
// high.webp pesa ~80 KB; el tope deja margen sin permitir descargas enormes.
export const BYTES_MAXIMOS_IMAGEN = 1024 * 1024;

export function urlCarta(idioma: IdiomaTcgdex, idApi: string): string | null {
  const id = idApiSchema.safeParse(idApi);
  if (!id.success) return null;
  return `https://${HOST_API}/v2/${idioma}/cards/${id.data}`;
}

const RUTA_IMAGEN = /^\/[a-z]{2}\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

/**
 * Valida la URL base que TCGdex devuelve en "image" y arma la de la imagen
 * grande. Devuelve null si algo no cuadra: es mejor no mostrar la imagen en
 * alta definición que pedir una URL que no controlamos.
 */
export function urlImagenAltaDefinicion(base: string): string | null {
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname !== HOST_IMAGENES) return null;
  if (url.port !== "" || url.username !== "" || url.password !== "") return null;
  if (url.search !== "" || url.hash !== "") return null;
  if (!RUTA_IMAGEN.test(url.pathname) || url.pathname.includes("..")) return null;
  return `https://${HOST_IMAGENES}${url.pathname}/high.webp`;
}

// "RIFF" + 4 bytes de tamaño + "WEBP".
export function esWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const texto = (desde: number, hasta: number) =>
    String.fromCharCode(...bytes.subarray(desde, hasta));
  return texto(0, 4) === "RIFF" && texto(8, 12) === "WEBP";
}

/** Lee el cuerpo hasta `maximo` bytes; null si lo supera. */
async function leerCuerpoLimitado(respuesta: Response, maximo: number): Promise<Uint8Array | null> {
  const declarado = Number(respuesta.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > maximo) return null;
  if (!respuesta.body) return null;

  const lector = respuesta.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximo) {
      await lector.cancel();
      return null;
    }
    partes.push(value);
  }
  const cuerpo = new Uint8Array(total);
  let posicion = 0;
  for (const parte of partes) {
    cuerpo.set(parte, posicion);
    posicion += parte.byteLength;
  }
  return cuerpo;
}

async function pedir(url: string, maximo: number): Promise<Uint8Array | null> {
  try {
    const respuesta = await fetch(url, {
      method: "GET",
      redirect: "error",
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      headers: { accept: "application/json, image/webp" },
    });
    if (!respuesta.ok) return null;
    return await leerCuerpoLimitado(respuesta, maximo);
  } catch {
    // Sin red, tiempo agotado o redirección: se trata como "no disponible".
    return null;
  }
}

/**
 * Pide a TCGdex la imagen grande de una carta. Devuelve los bytes del WebP o
 * null si la carta no existe en ese idioma o algo falla en el camino.
 */
export async function descargarImagenAltaDefinicion(
  idioma: IdiomaTcgdex,
  idApi: string,
): Promise<Uint8Array | null> {
  const urlDeLaCarta = urlCarta(idioma, idApi);
  if (!urlDeLaCarta) return null;

  const json = await pedir(urlDeLaCarta, BYTES_MAXIMOS_JSON);
  if (!json) return null;

  let datos: unknown;
  try {
    datos = JSON.parse(new TextDecoder().decode(json));
  } catch {
    return null;
  }
  const carta = respuestaCartaTcgdexSchema.safeParse(datos);
  if (!carta.success || !carta.data.image) return null;

  const urlImagen = urlImagenAltaDefinicion(carta.data.image);
  if (!urlImagen) return null;

  const imagen = await pedir(urlImagen, BYTES_MAXIMOS_IMAGEN);
  if (!imagen || !esWebp(imagen)) return null;
  return imagen;
}

/**
 * Pide a TCGdex el precio de mercado (TCGplayer, USD) de una carta. Devuelve
 * null si la carta no existe en ese idioma, la respuesta no es válida o no hay
 * precio: quien llama muestra "sin precio disponible", nunca 0.
 */
export async function descargarPrecios(idioma: IdiomaTcgdex, idApi: string): Promise<PreciosCarta | null> {
  const url = urlCarta(idioma, idApi);
  if (!url) return null;

  const json = await pedir(url, BYTES_MAXIMOS_JSON);
  if (!json) return null;

  let datos: unknown;
  try {
    datos = JSON.parse(new TextDecoder().decode(json));
  } catch {
    return null;
  }
  const carta = respuestaPreciosTcgdexSchema.safeParse(datos);
  if (!carta.success) return null;
  return extraerPrecios(carta.data.pricing?.tcgplayer);
}
