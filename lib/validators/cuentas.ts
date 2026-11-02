import { z } from "zod";

// Mismo rango que el check de perfiles.motivo_deshabilitacion y que
// cambiar_estado_cuenta.
export const MOTIVO_MIN = 5;
export const MOTIVO_MAX = 300;

export const cambiarEstadoCuentaSchema = z.object({
  usuarioId: z.uuid({ error: "El identificador de usuario no es válido." }),
  habilitar: z.boolean({ error: "La acción no es válida." }),
  motivo: z
    .string({ error: "El motivo debe ser texto." })
    .trim()
    .min(MOTIVO_MIN, { error: `El motivo debe tener al menos ${MOTIVO_MIN} caracteres.` })
    .max(MOTIVO_MAX, { error: `El motivo no puede superar ${MOTIVO_MAX} caracteres.` }),
});

export type CambiarEstadoCuentaInput = z.infer<typeof cambiarEstadoCuentaSchema>;
