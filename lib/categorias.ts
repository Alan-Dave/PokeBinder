import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  categoriasDeCartasSchema,
  crearCategoriaSchema,
  eliminarCategoriaSchema,
  pertenenciaSchema,
  renombrarCategoriaSchema,
} from "@/lib/validators/categorias";

/**
 * Categorías dentro de la colección del usuario (PBI-X7).
 *
 * Igual que el inventario y los binders: el aislamiento entre usuarios lo
 * garantiza RLS (using y with check en categorias_coleccion y
 * categoria_cartas) y usuario_id toma su valor de auth.uid(), así que aquí
 * nunca se recibe ni se envía. Que la carta asignada sea del inventario del
 * propio usuario también lo decide la política. Aquí se valida la entrada y se
 * traducen los errores de la base.
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

export type Categoria = { id: number; nombre: string; cartas: number };

export const SIN_SESION = "Se requiere una sesión iniciada.";
// Mismo mensaje si la categoría no existe o es de otro usuario (RLS la oculta).
const NO_ENCONTRADA = "La categoría no existe o no te pertenece.";

const MENSAJES: Record<string, string> = {
  "23505": "Ya tienes una categoría con ese nombre, o esa carta ya está en ella.",
  "23514": "El nombre no es válido, o llegaste al máximo de 100 categorías.",
  "23503": "La categoría o la carta no existe.",
  "42501": "No tienes permiso para realizar esta acción.",
};

function traducirError(codigo: string | undefined, origen: string, detalle: unknown): string {
  const mensaje = codigo ? MENSAJES[codigo] : undefined;
  if (mensaje) return mensaje;

  console.error(`[categorias] Error inesperado en ${origen}:`, detalle);
  return "No se pudo completar la operación.";
}

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function crearCategoria(entrada: unknown): Promise<Resultado<{ id: number }>> {
  const validado = crearCategoriaSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { data, error } = await supabase
    .from("categorias_coleccion")
    .insert({ nombre: validado.data.nombre })
    .select("id")
    .single();

  if (error) return { ok: false, error: traducirError(error.code, "crear", error) };
  return { ok: true, datos: { id: data.id } };
}

type FilaCategoria = { id: number; nombre: string; categoria_cartas: Array<{ count: number }> };

/** Las categorías del usuario, por nombre, con cuántas cartas tiene cada una. */
export async function listarCategorias(): Promise<Resultado<Categoria[]>> {
  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { data, error } = await supabase
    .from("categorias_coleccion")
    .select("id, nombre, categoria_cartas(count)")
    .order("nombre");

  if (error) return { ok: false, error: traducirError(error.code, "listar", error) };
  const categorias = (data as unknown as FilaCategoria[])
    .map((c) => ({ id: c.id, nombre: c.nombre, cartas: c.categoria_cartas[0]?.count ?? 0 }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  return { ok: true, datos: categorias };
}

export async function renombrarCategoria(entrada: unknown): Promise<Resultado<null>> {
  const validado = renombrarCategoriaSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { id, nombre } = validado.data;
  const { data, error } = await supabase
    .from("categorias_coleccion")
    .update({ nombre })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: traducirError(error.code, "renombrar", error) };
  if (!data) return { ok: false, error: NO_ENCONTRADA };
  return { ok: true, datos: null };
}

export async function eliminarCategoria(entrada: unknown): Promise<Resultado<null>> {
  const validado = eliminarCategoriaSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  // Borra la categoría y su pertenencia (cascade); las cartas siguen en el inventario.
  const { data, error } = await supabase
    .from("categorias_coleccion")
    .delete()
    .eq("id", validado.data.id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: traducirError(error.code, "eliminar", error) };
  if (!data) return { ok: false, error: NO_ENCONTRADA };
  return { ok: true, datos: null };
}

export async function asignarACategoria(entrada: unknown): Promise<Resultado<null>> {
  const validado = pertenenciaSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { categoriaId, inventarioId } = validado.data;
  const { error } = await supabase
    .from("categoria_cartas")
    .insert({ categoria_id: categoriaId, inventario_id: inventarioId });

  // Volver a asignar lo ya asignado no es un error para quien lo pide.
  if (error && error.code !== "23505") {
    // La política (with check) rechaza una carta o categoría ajena con 42501.
    return { ok: false, error: traducirError(error.code, "asignar", error) };
  }
  return { ok: true, datos: null };
}

export async function quitarDeCategoria(entrada: unknown): Promise<Resultado<null>> {
  const validado = pertenenciaSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { categoriaId, inventarioId } = validado.data;
  const { error } = await supabase
    .from("categoria_cartas")
    .delete()
    .eq("categoria_id", categoriaId)
    .eq("inventario_id", inventarioId);

  if (error) return { ok: false, error: traducirError(error.code, "quitar", error) };
  return { ok: true, datos: null };
}

/**
 * En qué categorías está cada carta de la página: inventarioId → ids de
 * categoría. Para dibujar las casillas marcadas del selector.
 */
export async function categoriasDeCartas(entrada: unknown): Promise<Resultado<Map<number, number[]>>> {
  const validado = categoriasDeCartasSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const mapa = new Map<number, number[]>();
  if (validado.data.length === 0) return { ok: true, datos: mapa };

  const { data, error } = await supabase
    .from("categoria_cartas")
    .select("categoria_id, inventario_id")
    .in("inventario_id", validado.data);

  if (error) return { ok: false, error: traducirError(error.code, "categoriasDeCartas", error) };
  for (const f of data as Array<{ categoria_id: number; inventario_id: number }>) {
    mapa.set(f.inventario_id, [...(mapa.get(f.inventario_id) ?? []), f.categoria_id]);
  }
  return { ok: true, datos: mapa };
}
