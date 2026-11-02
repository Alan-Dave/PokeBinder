import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { avisoEstadoCuenta } from "@/lib/avisos";
import { enviarCorreo } from "@/lib/correo";
import { cambiarEstadoCuentaSchema } from "@/lib/validators/cuentas";

/**
 * Habilitar y deshabilitar cuentas (Administración).
 *
 * Dos pasos, en este orden:
 *   1. cambiar_estado_cuenta, con la sesión de quien llama. La base decide si
 *      es un administrador habilitado y aplica las reglas (ver
 *      supabase/migrations/20261103120000_cuentas_habilitadas.sql). Desde ahí
 *      RLS ya corta el acceso a la colección y los mazos.
 *   2. Supabase Auth, con la clave secreta: impide iniciar sesión y renovar
 *      el token. Nunca se llega aquí sin que el paso 1 haya autorizado.
 *
 * Si el paso 2 falla, el paso 1 se revierte: la base y Auth nunca quedan en
 * desacuerdo.
 *
 * Con los dos pasos hechos se avisa por correo al usuario. Si el correo no
 * sale, el cambio se mantiene y quien llama recibe avisoEnviado: false
 * (null: no correspondía avisar porque el estado no cambió).
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

// Supabase Auth no tiene bloqueo indefinido: ~100 años equivale a eso.
const DURACION_BLOQUEO = "876000h";

const NO_SE_PUDO = "No se pudo cambiar el estado de la cuenta. Inténtalo de nuevo.";

const MENSAJES: Record<string, string> = {
  "42501": "No tienes permiso para realizar esta acción.",
  P0002: "El usuario no existe.",
  "22023": "El motivo no es válido.",
  "23514": "El sistema debe conservar al menos un administrador habilitado.",
};

function traducirError(codigo: string | undefined, detalle: unknown): string {
  const mensaje = codigo ? MENSAJES[codigo] : undefined;
  if (mensaje) return mensaje;

  console.error("[cuentas] Error inesperado en cambiar_estado_cuenta:", detalle);
  return NO_SE_PUDO;
}

export async function cambiarEstadoCuenta(
  entrada: unknown,
): Promise<Resultado<{ avisoEnviado: boolean | null }>> {
  const validado = cambiarEstadoCuentaSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };
  const { usuarioId, habilitar, motivo } = validado.data;

  const supabase = await createClient();
  const { data: cambio, error } = await supabase.rpc("cambiar_estado_cuenta", {
    p_usuario_id: usuarioId,
    p_habilitar: habilitar,
    p_motivo: motivo,
  });
  if (error) return { ok: false, error: traducirError(error.code, error) };

  // Aunque la base ya estuviera en ese estado (cambio === false) se aplica en
  // Auth igual: así un desacuerdo anterior se repara con solo repetir la acción.
  const admin = createAdminClient();
  const { data: datosAuth, error: errorAuth } = await admin.auth.admin.updateUserById(usuarioId, {
    ban_duration: habilitar ? "none" : DURACION_BLOQUEO,
  });
  if (!errorAuth) {
    // Solo se avisa de un cambio real: repetir la acción no reenvía el correo.
    if (cambio !== true) return { ok: true, datos: { avisoEnviado: null } };
    const correo = datosAuth.user?.email;
    if (!correo) return { ok: true, datos: { avisoEnviado: false } };

    const aviso = avisoEstadoCuenta({ habilitada: habilitar, motivo });
    const avisoEnviado = await enviarCorreo({ para: correo, ...aviso });
    return { ok: true, datos: { avisoEnviado } };
  }

  // Solo el código: el mensaje de Auth puede incluir el correo del usuario.
  console.error(`[cuentas] Supabase Auth no aplicó el cambio (código: ${errorAuth.code ?? "desconocido"}).`);

  if (cambio === true) {
    const { error: errorReversion } = await supabase.rpc("cambiar_estado_cuenta", {
      p_usuario_id: usuarioId,
      p_habilitar: !habilitar,
      p_motivo: "Reversión automática: Supabase Auth no aplicó el cambio.",
    });
    if (errorReversion) {
      // La base y Auth quedaron en desacuerdo: repetir la acción lo corrige.
      console.error("[cuentas] No se pudo revertir el estado en la base:", errorReversion);
    }
  }

  return { ok: false, error: NO_SE_PUDO };
}
