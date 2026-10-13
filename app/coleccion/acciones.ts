"use server";

import { revalidatePath } from "next/cache";
import { cambiarCantidad, eliminarDelInventario } from "@/lib/inventario";
import type { EstadoAccion } from "./tipos";

/**
 * Acciones de servidor de /coleccion.
 *
 * Una Server Action es un endpoint público: cualquiera puede invocarla con
 * datos arbitrarios, no solo la interfaz. Por eso no hacen nada propio: toda
 * la validación, la comprobación de sesión y el aislamiento por usuario viven
 * en lib/inventario.ts y en RLS. Aquí solo se leen los campos del formulario.
 */

export async function guardarCantidadAccion(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const resultado = await cambiarCantidad({
    id: Number(formData.get("id")),
    cantidad: Number(formData.get("cantidad")),
  });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath("/coleccion");
  return { error: null, exito: true };
}

export async function eliminarAccion(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const resultado = await eliminarDelInventario({ id: Number(formData.get("id")) });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath("/coleccion");
  return { error: null, exito: true };
}
