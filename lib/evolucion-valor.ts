import "server-only";

import { calcularEvolucion, type Evolucion, type FilaValor, type PuntoPrecio } from "@/lib/evolucion";
import { createClient } from "@/lib/supabase/server";
import { evolucionSchema, filaHistorialSchema, filaInventarioValorSchema } from "@/lib/validators/historial";

/**
 * Evolución del valor de la colección del usuario (PBI-30, RF-10).
 *
 * El inventario se lee con la sesión del usuario: RLS garantiza que solo ve el
 * suyo. El historial de precios es público (RLS solo deja leer) y se cruza aquí.
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

export const SIN_SESION = "Se requiere una sesión iniciada.";
const FALLO = "No se pudo calcular la evolución del valor.";

// Tope de filas del inventario que entran al cálculo, para acotar las consultas.
export const INVENTARIO_MAX = 500;
const CARTAS_POR_CONSULTA = 25;
// PostgREST devuelve como máximo 1000 filas por petición: se pagina.
const TAMANO_PAGINA = 1000;
const PAGINAS_MAX = 20;

export type EvolucionValor = Evolucion & { dias: number; inventarioRecortado: boolean };

export async function obtenerEvolucionValor(entrada: unknown = {}): Promise<Resultado<EvolucionValor>> {
  const validado = evolucionSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };
  const { dias } = validado.data;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: SIN_SESION };

    const inventario = await supabase
      .from("inventario")
      .select("carta_id, variante, cantidad")
      .order("id")
      .limit(INVENTARIO_MAX);
    if (inventario.error) {
      console.error("[evolucion] Error al leer el inventario:", inventario.error.code);
      return { ok: false, error: FALLO };
    }
    const filas: FilaValor[] = [];
    for (const f of inventario.data ?? []) {
      const fila = filaInventarioValorSchema.safeParse(f);
      if (fila.success)
        filas.push({ cartaId: fila.data.carta_id, variante: fila.data.variante, cantidad: fila.data.cantidad });
    }

    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const ids = [...new Set(filas.map((f) => f.cartaId))];
    const historial: PuntoPrecio[] = [];

    for (let i = 0; i < ids.length; i += CARTAS_POR_CONSULTA) {
      const lote = ids.slice(i, i + CARTAS_POR_CONSULTA);
      for (let pagina = 0; pagina < PAGINAS_MAX; pagina++) {
        const desdeFila = pagina * TAMANO_PAGINA;
        const { data, error } = await supabase
          .from("precios_historial")
          .select("carta_id, acabado, fecha, mercado")
          .in("carta_id", lote)
          .gte("fecha", desde)
          .order("fecha")
          .range(desdeFila, desdeFila + TAMANO_PAGINA - 1);
        if (error) {
          console.error("[evolucion] Error al leer el historial:", error.code);
          return { ok: false, error: FALLO };
        }
        for (const p of data ?? []) {
          const fila = filaHistorialSchema.safeParse(p);
          if (fila.success) {
            historial.push({
              cartaId: fila.data.carta_id,
              acabado: fila.data.acabado,
              fecha: fila.data.fecha,
              mercado: fila.data.mercado,
            });
          }
        }
        if ((data ?? []).length < TAMANO_PAGINA) break;
      }
    }

    return {
      ok: true,
      datos: {
        ...calcularEvolucion(filas, historial),
        dias,
        inventarioRecortado: (inventario.data ?? []).length >= INVENTARIO_MAX,
      },
    };
  } catch (error) {
    console.error("[evolucion] Error inesperado:", error);
    return { ok: false, error: FALLO };
  }
}
