import type { NextConfig } from "next";
import { construirCsp } from "./lib/csp";

// Cabeceras de seguridad para todas las respuestas. La política de contenido
// (CSP) y sus límites están explicados en lib/csp.ts (PBI-27).
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: construirCsp({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      desarrollo: process.env.NODE_ENV !== "production",
    }),
  },
  // Impide que otro sitio incruste la aplicación en un iframe (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Impide que el navegador reinterprete el tipo de un archivo.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // No envía la ruta completa a sitios externos al seguir un enlace.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // La aplicación no usa cámara, micrófono ni ubicación.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // No anuncia en cada respuesta qué framework usa el servidor.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
