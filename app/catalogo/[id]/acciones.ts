"use server";

import { revalidatePath } from "next/cache";
import { crearPropuesta } from "@/lib/propuestas";
import type { EstadoAccion } from "@/app/coleccion/tipos";

/**
 * Una Server Action es un endpoint público: cualquiera puede enviarle un
 * archivo con cualquier nombre o contenido. La validación del archivo (firma,
 * tamaño, recodificación) y de los textos vive en lib/propuestas.ts; la
 * autorización, en la base. Aquí solo se leen los campos del formulario.
 */
export async function proponerAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const cartaId = Number(formData.get("cartaId"));
  const resultado = await crearPropuesta({
    cartaId,
    descripcion: formData.get("descripcion"),
    detalles: formData.get("detalles"),
    archivo: formData.get("archivo"),
  });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath(`/catalogo/${cartaId}`);
  return { error: null, exito: true };
}
