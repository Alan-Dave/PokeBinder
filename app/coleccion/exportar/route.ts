import { exportarInventario, SIN_SESION } from "@/lib/exportar";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

// Solo lectura: exporta el inventario del usuario con sesión. Los parámetros
// (formato y filtros opcionales) los valida lib/exportar.ts antes de consultar.
export async function GET(solicitud: Request) {
  const parametros = new URL(solicitud.url).searchParams;
  const resultado = await exportarInventario({
    formato: parametros.get("formato") ?? undefined,
    idioma: parametros.get("idioma") ?? undefined,
    setId: parametros.get("setId") ?? undefined,
    rareza: parametros.get("rareza") ?? undefined,
  });

  if (!resultado.ok) {
    const estado = resultado.error === SIN_SESION ? 401 : resultado.error.startsWith("No se pudo") ? 500 : 400;
    return new Response(resultado.error, { status: estado });
  }

  const { contenido, tipo, nombre } = resultado.archivo;
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
