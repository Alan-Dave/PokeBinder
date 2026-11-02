import { z } from "zod";

// La bitácora pagina de 50 en 50. Es otra paginación que el catálogo y el binder.
export const AUDITORIA_POR_PAGINA = 50;

const textoVacioAUndefined = (valor: unknown) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor);

export const listarAuditoriaSchema = z.object({
  pagina: z.preprocess(
    textoVacioAUndefined,
    z.coerce
      .number({ error: "La página debe ser un número." })
      .int({ error: "La página debe ser un número entero." })
      .min(1, { error: "La página debe ser al menos 1." })
      .max(100000, { error: "La página es demasiado grande." })
      .default(1),
  ),
  // Las acciones se escriben en minúsculas con guion bajo (cambio_rol, listar_perfiles).
  accion: z.preprocess(
    textoVacioAUndefined,
    z
      .string()
      .trim()
      .max(50, { error: "La acción es demasiado larga." })
      .regex(/^[a-z_]+$/, { error: "La acción solo admite minúsculas y guion bajo." })
      .optional(),
  ),
});

export type ListarAuditoriaInput = z.infer<typeof listarAuditoriaSchema>;
