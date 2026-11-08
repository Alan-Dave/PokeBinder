import type { Rol } from "@/lib/validators/roles";

// Nombres de RT-02 (Superusuario · Administrador · Usuario Normal).
export const ETIQUETAS_ROL: Record<Rol, string> = {
  superusuario: "Superusuario",
  administrador: "Administrador",
  usuario_normal: "Usuario Normal",
};
