import "server-only";

import { createClient } from "@/lib/supabase/server";
import { obtenerUrlsImagenes } from "@/lib/imagenes";
import { buscarCatalogoSchema, patronPrefijo } from "@/lib/validators/catalogo";

/**
 * Consulta del catálogo público (PBI-09).
 *
 * No requiere sesión: el catálogo es de lectura abierta a propósito. Todos los
 * valores del usuario viajan como parámetros de la API, nunca concatenados en
 * una consulta (regla 5), y pasan antes por un esquema zod (regla 4).
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

export type CartaCatalogo = {
  id: number;
  id_api: string;
  idioma: string;
  nombre: string;
  type: string | null;
  rarity: string | null;
  number: string;
  set_id: string;
  variantes_disponibles: string[];
};

export type CartaDetalle = CartaCatalogo & {
  stage: string | null;
  subtipos: string[];
  // Nombre del set en el idioma de la carta; null si el origen no lo trae.
  set_nombre: string | null;
};

export type FiltrosCatalogo = { tipos: string[]; rarezas: string[] };

// El catálogo pagina de 30 en 30 (ver CLAUDE.md). El binder tiene otra
// paginación: no se comparte este valor con él.
export const TAMANO_PAGINA_CATALOGO = 30;

const ERROR_GENERICO = "No se pudo consultar el catálogo.";

export async function buscarCartas(
  entrada: unknown,
): Promise<Resultado<{ filas: CartaCatalogo[]; total: number }>> {
  const validado = buscarCatalogoSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };
  const { texto, idioma, tipo, rareza, pagina } = validado.data;

  const supabase = await createClient();
  let consulta = supabase
    .from("cartas")
    .select("id, id_api, idioma, nombre, type, rarity, number, set_id, variantes_disponibles", {
      count: "exact",
    });

  if (texto) consulta = consulta.like("nombre_busqueda", patronPrefijo(texto));
  if (idioma) consulta = consulta.eq("idioma", idioma);
  if (tipo) consulta = consulta.eq("type", tipo);
  if (rareza) consulta = consulta.eq("rarity", rareza);

  const desde = (pagina - 1) * TAMANO_PAGINA_CATALOGO;
  const { data, error, count } = await consulta
    .order("nombre_busqueda")
    .order("id")
    .range(desde, desde + TAMANO_PAGINA_CATALOGO - 1);

  if (error) {
    console.error("[catalogo] Error al buscar cartas:", error);
    return { ok: false, error: ERROR_GENERICO };
  }
  return { ok: true, datos: { filas: data as CartaCatalogo[], total: count ?? 0 } };
}

export async function obtenerFiltros(): Promise<Resultado<FiltrosCatalogo>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catalogo_filtros").single();

  if (error) {
    console.error("[catalogo] Error al obtener los filtros:", error);
    return { ok: false, error: ERROR_GENERICO };
  }
  const { tipos, rarezas } = data as { tipos: string[]; rarezas: string[] };
  return { ok: true, datos: { tipos, rarezas } };
}

const DETALLE = "id, id_api, idioma, nombre, type, rarity, number, set_id, variantes_disponibles, stage, subtipos";

/** Una carta por su id, o null si no existe. */
export async function obtenerCarta(cartaId: number): Promise<Resultado<CartaDetalle | null>> {
  if (!Number.isSafeInteger(cartaId) || cartaId < 1) {
    return { ok: false, error: "El identificador de la carta no es válido." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("cartas").select(DETALLE).eq("id", cartaId).maybeSingle();

  if (error) {
    console.error("[catalogo] Error al obtener la carta:", error);
    return { ok: false, error: ERROR_GENERICO };
  }
  if (!data) return { ok: true, datos: null };

  // El nombre del set es un dato accesorio: si no se puede leer, la ficha se
  // muestra igual con el código del set.
  const { data: set } = await supabase
    .from("sets")
    .select("nombre")
    .eq("id", data.set_id)
    .eq("idioma", data.idioma)
    .maybeSingle();

  return { ok: true, datos: { ...(data as CartaCatalogo & { stage: string | null; subtipos: string[] }), set_nombre: set?.nombre ?? null } };
}

/**
 * URLs firmadas de las imágenes, o un mapa vacío si no se pueden obtener (por
 * ejemplo, si falta SUPABASE_SECRET_KEY en el entorno). Las imágenes son un
 * extra: la página debe funcionar sin ellas. Se registra una línea corta, no
 * la traza completa, para no llenar el log en cada visita.
 */
export async function urlsImagenesOpcionales(cartaIds: number[]): Promise<Record<number, string | null>> {
  if (cartaIds.length === 0) return {};
  try {
    const urls = await obtenerUrlsImagenes({ cartaIds });
    return urls.ok ? urls.datos : {};
  } catch (error) {
    // El mensaje de entorno viene en varias líneas: se junta en una sola.
    const motivo = error instanceof Error ? error.message.replace(/\s*\n\s*/g, " ") : "error desconocido";
    console.error(`[catalogo] Sin imágenes: ${motivo}`);
    return {};
  }
}
