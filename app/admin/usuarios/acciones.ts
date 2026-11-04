"use server";

import { revalidatePath } from "next/cache";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import { asignarRol } from "@/lib/roles";

/**
 * Acciones de servidor de /admin/usuarios.
 *
 * Una Server Action es un endpoint público: cualquiera puede invocarla con
 * datos arbitrarios, no solo el selector de la página. Aquí solo se leen los
 * campos; quién puede cambiar roles lo decide la función asignar_rol de la
 * base con la sesión de quien llama (regla 6).
 */

export async function cambiarRolAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const resultado = await asignarRol({
    usuarioId: formData.get("usuarioId"),
    rol: formData.get("rol"),
  });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath("/admin/usuarios");
  return { error: null, exito: true };
}
