import { exportarInventario, SIN_SESION } from "@/lib/exportar";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

// Solo lectura: exporta el inventario del usuario con sesión. El único
// parámetro es el formato, que valida lib/exportar.ts.
export async function GET(solicitud: Request) {
  const formato = new URL(solicitud.url).searchParams.get("formato") ?? undefined;
  const resultado = await exportarInventario({ formato });

  if (!resultado.ok) {
    const estado = resultado.error === SIN_SESION ? 401 : resultado.error.startsWith("El formato") ? 400 : 500;
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
