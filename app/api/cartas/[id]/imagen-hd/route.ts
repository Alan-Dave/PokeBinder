import { obtenerImagenHd } from "@/lib/imagen-hd";

/**
 * GET /api/cartas/{id}/imagen-hd (PBI-x2)
 *
 * Sirve la imagen grande de una carta. No exige sesión, igual que el catálogo,
 * que es de lectura abierta. El navegador solo manda el id numérico: nunca una
 * URL. Si no hay imagen responde 404 sin cuerpo y la página usa la del bucket.
 */
export async function GET(_peticion: Request, contexto: { params: Promise<{ id: string }> }) {
  const { id } = await contexto.params;
  const imagen = await obtenerImagenHd(id);
  if (!imagen) return new Response(null, { status: 404 });

  return new Response(Buffer.from(imagen.bytes), {
    headers: {
      "content-type": "image/webp",
      // El navegador y el CDN pueden guardarla un día.
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
