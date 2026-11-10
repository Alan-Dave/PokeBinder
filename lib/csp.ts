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
 * Scripts: con un nonce (un valor aleatorio nuevo en cada petición, que genera
 * proxy.ts) script-src admite solo los scripts que lo llevan, y los que ellos
 * carguen ('strict-dynamic'). Next.js lee el nonce de la cabecera de la petición
 * y lo pone en sus propios scripts. Así, un script inyectado por un atacante no
 * se ejecuta aunque llegue al HTML. Sin nonce (solo si alguien llama a esta
 * función sin proxy) cae a 'unsafe-inline', el comportamiento anterior.
 *
 * Límite conocido: style-src sigue admitiendo 'unsafe-inline' porque Tailwind y
 * algunos componentes usan estilos en línea; un estilo inyectado puede cambiar
 * la apariencia, pero no ejecutar código.
 */

type Opciones = {
  // Valor de NEXT_PUBLIC_SUPABASE_URL; si falta o no es válido se admite *.supabase.co.
  supabaseUrl?: string;
  // En desarrollo Next necesita eval y un websocket para recargar en caliente.
  desarrollo?: boolean;
  // Valor aleatorio de esta petición (ver nonceDesdeBytes). Activa la política estricta de scripts.
  nonce?: string;
};

// Un nonce es base64: letras, dígitos, + / = (y - _ de la variante segura en URL).
const NONCE_VALIDO = /^[A-Za-z0-9+/_=-]{16,}$/;

/**
 * Convierte bytes aleatorios en un nonce (base64). Quien llama aporta los bytes
 * (crypto.getRandomValues): aquí no se genera azar, así se puede probar.
 */
export function nonceDesdeBytes(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

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

export function construirCsp({ supabaseUrl, desarrollo = false, nonce }: Opciones = {}): string {
  const supabase = origenSupabase(supabaseUrl);
  // Un nonce raro no se "arregla": entraría tal cual a una cabecera de seguridad.
  if (nonce !== undefined && !NONCE_VALIDO.test(nonce)) throw new Error("El nonce de la CSP no es válido.");

  const directivas: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      ...(nonce ? [`'nonce-${nonce}'`, "'strict-dynamic'"] : ["'unsafe-inline'"]),
      ...(desarrollo ? ["'unsafe-eval'"] : []),
    ],
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
