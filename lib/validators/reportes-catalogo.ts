import { z } from "zod";

/**
 * Entradas de los reportes de errores del catálogo (PBI-31).
 * Los mismos límites y listas viven en la migración (checks de la tabla): la
 * base es la última defensa, pero aquí se rechaza antes de llegar a ella.
 */

export const MOTIVOS_REPORTE = ["nombre", "imagen", "numero", "rareza", "variantes", "otro"] as const;
export type MotivoReporte = (typeof MOTIVOS_REPORTE)[number];

export const ETIQUETAS_MOTIVO: Record<MotivoReporte, string> = {
  nombre: "El nombre es incorrecto",
  imagen: "La imagen es incorrecta o no se ve",
  numero: "El número o el set son incorrectos",
  rareza: "La rareza es incorrecta",
  variantes: "Las variantes son incorrectas",
  otro: "Otro problema",
};

export const DETALLE_MIN = 10;
export const DETALLE_MAX = 500;

export const ESTADOS_REPORTE = ["abierto", "resuelto", "descartado"] as const;
export type EstadoReporte = (typeof ESTADOS_REPORTE)[number];

const id = (mensaje: string) => z.number({ error: mensaje }).int({ error: mensaje }).positive({ error: mensaje });

export const crearReporteSchema = z.object({
  cartaId: id("La carta no es válida."),
  motivo: z.enum(MOTIVOS_REPORTE, { error: "Elige un motivo de la lista." }),
  // trim antes de medir: diez espacios no cuentan como detalle.
  detalle: z
    .string({ error: "Describe el problema." })
    .trim()
    .min(DETALLE_MIN, { error: `Describe el problema con al menos ${DETALLE_MIN} caracteres.` })
    .max(DETALLE_MAX, { error: `El detalle admite hasta ${DETALLE_MAX} caracteres.` }),
});

export const listarReportesSchema = z.object({
  estado: z.enum(ESTADOS_REPORTE, { error: "El estado no es válido." }).default("abierto"),
});

// Un administrador solo cierra reportes: volver a 'abierto' no tiene sentido y
// reabriría un reporte que el usuario ya no puede repetir.
export const cambiarEstadoReporteSchema = z.object({
  id: id("El reporte no es válido."),
  estado: z.enum(["resuelto", "descartado"], { error: "El estado no es válido." }),
});
