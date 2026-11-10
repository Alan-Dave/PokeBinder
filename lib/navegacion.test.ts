import { describe, expect, it } from "vitest";
import { enlacesDeNavegacion } from "./navegacion";

const hrefs = (enlaces: { href: string }[]) => enlaces.map((e) => e.href);

describe("enlacesDeNavegacion", () => {
  it("sin sesión solo ofrece el catálogo", () => {
    expect(hrefs(enlacesDeNavegacion(false, null))).toEqual(["/catalogo"]);
  });

  it("un usuario ve sus pantallas, pero no la administración", () => {
    const rutas = hrefs(enlacesDeNavegacion(true, "usuario"));
    expect(rutas).toEqual(["/catalogo", "/coleccion", "/binder", "/mazos", "/dashboard", "/reportes"]);
  });

  it("Administración ve usuarios y auditoría", () => {
    const rutas = hrefs(enlacesDeNavegacion(true, "administrador"));
    expect(rutas).toContain("/admin/usuarios");
    expect(rutas).toContain("/admin/cuentas");
    expect(rutas).toContain("/admin/propuestas");
    expect(rutas).toContain("/admin/auditoria");
  });

  it("con sesión pero sin rol cargado no muestra administración", () => {
    expect(hrefs(enlacesDeNavegacion(true, null))).not.toContain("/admin/auditoria");
  });
});
