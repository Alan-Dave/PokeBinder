import "server-only";

import type { PreciosCarta } from "@/lib/precios";
import { descargarPrecios } from "@/lib/tcgdex";
import { esIdiomaTcgdex, type IdiomaTcgdex } from "@/lib/validators/imagen-hd";
import { CARTAS_PRECIO_MAX, cartaPrecioSchema } from "@/lib/validators/precios";

/**
 * Precios de mercado de las cartas (PBI-29, RF-07).
 *
 * A TCGdex solo viaja el id_api de cada carta (un identificador público del
 * catálogo): ningún dato del usuario sale del sistema. Los precios cambian a
 * diario, por eso no se guardan en la base: se consultan y se recuerdan en
 * memoria un tiempo.
 */

export const VIGENCIA_ACIERTO_MS = 6 * 60 * 60 * 1000;
// Un fallo (red caída, carta sin precio) se reintenta pronto.
export const VIGENCIA_FALLO_MS = 60 * 1000;
const CONCURRENCIA = 4;

type Entrada = { valor: PreciosCarta | null; hasta: number };
const cache = new Map<string, Entrada>();
// Si dos peticiones piden la misma carta a la vez, solo se consulta una vez.
const enCurso = new Map<string, Promise<PreciosCarta | null>>();

/** Solo para pruebas. */
export function vaciarCachePrecios(): void {
  cache.clear();
  enCurso.clear();
}

async function consultar(idioma: IdiomaTcgdex, idApi: string): Promise<PreciosCarta | null> {
  const clave = `${idioma}|${idApi}`;
  const guardada = cache.get(clave);
  if (guardada && guardada.hasta > Date.now()) return guardada.valor;

  const existente = enCurso.get(clave);
  if (existente) return existente;

  const consulta = descargarPrecios(idioma, idApi)
    .then((valor) => {
      cache.set(clave, { valor, hasta: Date.now() + (valor ? VIGENCIA_ACIERTO_MS : VIGENCIA_FALLO_MS) });
      return valor;
    })
    .finally(() => enCurso.delete(clave));
  enCurso.set(clave, consulta);
  return consulta;
}

/**
 * Los id de otros idiomas no siempre coinciden con nuestro id_api: se prueba
 * el idioma de la carta y después el inglés. El chino va directo al inglés.
 * Los precios son de la carta, no del idioma de la impresión.
 */
async function preciosDeCarta(idioma: string, idApi: string): Promise<PreciosCarta | null> {
  const idiomas: IdiomaTcgdex[] = esIdiomaTcgdex(idioma) && idioma !== "en" ? [idioma, "en"] : ["en"];
  for (const i of idiomas) {
    for (const id of variantesDeId(idApi)) {
      const precios = await consultar(i, id);
      if (precios) return precios;
    }
  }
  return null;
}

/**
 * Los sets de Escarlata y Púrpura se llaman distinto en nuestro catálogo y en
 * TCGdex: sv2 → sv02, sv4pt5 → sv04.5. Solo se traducen estos (un dígito, con o
 * sin «pt»), comprobados uno a uno contra TCGdex; cualquier otro set se deja
 * igual, porque adivinar uno mostraría el precio de otra carta.
 */
const SET_ESCARLATA_PURPURA = /^sv(\d)(?:pt(\d))?$/;

function setDeTcgdex(set: string): string {
  const m = SET_ESCARLATA_PURPURA.exec(set);
  if (!m) return set;
  return m[2] ? `sv0${m[1]}.${m[2]}` : `sv0${m[1]}`;
}

/**
 * Nuestro catálogo guarda ids que TCGdex escribe distinto: números sin ceros a
 * la izquierda (sv10-60, swsh11-43; TCGdex usa tres cifras) y algunos sets de
 * Escarlata y Púrpura (ver setDeTcgdex). Se prueba el id tal cual y después las
 * formas corregidas. Todas siguen cumpliendo idApiSchema.
 */
export function variantesDeId(idApi: string): string[] {
  const corte = idApi.lastIndexOf("-");
  if (corte < 0) return [idApi];
  const set = setDeTcgdex(idApi.slice(0, corte));
  const numero = idApi.slice(corte + 1);
  const relleno = /^\d{1,2}$/.test(numero) ? numero.padStart(3, "0") : numero;
  return [...new Set([idApi, `${set}-${numero}`, `${set}-${relleno}`])];
}

/** Ejecuta `tarea` sobre cada elemento con como mucho `limite` a la vez. */
async function enParalelo<T, R>(items: readonly T[], limite: number, tarea: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = new Array(items.length);
  let siguiente = 0;
  const trabajadores = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (siguiente < items.length) {
      const i = siguiente++;
      resultados[i] = await tarea(items[i]);
    }
  });
  await Promise.all(trabajadores);
  return resultados;
}

/**
 * Precios de varias cartas, por id_api. Una carta sin precio queda en null.
 * Nunca lanza: si algo falla, esa carta queda sin precio y el error se registra.
 * Quien llama pasa cartas que ya salieron de la base (RLS acotó el acceso).
 */
export async function obtenerPreciosCartas(entrada: unknown): Promise<Map<string, PreciosCarta | null>> {
  if (!Array.isArray(entrada) || entrada.length > CARTAS_PRECIO_MAX) return new Map();

  // Cada carta se valida por separado: una con id raro no debe dejar sin
  // precio a las demás de la página.
  const validas = entrada.flatMap((c) => {
    const r = cartaPrecioSchema.safeParse(c);
    return r.success ? [r.data] : [];
  });

  // Una misma carta puede aparecer en varias variantes: se consulta una vez.
  const unicas = [...new Map(validas.map((c) => [c.idApi, c])).values()];
  const resultado = new Map<string, PreciosCarta | null>();

  try {
    const precios = await enParalelo(unicas, CONCURRENCIA, (c) => preciosDeCarta(c.idioma, c.idApi));
    unicas.forEach((c, i) => resultado.set(c.idApi, precios[i]));
  } catch (error) {
    console.error("[precios] Error inesperado al consultar precios:", error);
    unicas.forEach((c) => resultado.set(c.idApi, null));
  }
  return resultado;
}
