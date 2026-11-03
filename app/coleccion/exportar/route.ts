import { exportarInventarioCsv, SIN_SESION } from "@/lib/exportar";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

// Solo lectura y sin parámetros: exporta el inventario del usuario con sesión.
export async function GET() {
  const resultado = await exportarInventarioCsv();

  if (!resultado.ok) {
    const estado = resultado.error === SIN_SESION ? 401 : 500;
    return new Response(resultado.error, { status: estado });
  }

  return new Response(resultado.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="inventario.csv"',
      // Datos personales: ni el navegador ni un intermediario deben guardarlos.
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
