import type { Rol } from "@/lib/validators/roles";

// Los dos perfiles (ver supabase/migrations/20261110120000_dos_perfiles.sql).
export const ETIQUETAS_ROL: Record<Rol, string> = {
  administrador: "Administración",
  usuario: "Usuario",
};
