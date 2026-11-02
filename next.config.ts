import type { NextConfig } from "next";

// Cabeceras de seguridad básicas para todas las respuestas. La política de
// contenido (CSP) completa se define en el endurecimiento de seguridad (PBI-27),
// cuando se conozcan todos los orígenes que usa la aplicación.
const securityHeaders = [
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
  experimental: {
    serverActions: {
      // Por defecto 1 MB. Las propuestas de imagen admiten archivos de hasta
      // 2 MB (ver lib/validators/propuestas.ts) más los campos de texto.
      bodySizeLimit: "3mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
