import "server-only";

import { aCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";

/**
 * Exportación del inventario del usuario a CSV (PBI-22).
 *
 * No recibe parámetros del usuario: el alcance lo fija RLS sobre
 * public.inventario (usuario_id = auth.uid()), así que solo puede exportar
 * lo suyo. Lee por bloques para no depender del límite de filas por consulta.
 */

export type ResultadoCsv = { ok: true; csv: string } | { ok: false; error: string };

export const SIN_SESION = "Se requiere una sesión iniciada.";

const BLOQUE = 1000;
// Tope de seguridad: una exportación no puede crecer sin límite en memoria.
export const FILAS_MAX = 50_000;

const ENCABEZADOS = ["ID de carta (API)", "Nombre", "Idioma", "Variante", "Cantidad"] as const;

type FilaExportada = {
  variante: string;
  cantidad: number;
  cartas: { id_api: string; nombre: string; idioma: string } | null;
};

export async function exportarInventarioCsv(): Promise<ResultadoCsv> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: SIN_SESION };

  const filas: FilaExportada[] = [];
  for (let desde = 0; desde < FILAS_MAX; desde += BLOQUE) {
    const { data, error } = await supabase
      .from("inventario")
      .select("variante, cantidad, cartas(id_api, nombre, idioma)")
      .order("id")
      .range(desde, desde + BLOQUE - 1);

    if (error) {
      console.error("[exportar] Error inesperado al leer el inventario:", error);
      return { ok: false, error: "No se pudo generar la exportación." };
    }
    const bloque = data as unknown as FilaExportada[];
    filas.push(...bloque);
    if (bloque.length < BLOQUE) break;
  }

  const csv = aCsv(
    ENCABEZADOS,
    filas.map((f) => [f.cartas?.id_api, f.cartas?.nombre, f.cartas?.idioma, f.variante, f.cantidad]),
  );
  return { ok: true, csv };
}
