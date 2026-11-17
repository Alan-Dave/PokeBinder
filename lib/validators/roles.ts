import { z } from "zod";

// Mismos valores que el enum public.rol_usuario de la base.
export const ROLES = ["superusuario", "administrador", "usuario_normal"] as const;

export type Rol = (typeof ROLES)[number];

export const asignarRolSchema = z.object({
  usuarioId: z.uuid({ error: "El identificador de usuario no es válido." }),
  rol: z.enum(ROLES, { error: "El rol no es válido." }),
});

export type AsignarRolInput = z.infer<typeof asignarRolSchema>;

// La lista de usuarios pagina de 10 en 10. Es otra paginación que el catálogo,
// el binder y la bitácora: no comparte componente con ellas.
export const USUARIOS_POR_PAGINA = 10;

export const listarPerfilesSchema = z.object({
  pagina: z.preprocess(
    (valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor),
    z.coerce
      .number({ error: "La página debe ser un número." })
      .int({ error: "La página debe ser un número entero." })
      .min(1, { error: "La página debe ser al menos 1." })
      .max(100000, { error: "La página es demasiado grande." })
      .default(1),
  ),
});
