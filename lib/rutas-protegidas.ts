/**
 * Qué rutas piden iniciar sesión y cuándo conviene mandar al login (PBI-27, F4).
 *
 * Es comodidad de la interfaz, NO control de acceso: cada página y cada ruta
 * verifica la sesión y el rol por su cuenta en el servidor (regla 6) y RLS decide
 * qué datos se ven. Aquí solo se evita mostrar una pantalla vacía con un aviso a
 * quien ni siquiera tiene sesión.
 */

// Las zonas de la aplicación que no tienen sentido sin una cuenta.
export const PREFIJOS_PROTEGIDOS = [
  "/coleccion",
  "/binder",
  "/mazos",
  "/dashboard",
  "/reportes",
  "/admin",
  "/cuenta",
] as const;

// Las descargas responden 401 por su cuenta: redirigirlas devolvería una página
// HTML en lugar de un archivo.
const SEGMENTOS_DE_DESCARGA = new Set(["exportar", "proxies"]);

/** true si un visitante sin sesión debe ir al login al pedir esta ruta. */
export function requiereSesion(ruta: string): boolean {
  const segmentos = ruta.split("/").filter(Boolean);
  if (segmentos.length === 0) return false;
  const zona = `/${segmentos[0]}`;
  if (!(PREFIJOS_PROTEGIDOS as readonly string[]).includes(zona)) return false;
  return !segmentos.some((s) => SEGMENTOS_DE_DESCARGA.has(s));
}

/**
 * Supabase guarda la sesión en cookies «sb-<proyecto>-auth-token», a veces
 * partidas en trozos («.0», «.1»). Sin ninguna de ellas el visitante es anónimo.
 */
export function tieneCookieDeSesion(nombres: readonly string[]): boolean {
  return nombres.some((n) => n.startsWith("sb-") && n.includes("-auth-token"));
}

/**
 * Solo se redirige a quien claramente no tiene sesión y pide una página (GET).
 * Con una cookie caducada o inválida NO se redirige: la página decide, igual que
 * si Supabase no respondiera. Las acciones (POST) tampoco se tocan.
 */
export function debeRedirigirAlLogin(metodo: string, ruta: string, nombresDeCookies: readonly string[]): boolean {
  return metodo === "GET" && requiereSesion(ruta) && !tieneCookieDeSesion(nombresDeCookies);
}
