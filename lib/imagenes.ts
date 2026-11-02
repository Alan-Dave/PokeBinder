import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { obtenerUrlsImagenesSchema } from "@/lib/validators/imagenes";

/**
 * URLs firmadas para las imágenes del catálogo.
 *
 * El bucket Images es privado (ver supabase/migrations/20260927120000), así
 * que una ruta sin firmar no sirve de nada en el navegador. La firma requiere
 * la clave secreta, por eso este módulo es server-only.
 *
 * No toda carta tiene imagen_path (~22% del catálogo la tiene, ver
 * ingesta/emparejar_imagenes.py): las que no, quedan en null y el frontend
 * decide qué mostrar en su lugar.
 */

// Suficiente para que dure más que una visita a la página, sin dejar la URL
// firmada disponible por tanto tiempo que valga la pena guardarla aparte.
const VIGENCIA_SEGUNDOS = 3 * 60 * 60;

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

export async function obtenerUrlsImagenes(
  entrada: unknown,
): Promise<Resultado<Record<number, string | null>>> {
  const validado = obtenerUrlsImagenesSchema.safeParse(entrada);
  if (!validado.success) {
    return { ok: false, error: validado.error.issues[0].message };
  }
  const { cartaIds } = validado.data;

  // Lectura pública, sin la clave secreta: el catálogo no requiere sesión.
  const supabase = await createClient();
  const { data: cartas, error: errorConsulta } = await supabase
    .from("cartas")
    .select("id, imagen_path")
    .in("id", cartaIds);

  if (errorConsulta) {
    console.error("[imagenes] Error al leer imagen_path:", errorConsulta);
    return { ok: false, error: "No se pudo obtener las imágenes." };
  }

  const resultado: Record<number, string | null> = {};
  for (const id of cartaIds) resultado[id] = null;

  const conImagen = (cartas ?? []).filter(
    (c): c is { id: number; imagen_path: string } => c.imagen_path !== null,
  );
  if (conImagen.length === 0) return { ok: true, datos: resultado };

  // Recién acá se usa la clave secreta, y solo para firmar: nunca para leer
  // datos de la tabla.
  const admin = createAdminClient();
  const { data: firmadas, error: errorFirma } = await admin.storage
    .from("Images")
    .createSignedUrls(
      conImagen.map((c) => c.imagen_path),
      VIGENCIA_SEGUNDOS,
    );

  if (errorFirma) {
    console.error("[imagenes] Error al firmar URLs:", errorFirma);
    return { ok: false, error: "No se pudo obtener las imágenes." };
  }

  firmadas.forEach((firmada, i) => {
    const carta = conImagen[i];
    if (firmada.error) {
      console.error(`[imagenes] No se pudo firmar ${carta.imagen_path}:`, firmada.error);
      return;
    }
    resultado[carta.id] = firmada.signedUrl;
  });

  return { ok: true, datos: resultado };
}
