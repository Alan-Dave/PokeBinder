"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { obtenerPerfilActual, restablecerContrasena } from "@/lib/auth";
import type { EstadoFormulario } from "@/lib/estado-formulario";
import { COOKIE_RECUPERACION, permisoValido } from "@/lib/recuperacion";

/**
 * Sin el permiso firmado que deja /auth/callback, tener una sesión no basta
 * para cambiar la contraseña desde aquí: para eso está /cuenta, que pide la
 * actual. redirect queda fuera de try/catch porque lanza una excepción interna.
 */
export async function restablecerAccion(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const perfil = await obtenerPerfilActual();
  const almacen = await cookies();
  if (!perfil || !permisoValido(almacen.get(COOKIE_RECUPERACION)?.value, perfil.id)) {
    return { error: "El enlace venció. Pide uno nuevo desde «¿Olvidaste tu contraseña?»." };
  }

  const resultado = await restablecerContrasena({
    contrasena: formData.get("contrasena"),
    confirmacion: formData.get("confirmacion"),
  });
  if (!resultado.ok) return { error: resultado.error };

  // El permiso es de un solo uso.
  almacen.delete({ name: COOKIE_RECUPERACION, path: "/restablecer" });
  redirect("/");
}
