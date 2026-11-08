import { obtenerImagenHd } from "@/lib/imagen-hd";
import { claveDeCliente, crearLimitador } from "@/lib/limite-peticiones";
import { tamanoImagenSchema } from "@/lib/validators/imagen-hd";

// Una página del catálogo pide hasta 30 miniaturas de golpe; el límite deja
// pasar varias páginas por minuto y corta a quien intente recorrer el catálogo.
const limitador = crearLimitador({ maximo: 240, ventanaMs: 60_000 });

/**
 * GET /api/cartas/{id}/imagen-hd[?tam=min] (PBI-x2)
 *
 * Sirve la imagen de una carta: la grande por defecto, la miniatura con
 * tam=min (la usa el catálogo cuando la carta no tiene imagen en el bucket).
 * No exige sesión, igual que el catálogo, que es de lectura abierta. El
 * navegador solo manda el id numérico y el tamaño: nunca una URL. Si no hay
 * imagen responde 404 sin cuerpo y la página usa la del bucket.
 */
export async function GET(peticion: Request, contexto: { params: Promise<{ id: string }> }) {
  const cliente = claveDeCliente(peticion.headers);
  if (!limitador.permitir(cliente)) {
    return new Response(null, {
      status: 429,
      headers: {
        "retry-after": String(limitador.segundosParaReintentar(cliente)),
      },
    });
  }

  const tamano = tamanoImagenSchema.safeParse(new URL(peticion.url).searchParams.get("tam") ?? undefined);
  if (!tamano.success) return new Response(null, { status: 400 });

  const { id } = await contexto.params;
  const imagen = await obtenerImagenHd(id, tamano.data);
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
