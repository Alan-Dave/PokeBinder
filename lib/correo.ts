import "server-only";

import { parseCorreoEnv } from "@/lib/validators/env";

/**
 * Envío de correo con la API de MailerSend.
 *
 * https://developers.mailersend.com/api/v1/email
 *
 * Nunca lanza: un correo que no sale no debe romper la acción que lo pidió
 * (por ejemplo, deshabilitar una cuenta). Devuelve si se envió y quien llama
 * decide qué mostrar. El log lleva solo el estado HTTP, nunca la dirección ni
 * el contenido del correo.
 */

export type Correo = { para: string; asunto: string; texto: string; html: string };

const URL_MAILERSEND = "https://api.mailersend.com/v1/email";
const TIEMPO_MAXIMO_MS = 10_000;

export async function enviarCorreo(correo: Correo): Promise<boolean> {
  const config = parseCorreoEnv(process.env);
  if (!config) {
    console.error("[correo] Envío desactivado: faltan MAILERSEND_API_KEY y CORREO_REMITENTE.");
    return false;
  }

  try {
    const respuesta = await fetch(URL_MAILERSEND, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.MAILERSEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { email: config.CORREO_REMITENTE, name: "PokeBinder" },
        to: [{ email: correo.para }],
        subject: correo.asunto,
        text: correo.texto,
        html: correo.html,
      }),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });

    // MailerSend acepta el envío con 202 y lo procesa en segundo plano.
    if (respuesta.status === 202) return true;

    console.error(`[correo] MailerSend rechazó el envío (HTTP ${respuesta.status}).`);
    return false;
  } catch (error) {
    // TimeoutError, sin red, DNS...: solo el nombre, sin el detalle.
    console.error(`[correo] No se pudo contactar a MailerSend (${(error as Error).name}).`);
    return false;
  }
}

// El texto que escribe un usuario o un administrador (motivo, nombre) entra
// en el HTML del correo. Sin escapar, alguien podría meter enlaces o etiquetas
// en un correo que sale firmado por el sitio.
export function escaparHtml(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
