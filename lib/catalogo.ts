import "server-only";

import { createClient } from "@/lib/supabase/server";
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
