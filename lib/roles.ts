import "server-only";

import { createClient } from "@/lib/supabase/server";
import { asignarRolSchema, listarPerfilesSchema, USUARIOS_POR_PAGINA, type Rol } from "@/lib/validators/roles";

/**
 * Asignación de roles del lado del servidor.
 *
 * La autorización real la hacen las funciones SQL asignar_rol y
 * listar_perfiles, con la sesión del usuario: aunque alguien se salte esta
 * capa y llame a la Data API directamente, la base rechaza a quien no sea
 * superusuario. Aquí se valida la entrada y se traducen los errores.
 */

export type Perfil = {
  id: string;
  nombre_visible: string;
  rol: Rol;
  creado_en: string;
};

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

// Códigos de PostgreSQL que lanzan las funciones a propósito. Cualquier otro
// es un fallo inesperado y su detalle no se muestra al usuario.
const MENSAJES: Record<string, string> = {
  "42501": "No tienes permiso para realizar esta acción.",
  P0002: "El usuario no existe.",
  "23514": "El sistema debe conservar al menos un superusuario.",
};

function traducirError(codigo: string | undefined, origen: string, detalle: unknown): string {
  const mensaje = codigo ? MENSAJES[codigo] : undefined;
  if (mensaje) return mensaje;

  console.error(`[roles] Error inesperado en ${origen}:`, detalle);
  return "No se pudo completar la operación.";
}

export async function asignarRol(entrada: unknown): Promise<Resultado<null>> {
  const validado = asignarRolSchema.safeParse(entrada);
  if (!validado.success) {
    return { ok: false, error: validado.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("asignar_rol", {
    p_usuario_id: validado.data.usuarioId,
    p_rol: validado.data.rol,
  });

  if (error) return { ok: false, error: traducirError(error.code, "asignar_rol", error) };
  return { ok: true, datos: null };
}

export type PaginaPerfiles = {
  perfiles: Perfil[];
  total: number;
  pagina: number;
  porPagina: number;
};

/**
 * Devuelve una página de perfiles. La función SQL listar_perfiles(p_pagina,
 * p_tamano) corta la lista en la base, con la comprobación de superusuario y
 * el registro en la bitácora: la aplicación solo recibe los usuarios que muestra.
 */
export async function listarPerfiles(entrada: unknown = {}): Promise<Resultado<PaginaPerfiles>> {
  const validado = listarPerfilesSchema.safeParse(entrada);
  if (!validado.success) {
    return { ok: false, error: validado.error.issues[0].message };
  }
  const { pagina } = validado.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_perfiles", {
    p_pagina: pagina,
    p_tamano: USUARIOS_POR_PAGINA,
  });

  if (error) return { ok: false, error: traducirError(error.code, "listar_perfiles", error) };

  const filas = (data ?? []) as (Perfil & { total: number | string })[];
  // count(*) es bigint: se normaliza por si llega como texto.
  const total = filas.length > 0 ? Number(filas[0].total) : 0;
  const perfiles: Perfil[] = filas.map((fila) => ({
    id: fila.id,
    nombre_visible: fila.nombre_visible,
    rol: fila.rol,
    creado_en: fila.creado_en,
  }));

  return { ok: true, datos: { perfiles, total, pagina, porPagina: USUARIOS_POR_PAGINA } };
}
