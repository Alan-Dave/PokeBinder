"use server";

import { redirect } from "next/navigation";
import { iniciarSesion } from "@/lib/auth";
import type { EstadoFormulario } from "@/lib/estado-formulario";

/**
 * Una Server Action es un endpoint público: la validación y el inicio de
 * sesión viven en lib/auth.ts. Aquí solo se leen los campos del formulario.
 *
 * redirect lanza una excepción interna de Next.js: debe quedar fuera de
 * cualquier try/catch.
 */
export async function iniciarSesionAccion(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const resultado = await iniciarSesion({
    correo: formData.get("correo"),
    contrasena: formData.get("contrasena"),
  });
  if (!resultado.ok) return { error: resultado.error };

  redirect("/");
}
