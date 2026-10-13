import "server-only";

import { createClient } from "@/lib/supabase/server";
import { loginSchema, registroSchema } from "@/lib/validators/auth";

/**
 * Registro, inicio y cierre de sesión (PBI-06), con Supabase Auth.
 *
 * Supabase Auth guarda la contraseña como hash (bcrypt): la aplicación no la
 * guarda ni la registra en ningún log. Tampoco se devuelve al usuario el
 * mensaje original de Supabase: algunos revelan si un correo ya está
 * registrado, y eso ayuda a quien busca cuentas de otras personas.
 *
 * El rol nunca viaja desde aquí: el trigger de la base crea el perfil siempre
 * como usuario_normal (ver supabase/migrations/20260928004000).
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

export type PerfilActual = { id: string; correo: string | null; nombreVisible: string | null };

const CREDENCIALES_INVALIDAS = "Correo o contraseña incorrectos.";
const DEMASIADOS_INTENTOS = "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";

// Códigos de error de Supabase Auth que se traducen a propósito. Cualquier otro
// es un fallo inesperado: se registra su código (nunca el correo ni la clave)
// y el usuario ve un mensaje genérico.
const LIMITES = new Set(["over_request_rate_limit", "over_email_send_rate_limit"]);

export async function registrar(entrada: unknown): Promise<Resultado<{ conSesion: boolean }>> {
  const validado = registroSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };
  const { correo, contrasena, nombreVisible } = validado.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: contrasena,
    // El trigger crear_perfil lee nombre_visible de aquí y lo valida de nuevo.
    options: { data: { nombre_visible: nombreVisible } },
  });

  if (error) {
    if (error.code && LIMITES.has(error.code)) return { ok: false, error: DEMASIADOS_INTENTOS };
    if (error.code === "weak_password") {
      return { ok: false, error: "La contraseña es demasiado débil. Usa una más larga y menos común." };
    }
    console.error(`[auth] Error en el registro (código: ${error.code ?? "desconocido"}).`);
    // Mismo mensaje si el correo ya existe o si falló otra cosa.
    return { ok: false, error: "No se pudo crear la cuenta. Si ya tienes una, inicia sesión." };
  }

  // Sin sesión = el proyecto exige confirmar el correo antes de entrar.
  return { ok: true, datos: { conSesion: data.session !== null } };
}

export async function iniciarSesion(entrada: unknown): Promise<Resultado<null>> {
  const validado = loginSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: validado.data.correo,
    password: validado.data.contrasena,
  });

  if (error) {
    if (error.code === "invalid_credentials") return { ok: false, error: CREDENCIALES_INVALIDAS };
    if (error.code === "email_not_confirmed") {
      return { ok: false, error: "Debes confirmar tu correo antes de iniciar sesión." };
    }
    if (error.code && LIMITES.has(error.code)) return { ok: false, error: DEMASIADOS_INTENTOS };
    console.error(`[auth] Error al iniciar sesión (código: ${error.code ?? "desconocido"}).`);
    return { ok: false, error: "No se pudo iniciar sesión." };
  }
  return { ok: true, datos: null };
}

export async function cerrarSesion(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) console.error(`[auth] Error al cerrar sesión (código: ${error.code ?? "desconocido"}).`);
}

/**
 * Usuario de la sesión actual, o null si no hay. getUser consulta a Supabase
 * Auth para validar el token; getSession solo lo leería de la cookie, que el
 * cliente puede alterar, y no sirve para decidir nada.
 */
export async function obtenerPerfilActual(): Promise<PerfilActual | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS: cada usuario solo puede leer su propio perfil.
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_visible")
    .eq("id", user.id)
    .maybeSingle();

  return { id: user.id, correo: user.email ?? null, nombreVisible: perfil?.nombre_visible ?? null };
}
