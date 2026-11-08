import type { Rol } from "@/lib/validators/roles";

export type EnlaceNavegacion = { href: string; texto: string };

const PUBLICOS: EnlaceNavegacion[] = [{ href: "/catalogo", texto: "Catálogo" }];

const DE_USUARIO: EnlaceNavegacion[] = [
  { href: "/coleccion", texto: "Mi colección" },
  { href: "/binder", texto: "Mis binders" },
  { href: "/mazos", texto: "Mis mazos" },
  { href: "/dashboard", texto: "Dashboard" },
  { href: "/reportes", texto: "Reportes" },
];

const DE_SUPERUSUARIO: EnlaceNavegacion[] = [
  { href: "/admin/usuarios", texto: "Usuarios y roles" },
  { href: "/admin/auditoria", texto: "Auditoría" },
];

/**
 * Enlaces que muestra la barra de navegación según la sesión.
 *
 * Esto es comodidad visual: ocultar un enlace no es control de acceso (regla 6).
 * Cada ruta de administración vuelve a verificar el rol en el servidor.
 */
export function enlacesDeNavegacion(sesionIniciada: boolean, rol: Rol | null): EnlaceNavegacion[] {
  if (!sesionIniciada) return PUBLICOS;
  return [...PUBLICOS, ...DE_USUARIO, ...(rol === "superusuario" ? DE_SUPERUSUARIO : [])];
}
