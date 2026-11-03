import "server-only";

import { aCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";
import { exportarInventarioSchema } from "@/lib/validators/exportar";
import { aXlsx } from "@/lib/xlsx";

/**
 * Exportación del inventario del usuario a CSV o Excel (PBI-22).
 *
 * El único parámetro del usuario es el formato, validado con zod. El alcance
 * lo fija RLS sobre public.inventario (usuario_id = auth.uid()), así que solo
 * puede exportar lo suyo. Lee por bloques para no depender del límite de filas
 * por consulta.
 */

export type Archivo = { contenido: string | Uint8Array; tipo: string; nombre: string };
export type ResultadoExportacion = { ok: true; archivo: Archivo } | { ok: false; error: string };

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

export async function exportarInventario(entrada: unknown): Promise<ResultadoExportacion> {
  const validado = exportarInventarioSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

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

  const tabla = filas.map((f) => [f.cartas?.id_api, f.cartas?.nombre, f.cartas?.idioma, f.variante, f.cantidad]);

  if (validado.data.formato === "xlsx") {
    return {
      ok: true,
      archivo: {
        contenido: await aXlsx("Inventario", ENCABEZADOS, tabla),
        tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        nombre: "inventario.xlsx",
      },
    };
  }
  return {
    ok: true,
    archivo: { contenido: aCsv(ENCABEZADOS, tabla), tipo: "text/csv; charset=utf-8", nombre: "inventario.csv" },
  };
}
