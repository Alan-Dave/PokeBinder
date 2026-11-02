import { z } from "zod";

// Mismos rangos que los check de propuestas_carta y cartas_detalle.
export const DESCRIPCION_MAX = 1000;
export const DETALLES_MAX = 2000;
export const MOTIVO_RECHAZO_MIN = 5;
export const MOTIVO_RECHAZO_MAX = 300;

// Tamaño del archivo que sube el usuario, antes de recodificarlo. El límite de
// las Server Actions (next.config.ts) queda un poco por encima para el resto
// del formulario.
export const IMAGEN_MAX_BYTES = 2 * 1024 * 1024;

const idPositivo = (mensaje: string) => z.number({ error: mensaje }).int({ error: mensaje }).positive({ error: mensaje });

export const crearPropuestaSchema = z.object({
  cartaId: idPositivo("El identificador de la carta no es válido."),
  descripcion: z
    .string({ error: "La descripción debe ser texto." })
    .trim()
    .min(1, { error: "Escribe una descripción." })
    .max(DESCRIPCION_MAX, { error: `La descripción no puede superar ${DESCRIPCION_MAX} caracteres.` }),
  detalles: z
    .string({ error: "Los detalles deben ser texto." })
    .trim()
    .min(1, { error: "Escribe los detalles." })
    .max(DETALLES_MAX, { error: `Los detalles no pueden superar ${DETALLES_MAX} caracteres.` }),
  archivo: z
    .instanceof(File, { error: "Adjunta una imagen." })
    .refine((archivo) => archivo.size > 0, { error: "Adjunta una imagen." })
    .refine((archivo) => archivo.size <= IMAGEN_MAX_BYTES, { error: "La imagen no puede superar 2 MB." }),
});

export const aprobarPropuestaSchema = z.object({
  propuestaId: idPositivo("La propuesta no es válida."),
});

export const rechazarPropuestaSchema = z.object({
  propuestaId: idPositivo("La propuesta no es válida."),
  motivo: z
    .string({ error: "El motivo debe ser texto." })
    .trim()
    .min(MOTIVO_RECHAZO_MIN, { error: `El motivo debe tener al menos ${MOTIVO_RECHAZO_MIN} caracteres.` })
    .max(MOTIVO_RECHAZO_MAX, { error: `El motivo no puede superar ${MOTIVO_RECHAZO_MAX} caracteres.` }),
});
