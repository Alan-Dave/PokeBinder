"use server";

import { redirect } from "next/navigation";
import { registrar } from "@/lib/auth";
import type { EstadoFormulario } from "@/lib/estado-formulario";

/**
 * Una Server Action es un endpoint público: la validación y el registro viven
 * en lib/auth.ts. Aquí solo se leen los campos del formulario. Nunca se lee un
 * rol: el trigger de la base crea todo perfil como usuario_normal.
 */
export async function registrarAccion(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const resultado = await registrar({
    correo: formData.get("correo"),
    contrasena: formData.get("contrasena"),
    nombreVisible: formData.get("nombreVisible"),
  });
  if (!resultado.ok) return { error: resultado.error };

  // Sin sesión = el proyecto exige confirmar el correo antes de entrar.
  if (!resultado.datos.conSesion) {
    return { error: null, aviso: "Cuenta creada. Revisa tu correo para confirmarla antes de iniciar sesión." };
  }
  redirect("/");
}
