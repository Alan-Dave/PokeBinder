import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { registroPreciosSchema } from "@/lib/validators/historial";

/**
 * Guarda el precio del día en precios_historial (PBI-30, RF-10).
 *
 * Es el ÚNICO lugar que escribe esa tabla. Los usuarios no pueden: RLS solo les
 * deja leer, porque si pudieran insertar falsearían los precios que ven los
 * demás. Por eso usa la clave de servicio, que solo vive en el servidor.
 * Los datos salen de TCGdex (ya validados) y de ids de cartas que la base
 * entregó; nada de esto viene del navegador.
 *
 * Es un registro de cortesía: nunca lanza ni retrasa la pantalla con errores.
 */
export async function registrarPrecios(entrada: unknown): Promise<void> {
  const validado = registroPreciosSchema.safeParse(entrada);
  if (!validado.success) return;

  // Un precio por carta, acabado y día: el primero del día queda (los repetidos
  // se ignoran gracias a la clave primaria).
  const filas = validado.data.flatMap((c) =>
    c.acabados.map((a) => ({ carta_id: c.cartaId, acabado: a.acabado, mercado: Math.round(a.mercado * 100) / 100 })),
  );
  if (filas.length === 0) return;

  try {
    const { error } = await createAdminClient()
      .from("precios_historial")
      .upsert(filas, { onConflict: "carta_id,acabado,fecha", ignoreDuplicates: true });
    if (error) console.error("[historial] No se pudo guardar el precio del día:", error.code);
  } catch (error) {
    console.error("[historial] Error inesperado al guardar precios:", error);
  }
}
