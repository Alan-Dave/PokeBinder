"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import { cambiarEstadoReporte, crearReporte } from "@/lib/reportes";

/**
 * Una Server Action es un endpoint público: la validación, la sesión y los
 * permisos viven en lib/reportes.ts y en RLS. Aquí solo se leen los campos.
 */

export async function reportarErrorAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const resultado = await crearReporte({
    cartaId: Number(formData.get("cartaId")),
    motivo: formData.get("motivo"),
    detalle: formData.get("detalle"),
  });
  if (!resultado.ok) return { error: resultado.error, exito: false };
  return { error: null, exito: true };
}

export async function cambiarEstadoReporteAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const resultado = await cambiarEstadoReporte({
    id: Number(formData.get("id")),
    estado: formData.get("estado"),
  });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath("/admin/reportes");
  return { error: null, exito: true };
}
