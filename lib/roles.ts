import "server-only";

import { createClient } from "@/lib/supabase/server";
import { asignarRolSchema, type Rol } from "@/lib/validators/roles";

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

export async function listarPerfiles(): Promise<Resultado<Perfil[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_perfiles");

  if (error) return { ok: false, error: traducirError(error.code, "listar_perfiles", error) };
  return { ok: true, datos: data as Perfil[] };
}
