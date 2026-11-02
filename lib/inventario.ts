import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  agregarAlInventarioSchema,
  cambiarCantidadSchema,
  eliminarDelInventarioSchema,
  listarInventarioSchema,
} from "@/lib/validators/inventario";

/**
 * Administración del inventario del usuario (PBI-12).
 *
 * El aislamiento entre usuarios lo garantiza RLS sobre public.inventario
 * (using y with check sobre usuario_id = auth.uid()), y usuario_id toma su
 * valor de auth.uid() por defecto: estas funciones nunca lo reciben ni lo
 * envían, así que no hay forma de crear o tocar una fila a nombre de otro.
 * Aquí se valida la entrada y se traducen los errores de la base.
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

export type FilaInventario = {
  id: number;
  carta_id: number;
  variante: string;
  cantidad: number;
  cartas: { id_api: string; nombre: string; idioma: string } | null;
};

// El catálogo y el inventario paginan de 30 en 30 (ver CLAUDE.md).
export const TAMANO_PAGINA = 30;

// Códigos de PostgreSQL que producen las restricciones de la tabla a
// propósito. Cualquier otro es un fallo inesperado y su detalle no se muestra.
const MENSAJES: Record<string, string> = {
  "23505": "Esa carta y variante ya están en tu inventario. Edita la cantidad.",
  "23514": "Esa variante no existe para la carta, o la cantidad no es válida.",
  "23503": "La carta no existe.",
  "42501": "No tienes permiso para realizar esta acción.",
};

function traducirError(codigo: string | undefined, origen: string, detalle: unknown): string {
  const mensaje = codigo ? MENSAJES[codigo] : undefined;
  if (mensaje) return mensaje;

  console.error(`[inventario] Error inesperado en ${origen}:`, detalle);
  return "No se pudo completar la operación.";
}

export const SIN_SESION = "Se requiere una sesión iniciada.";
// Mismo mensaje si la fila no existe o es de otro usuario (RLS la oculta):
// no se confirma que el id de un registro ajeno existe.
const NO_ENCONTRADO = "El registro no existe o no te pertenece.";

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function agregarAlInventario(entrada: unknown): Promise<Resultado<{ id: number }>> {
  const validado = agregarAlInventarioSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { cartaId, variante, cantidad } = validado.data;
  const { data, error } = await supabase
    .from("inventario")
    .insert({ carta_id: cartaId, variante, cantidad })
    .select("id")
    .single();

  if (error) return { ok: false, error: traducirError(error.code, "agregar", error) };
  return { ok: true, datos: { id: data.id } };
}

export async function cambiarCantidad(entrada: unknown): Promise<Resultado<null>> {
  const validado = cambiarCantidadSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { id, cantidad } = validado.data;
  const { data, error } = await supabase
    .from("inventario")
    .update({ cantidad })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: traducirError(error.code, "cambiarCantidad", error) };
  if (!data) return { ok: false, error: NO_ENCONTRADO };
  return { ok: true, datos: null };
}

export async function eliminarDelInventario(entrada: unknown): Promise<Resultado<null>> {
  const validado = eliminarDelInventarioSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { data, error } = await supabase
    .from("inventario")
    .delete()
    .eq("id", validado.data.id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: traducirError(error.code, "eliminar", error) };
  if (!data) return { ok: false, error: NO_ENCONTRADO };
  return { ok: true, datos: null };
}

export async function listarInventario(
  entrada: unknown = {},
): Promise<Resultado<{ filas: FilaInventario[]; total: number }>> {
  const validado = listarInventarioSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const desde = (validado.data.pagina - 1) * TAMANO_PAGINA;
  const { data, error, count } = await supabase
    .from("inventario")
    .select("id, carta_id, variante, cantidad, cartas(id_api, nombre, idioma)", { count: "exact" })
    .order("id")
    .range(desde, desde + TAMANO_PAGINA - 1);

  if (error) return { ok: false, error: traducirError(error.code, "listar", error) };
  return { ok: true, datos: { filas: data as unknown as FilaInventario[], total: count ?? 0 } };
}
