import "server-only";

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@/lib/supabase/server";
import { descargarImagenAltaDefinicion } from "@/lib/tcgdex";
import {
  esIdiomaTcgdex,
  idApiSchema,
  idCartaImagenSchema,
  type IdiomaTcgdex,
} from "@/lib/validators/imagen-hd";

/**
 * Imagen en alta definición de una carta (PBI-x2).
 *
 * Se descarga de TCGdex la primera vez y se guarda en una carpeta temporal del
 * servidor; las siguientes peticiones salen de ahí. La carpeta temporal se
 * vacía cuando el sistema lo decide (reinicio, despliegue): no es un
 * almacenamiento, solo una caché. Si no hay imagen, quien llama muestra la del
 * bucket.
 *
 * Los ids de otros idiomas no siempre coinciden con nuestro id_api (el
 * japonés usa "PMCG1" donde nosotros "base1"), así que se prueba el idioma de
 * la carta y después el inglés.
 */

export const CARPETA_CACHE = path.join(tmpdir(), "pokebinder-imagenes-hd");
// Pasado este tiempo se vuelve a pedir a TCGdex por si corrigió la imagen.
export const VIGENCIA_CACHE_MS = 7 * 24 * 60 * 60 * 1000;

export type ImagenHd = { bytes: Uint8Array };

// Si dos visitantes piden la misma carta a la vez, solo se descarga una vez.
const enCurso = new Map<string, Promise<Uint8Array | null>>();

/**
 * Nombre de archivo derivado de un hash: aunque el id_api trajera algo raro,
 * el nombre solo tiene hexadecimales y nunca puede salirse de la carpeta.
 */
export function rutaCache(idioma: IdiomaTcgdex, idApi: string): string {
  const hash = createHash("sha256").update(`${idioma}|${idApi}`).digest("hex");
  return path.join(CARPETA_CACHE, `${hash}.webp`);
}

async function leerCache(ruta: string): Promise<Uint8Array | null> {
  try {
    const { mtimeMs } = await stat(ruta);
    if (Date.now() - mtimeMs > VIGENCIA_CACHE_MS) return null;
    return await readFile(ruta);
  } catch {
    return null;
  }
}

async function guardarCache(ruta: string, bytes: Uint8Array): Promise<void> {
  try {
    await mkdir(CARPETA_CACHE, { recursive: true });
    // Se escribe en un archivo aparte y se renombra: nadie lee un archivo a medias.
    const temporal = `${ruta}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporal, bytes);
    await rename(temporal, ruta);
  } catch (error) {
    // Sin caché la imagen igual se sirve; solo se vuelve a descargar.
    console.error("[imagen-hd] No se pudo guardar la caché:", (error as Error).message);
  }
}

async function obtenerDeIdioma(idioma: IdiomaTcgdex, idApi: string): Promise<Uint8Array | null> {
  const ruta = rutaCache(idioma, idApi);
  const guardada = await leerCache(ruta);
  if (guardada) return guardada;

  const clave = `${idioma}|${idApi}`;
  const existente = enCurso.get(clave);
  if (existente) return existente;

  const descarga = (async () => {
    const bytes = await descargarImagenAltaDefinicion(idioma, idApi);
    if (bytes) await guardarCache(ruta, bytes);
    return bytes;
  })().finally(() => enCurso.delete(clave));
  enCurso.set(clave, descarga);
  return descarga;
}

/** Idiomas a probar, en orden y sin repetir. */
export function idiomasAProbar(idiomaCarta: string): IdiomaTcgdex[] {
  return esIdiomaTcgdex(idiomaCarta) && idiomaCarta !== "en" ? [idiomaCarta, "en"] : ["en"];
}

/**
 * Devuelve la imagen grande de la carta `idCarta`, o null si el id no es
 * válido, la carta no existe o TCGdex no la tiene.
 */
export async function obtenerImagenHd(idCarta: unknown): Promise<ImagenHd | null> {
  const id = idCartaImagenSchema.safeParse(idCarta);
  if (!id.success) return null;

  // Lectura pública del catálogo, con RLS y sin clave secreta. Se pide solo
  // lo necesario y el id viaja como parámetro (regla 5).
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cartas")
    .select("id_api, idioma")
    .eq("id", id.data)
    .maybeSingle();
  if (error || !data) return null;

  const idApi = idApiSchema.safeParse(data.id_api);
  if (!idApi.success) return null;

  for (const idioma of idiomasAProbar(data.idioma)) {
    const bytes = await obtenerDeIdioma(idioma, idApi.data);
    if (bytes) return { bytes };
  }
  return null;
}
