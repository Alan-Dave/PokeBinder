import { exportarFaltantes, SIN_SESION } from "@/lib/reportes";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

// Solo lectura: descarga las cartas que faltan de un set. Los parámetros
// (setId, idioma, formato) los valida lib/reportes.ts antes de consultar.
export async function GET(solicitud: Request) {
  const parametros = new URL(solicitud.url).searchParams;
  const resultado = await exportarFaltantes({
    setId: parametros.get("setId") ?? undefined,
    idioma: parametros.get("idioma") ?? undefined,
    formato: parametros.get("formato") ?? undefined,
  });

  if (!resultado.ok) {
    const estado = resultado.error === SIN_SESION ? 401 : resultado.error.startsWith("No existe") ? 404 : resultado.error.startsWith("No se pudo") ? 500 : 400;
    return new Response(resultado.error, { status: estado });
  }

  const { contenido, tipo, nombre } = resultado.datos;
  return new Response(contenido as BodyInit, {
    headers: {
      "Content-Type": tipo,
      "Content-Disposition": `attachment; filename="${nombre}"`,
      // Datos personales: ni el navegador ni un intermediario deben guardarlos.
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
