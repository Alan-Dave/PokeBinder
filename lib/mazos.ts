import "server-only";

import { createClient } from "@/lib/supabase/server";
import { calcularCobertura, type CoberturaCarta } from "@/lib/cobertura";
import { cruzarMazoSchema } from "@/lib/validators/mazos";

/**
 * Cruce de un mazo contra el inventario real del usuario (PBI-17).
 *
 * Es una consulta de solo lectura: no modifica ni el mazo ni el inventario.
 * RLS ya impide leer mazo_cartas de un mazo ajeno, pero igual se verifica acá
 * el dueño del mazo de forma explícita: si en algún momento se agrega un
 * camino de lectura distinto (una vista, una función con más privilegios),
 * este chequeo no depende de que RLS siga cubriendo ese camino nuevo.
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

export async function obtenerCoberturaMazo(entrada: unknown): Promise<Resultado<CoberturaCarta[]>> {
  const validado = cruzarMazoSchema.safeParse(entrada);
  if (!validado.success) {
    return { ok: false, error: validado.error.issues[0].message };
  }
  const { mazoId } = validado.data;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Se requiere una sesión iniciada." };
  }

  const { data: mazo, error: errorMazo } = await supabase
    .from("mazos")
    .select("id, usuario_id")
    .eq("id", mazoId)
    .maybeSingle();

  if (errorMazo) {
    console.error("[mazos] Error al leer el mazo:", errorMazo);
    return { ok: false, error: "No se pudo obtener el mazo." };
  }
  // maybeSingle no distingue "no existe" de "existe pero es de otro usuario"
  // (RLS ya filtra esa segunda opción): el mensaje es el mismo a propósito,
  // para no confirmarle a nadie que un id de mazo ajeno existe.
  if (!mazo || mazo.usuario_id !== user.id) {
    return { ok: false, error: "El mazo no existe o no te pertenece." };
  }

  const { data: mazoCartas, error: errorMazoCartas } = await supabase
    .from("mazo_cartas")
    .select("carta_id, cantidad")
    .eq("mazo_id", mazoId);

  if (errorMazoCartas) {
    console.error("[mazos] Error al leer mazo_cartas:", errorMazoCartas);
    return { ok: false, error: "No se pudo obtener el mazo." };
  }
  if (!mazoCartas || mazoCartas.length === 0) {
    return { ok: true, datos: [] };
  }

  const cartaIds = [...new Set(mazoCartas.map((c) => c.carta_id))];
  const { data: filasInventario, error: errorInventario } = await supabase
    .from("inventario")
    .select("carta_id, cantidad")
    .eq("usuario_id", user.id)
    .in("carta_id", cartaIds);

  if (errorInventario) {
    console.error("[mazos] Error al leer el inventario:", errorInventario);
    return { ok: false, error: "No se pudo obtener el inventario." };
  }

  // Una carta puede tener varias filas de inventario (una por variante:
  // normal, reverse, holo...); a la cobertura le importa el total, no qué
  // variante es cada copia.
  const inventarioPorCarta = new Map<number, number>();
  for (const fila of filasInventario ?? []) {
    inventarioPorCarta.set(fila.carta_id, (inventarioPorCarta.get(fila.carta_id) ?? 0) + fila.cantidad);
  }
  const inventarioSumado = [...inventarioPorCarta.entries()].map(([carta_id, cantidad]) => ({
    carta_id,
    cantidad,
  }));

  return { ok: true, datos: calcularCobertura(mazoCartas, inventarioSumado) };
}
