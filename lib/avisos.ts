import { escaparHtml } from "@/lib/correo";

/**
 * Plantillas de los avisos por correo. Texto fijo por evento: lo único que
 * viene de afuera es el motivo, y entra escapado al HTML.
 */

type Aviso = { asunto: string; texto: string; html: string };

export function avisoEstadoCuenta({ habilitada, motivo }: { habilitada: boolean; motivo: string }): Aviso {
  const asunto = habilitada
    ? "Tu cuenta de PokeBinder fue habilitada"
    : "Tu cuenta de PokeBinder fue deshabilitada";
  const cuerpo = habilitada
    ? "Un administrador habilitó tu cuenta. Ya puedes iniciar sesión de nuevo."
    : "Un administrador deshabilitó tu cuenta. Mientras siga así no podrás iniciar sesión.";

  return {
    asunto,
    texto: `${cuerpo}\n\nMotivo: ${motivo}\n\nEste es un mensaje automático de PokeBinder.`,
    html:
      `<p>${cuerpo}</p>` +
      `<p><strong>Motivo:</strong> ${escaparHtml(motivo)}</p>` +
      `<p>Este es un mensaje automático de PokeBinder.</p>`,
  };
}

export function avisoPropuesta({ aprobada, motivo }: { aprobada: boolean; motivo: string | null }): Aviso {
  const asunto = aprobada ? "Tu propuesta para el catálogo fue aprobada" : "Tu propuesta para el catálogo fue rechazada";
  const cuerpo = aprobada
    ? "Un administrador aprobó tu propuesta de imagen, descripción y detalles. Ya aparece en el catálogo."
    : "Un administrador revisó tu propuesta de imagen, descripción y detalles y no la publicó.";
  const conMotivo = !aprobada && motivo;

  return {
    asunto,
    texto: `${cuerpo}${conMotivo ? `\n\nMotivo: ${motivo}` : ""}\n\nEste es un mensaje automático de PokeBinder.`,
    html:
      `<p>${cuerpo}</p>` +
      (conMotivo ? `<p><strong>Motivo:</strong> ${escaparHtml(motivo)}</p>` : "") +
      `<p>Este es un mensaje automático de PokeBinder.</p>`,
  };
}
