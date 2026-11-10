"use server";

import { cambiarContrasena } from "@/lib/auth";
import type { EstadoFormulario } from "@/lib/estado-formulario";

export async function cambiarContrasenaAccion(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const resultado = await cambiarContrasena({
    contrasenaActual: formData.get("contrasenaActual"),
    contrasena: formData.get("contrasena"),
    confirmacion: formData.get("confirmacion"),
  });
  if (!resultado.ok) return { error: resultado.error };
  return { error: null, aviso: "Contraseña actualizada. Las demás sesiones se cerraron." };
}
