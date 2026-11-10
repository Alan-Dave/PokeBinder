"use server";

import { headers } from "next/headers";
import { solicitarRecuperacion } from "@/lib/auth";
import type { EstadoFormulario } from "@/lib/estado-formulario";

// El mismo mensaje exista o no la cuenta (ver solicitarRecuperacion).
const AVISO_RECUPERACION =
  "Si el correo está registrado, te enviamos un enlace para elegir una contraseña nueva. Revisa también la carpeta de spam.";

/**
 * Una Server Action es un endpoint público: la validación vive en lib/auth.ts.
 * El origen sale de la cabecera Origin, que Next.js ya contrastó con el host
 * para frenar peticiones de otros sitios.
 */
export async function recuperarAccion(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const origen = (await headers()).get("origin");
  const resultado = await solicitarRecuperacion({ correo: formData.get("correo") }, origen);
  if (!resultado.ok) return { error: resultado.error };
  return { error: null, aviso: AVISO_RECUPERACION };
}
