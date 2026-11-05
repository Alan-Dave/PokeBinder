/**
 * Política de seguridad de contenido (CSP) de la aplicación (PBI-27).
 *
 * Es un texto que el servidor envía en la cabecera Content-Security-Policy y
 * que le dice al navegador de dónde puede cargar cada cosa. Si alguien lograra
 * inyectar un script o una imagen externa, el navegador la bloquea.
 *
 * Orígenes que usa la aplicación (revisado en el código):
 *  - imágenes: el propio sitio (/api/cartas/.../imagen-hd) y las URL firmadas
 *    del bucket de Supabase Storage;
 *  - fuentes: next/font las sirve desde el propio sitio;
 *  - el navegador NO habla con Supabase (todo pasa por el servidor), así que
 *    connect-src no necesita su dominio.
 *
 * Límite conocido: script-src admite 'unsafe-inline' porque Next.js inserta
 * scripts propios para hidratar la página. Una política estricta con nonce
 * obligaría a renderizar todo dinámicamente; queda como mejora futura.
 * Aun así, el resto de directivas (sin orígenes externos, sin iframes, sin
 * plugins, formularios solo hacia el propio sitio) sigue aplicando.
 */

type Opciones = {
  // Valor de NEXT_PUBLIC_SUPABASE_URL; si falta o no es válido se admite *.supabase.co.
  supabaseUrl?: string;
  // En desarrollo Next necesita eval y un websocket para recargar en caliente.
  desarrollo?: boolean;
};

const RESPALDO_SUPABASE = "https://*.supabase.co";

/** Origen (esquema + host + puerto) de la URL de Supabase, o el comodín de respaldo. */
export function origenSupabase(supabaseUrl: string | undefined): string {
  if (!supabaseUrl) return RESPALDO_SUPABASE;
  try {
    const url = new URL(supabaseUrl);
    // Solo https (o http en local): nunca otros esquemas como javascript: o data:.
    if (url.protocol !== "https:" && url.protocol !== "http:") return RESPALDO_SUPABASE;
    return url.origin;
  } catch {
    return RESPALDO_SUPABASE;
  }
}

export function construirCsp({ supabaseUrl, desarrollo = false }: Opciones = {}): string {
  const supabase = origenSupabase(supabaseUrl);

  const directivas: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(desarrollo ? ["'unsafe-eval'"] : [])],
    // Tailwind y los componentes usan estilos en línea (por ejemplo, el binder).
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", supabase],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(desarrollo ? ["ws:", "wss:"] : [])],
    // Nadie puede incrustar la aplicación (refuerza X-Frame-Options).
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };

  return Object.entries(directivas)
    .map(([nombre, valores]) => `${nombre} ${valores.join(" ")}`)
    .join("; ");
}
