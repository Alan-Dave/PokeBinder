import type { createClient } from "@/lib/supabase/server";
import { patronPrefijo } from "@/lib/validators/catalogo";
import type { FiltrosInventario } from "@/lib/validators/filtros";

/**
 * Consulta de inventario con los filtros opcionales de los reportes (PBI-24).
 *
 * `columnas` es siempre un texto fijo del código que llama, nunca del usuario.
 * Los valores de los filtros ya pasaron por zod y viajan como parámetros de la
 * consulta, no concatenados. La unión con cartas es interna (!inner) para poder
 * filtrar por columnas de la carta; todo inventario tiene carta (clave foránea).
 * RLS sigue limitando las filas al usuario de la sesión.
 */
export function consultarInventario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  columnas: string,
  filtros: FiltrosInventario,
) {
  let consulta = supabase.from("inventario").select(columnas).order("id");
  if (filtros.idioma) consulta = consulta.eq("cartas.idioma", filtros.idioma);
  if (filtros.setId) consulta = consulta.eq("cartas.set_id", filtros.setId);
  // Prefijo sin distinguir mayúsculas, con los comodines del usuario escapados.
  if (filtros.rareza) consulta = consulta.ilike("cartas.rarity", patronPrefijo(filtros.rareza));
  return consulta;
}
