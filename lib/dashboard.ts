import "server-only";

import { type Analisis, analizarCobertura, type TotalSet } from "@/lib/analisis";
import { obtenerResumenInventario, type Resultado, type ResumenConNombres } from "@/lib/reportes";
import { createClient } from "@/lib/supabase/server";
import { filtrosInventarioSchema } from "@/lib/validators/filtros";

/**
 * Datos del dashboard estadístico (PBI-23).
 *
 * Solo lectura. Reutiliza el resumen de reportes (misma validación de filtros,
 * misma RLS por usuario) y le suma el total de cartas de los sets con más
 * copias para calcular el avance. El análisis es un algoritmo propio en el
 * servidor: ningún dato del usuario sale hacia servicios externos.
 */

// Los gráficos muestran los sets con más copias; acota también las consultas de totales.
export const SETS_MAX = 10;

const FALLO = "No se pudo generar el dashboard.";

export type Dashboard = { resumen: ResumenConNombres; analisis: Analisis };

export async function obtenerDashboard(entrada: unknown = {}): Promise<Resultado<Dashboard>> {
  const validado = filtrosInventarioSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const resumen = await obtenerResumenInventario(validado.data);
  if (!resumen.ok) return resumen;

  // porSet ya viene ordenado por copias: los primeros son los más relevantes.
  const sets = resumen.datos.porSet.slice(0, SETS_MAX);

  const supabase = await createClient();
  const totales: TotalSet[] = [];
  const respuestas = await Promise.all(
    sets.map((s) =>
      supabase.from("cartas").select("id", { count: "exact", head: true }).eq("set_id", s.setId).eq("idioma", s.idioma),
    ),
  );
  for (const [i, r] of respuestas.entries()) {
    if (r.error) {
      console.error("[dashboard] Error inesperado al contar las cartas de un set:", r.error);
      return { ok: false, error: FALLO };
    }
    totales.push({ setId: sets[i].setId, idioma: sets[i].idioma, total: r.count ?? 0 });
  }

  const analisis = analizarCobertura(sets, totales, {
    copias: resumen.datos.copias,
    sinPrecio: resumen.datos.sinPrecio,
    nombresSet: resumen.datos.nombresSet,
  });

  return { ok: true, datos: { resumen: resumen.datos, analisis } };
}
