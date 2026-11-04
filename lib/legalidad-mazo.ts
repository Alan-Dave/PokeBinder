import "server-only";

import { evaluarLegalidad, type LegalidadCarta, type ResultadoLegalidad } from "@/lib/legalidad";
import { obtenerMazo } from "@/lib/mazos";
import { descargarLegalidad } from "@/lib/tcgdex";
import { esIdiomaTcgdex, type IdiomaTcgdex } from "@/lib/validators/imagen-hd";
import { legalidadMazoSchema } from "@/lib/validators/legalidad";

/**
 * Legalidad de un mazo por formato (PBI-19, RF-08).
 *
 * El navegador solo manda el id del mazo y el formato. Qué cartas tiene el mazo
 * lo decide obtenerMazo, que valida la sesión y deja que RLS limite el acceso
 * al mazo del propio usuario. A TCGdex solo viaja el id_api de cada carta (un
 * identificador público del catálogo): ningún dato personal sale del sistema.
 *
 * La legalidad cambia con cada rotación, por eso no se guarda en la base: se
 * consulta y se recuerda en memoria un tiempo.
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

// Un mazo legítimo tiene pocas cartas distintas; el tope frena abusos hacia TCGdex.
export const LINEAS_MAX = 100;

export const VIGENCIA_ACIERTO_MS = 24 * 60 * 60 * 1000;
// Un fallo (red caída, carta ausente) se reintenta pronto, no al día siguiente.
export const VIGENCIA_FALLO_MS = 60 * 1000;
const CONCURRENCIA = 4;

const FALLO = "No se pudo comprobar la legalidad del mazo.";

type Entrada = { valor: LegalidadCarta | null; hasta: number };
const cache = new Map<string, Entrada>();
// Si dos peticiones piden la misma carta a la vez, solo se consulta una vez.
const enCurso = new Map<string, Promise<LegalidadCarta | null>>();

/** Solo para pruebas. */
export function vaciarCacheLegalidad(): void {
  cache.clear();
  enCurso.clear();
}

async function consultar(idioma: IdiomaTcgdex, idApi: string): Promise<LegalidadCarta | null> {
  const clave = `${idioma}|${idApi}`;
  const guardada = cache.get(clave);
  if (guardada && guardada.hasta > Date.now()) return guardada.valor;

  const existente = enCurso.get(clave);
  if (existente) return existente;

  const consulta = descargarLegalidad(idioma, idApi)
    .then((valor) => {
      cache.set(clave, { valor, hasta: Date.now() + (valor ? VIGENCIA_ACIERTO_MS : VIGENCIA_FALLO_MS) });
      return valor;
    })
    .finally(() => enCurso.delete(clave));
  enCurso.set(clave, consulta);
  return consulta;
}

/**
 * Los id de otros idiomas no siempre coinciden con nuestro id_api (el japonés
 * usa "PMCG1" donde nosotros "base1"): se prueba el idioma de la carta y
 * después el inglés. El chino no existe en TCGdex y va directo al inglés.
 */
async function legalidadDeCarta(idioma: string, idApi: string): Promise<LegalidadCarta | null> {
  const idiomas: IdiomaTcgdex[] = esIdiomaTcgdex(idioma) && idioma !== "en" ? [idioma, "en"] : ["en"];
  for (const i of idiomas) {
    const legalidad = await consultar(i, idApi);
    if (legalidad) return legalidad;
  }
  return null;
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

export async function obtenerLegalidadMazo(entrada: unknown): Promise<Resultado<ResultadoLegalidad>> {
  const validado = legalidadMazoSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  // obtenerMazo valida la sesión y deja que RLS acote el mazo al usuario.
  const mazo = await obtenerMazo({ mazoId: validado.data.mazoId });
  if (!mazo.ok) return mazo;

  const lineas = mazo.datos.lineas;
  if (lineas.length === 0) return { ok: false, error: "El mazo está vacío: no hay nada que comprobar." };
  if (lineas.length > LINEAS_MAX) {
    return {
      ok: false,
      error: `Se pueden comprobar hasta ${LINEAS_MAX} cartas distintas y el mazo tiene ${lineas.length}.`,
    };
  }

  try {
    const resultados = await enParalelo(lineas, CONCURRENCIA, (l) => legalidadDeCarta(l.idioma, l.idApi));
    const legalidades = new Map(lineas.map((l, i) => [l.cartaId, resultados[i]]));
    return { ok: true, datos: evaluarLegalidad(lineas, legalidades, validado.data.formato) };
  } catch (error) {
    console.error("[legalidad] Error inesperado al comprobar el mazo:", error);
    return { ok: false, error: FALLO };
  }
}
