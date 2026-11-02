"use server";

import { revalidatePath } from "next/cache";
import { cambiarEstadoCuenta } from "@/lib/cuentas";
import type { EstadoCuenta } from "./tipos";

/**
 * Una Server Action es un endpoint público: cualquiera con sesión puede
 * invocarla con datos arbitrarios. La validación vive en lib/cuentas.ts y la
 * autorización en la base (cambiar_estado_cuenta). Aquí solo se leen los
 * campos del formulario.
 */
export async function cambiarEstadoCuentaAccion(
  _previo: EstadoCuenta,
  formData: FormData,
): Promise<EstadoCuenta> {
  const habilitar = formData.get("habilitar");
  const resultado = await cambiarEstadoCuenta({
    usuarioId: formData.get("usuarioId"),
    // Solo "true" o "false"; cualquier otra cosa llega como texto y zod la rechaza.
    habilitar: habilitar === "true" ? true : habilitar === "false" ? false : habilitar,
    motivo: formData.get("motivo"),
  });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath("/admin/cuentas");
  return { error: null, exito: true };
}
