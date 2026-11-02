"use server";

import { revalidatePath } from "next/cache";
import { aprobarPropuesta, rechazarPropuesta } from "@/lib/propuestas";
import type { EstadoAccion } from "@/app/coleccion/tipos";

/**
 * Una Server Action es un endpoint público: cualquiera con sesión puede
 * invocarla. La validación vive en lib/propuestas.ts y la autorización en la
 * base (solo un administrador habilitado revisa). Aquí solo se leen los campos.
 */

export async function aprobarAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const resultado = await aprobarPropuesta({ propuestaId: Number(formData.get("propuestaId")) });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath("/admin/propuestas");
  return { error: null, exito: true };
}

export async function rechazarAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const resultado = await rechazarPropuesta({
    propuestaId: Number(formData.get("propuestaId")),
    motivo: formData.get("motivo"),
  });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath("/admin/propuestas");
  return { error: null, exito: true };
}
