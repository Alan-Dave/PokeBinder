"use server";

import { agregarAlInventario } from "@/lib/inventario";
import type { EstadoAccion } from "@/app/coleccion/tipos";

/**
 * Agregar una carta del catálogo al inventario del usuario.
 *
 * Una Server Action es un endpoint público: la validación, la comprobación de
 * sesión y el aislamiento por usuario viven en lib/inventario.ts y en RLS.
 * Aquí solo se leen los campos del formulario.
 */
export async function agregarCartaAccion(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const resultado = await agregarAlInventario({
    cartaId: Number(formData.get("cartaId")),
    variante: formData.get("variante"),
    cantidad: Number(formData.get("cantidad")),
  });
  if (!resultado.ok) return { error: resultado.error, exito: false };
  return { error: null, exito: true };
}
