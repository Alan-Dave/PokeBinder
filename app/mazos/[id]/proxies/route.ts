import { generarProxiesMazo } from "@/lib/proxies-pdf";
import { SIN_SESION } from "@/lib/mazos";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";
// Bajar las imágenes y armar el PDF puede tardar con un mazo de 60 cartas.
export const maxDuration = 60;

// La ruta llega como texto: solo dígitos, de 1 a 15, sin ceros a la izquierda.
function entero(texto: string): number {
  return /^[1-9]\d{0,14}$/.test(texto) ? Number(texto) : Number.NaN;
}

// Solo lectura: el PDF se genera aquí, en el servidor, con medidas fijas.
export async function GET(_solicitud: Request, contexto: { params: Promise<{ id: string }> }) {
  const { id } = await contexto.params;
  const resultado = await generarProxiesMazo({ mazoId: entero(id) });

  if (!resultado.ok) {
    const estado = resultado.error === SIN_SESION ? 401 : resultado.error.startsWith("No se pudo") ? 500 : 400;
    return new Response(resultado.error, { status: estado });
  }

  const { pdf, nombre } = resultado.datos;
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      // El mazo es personal: ni el navegador ni un intermediario deben guardarlo.
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
