import { z } from "zod";

// Mismos valores que el enum public.rol_usuario de la base.
export const ROLES = ["superusuario", "administrador", "usuario_normal"] as const;

export type Rol = (typeof ROLES)[number];

export const asignarRolSchema = z.object({
  usuarioId: z.uuid({ error: "El identificador de usuario no es válido." }),
  rol: z.enum(ROLES, { error: "El rol no es válido." }),
});

export type AsignarRolInput = z.infer<typeof asignarRolSchema>;
