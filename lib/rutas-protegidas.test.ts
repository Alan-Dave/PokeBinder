import { describe, expect, it } from "vitest";
import { debeRedirigirAlLogin, PREFIJOS_PROTEGIDOS, requiereSesion, tieneCookieDeSesion } from "./rutas-protegidas";

describe("requiereSesion", () => {
  it.each(PREFIJOS_PROTEGIDOS)("la zona %s y sus subrutas piden sesión", (zona) => {
    expect(requiereSesion(zona)).toBe(true);
    expect(requiereSesion(`${zona}/`)).toBe(true);
    expect(requiereSesion(`${zona}/123`)).toBe(true);
  });

  it.each(["/", "/catalogo", "/catalogo/10", "/login", "/registro", "/recuperar", "/restablecer", "/auth/callback", "/estado"])(
    "la ruta pública %s no pide sesión",
    (ruta) => {
      expect(requiereSesion(ruta)).toBe(false);
    },
  );

  it("las descargas no se redirigen: responden 401 por su cuenta", () => {
    expect(requiereSesion("/coleccion/exportar")).toBe(false);
    expect(requiereSesion("/reportes/exportar")).toBe(false);
    expect(requiereSesion("/mazos/12/proxies")).toBe(false);
  });

  it("no confunde prefijos parecidos: se compara por segmento completo", () => {
    expect(requiereSesion("/coleccionista")).toBe(false);
    expect(requiereSesion("/binders")).toBe(false);
    expect(requiereSesion("/administracion")).toBe(false);
    expect(requiereSesion("/x/coleccion")).toBe(false);
  });

  it("tolera barras repetidas", () => {
    expect(requiereSesion("//coleccion")).toBe(true);
    expect(requiereSesion("/coleccion//evolucion")).toBe(true);
  });
});

describe("tieneCookieDeSesion", () => {
  it("reconoce la cookie de sesión de Supabase, entera o partida en trozos", () => {
    expect(tieneCookieDeSesion(["sb-abc123-auth-token"])).toBe(true);
    expect(tieneCookieDeSesion(["otra", "sb-abc123-auth-token.0", "sb-abc123-auth-token.1"])).toBe(true);
  });

  it("sin esa cookie es un visitante anónimo", () => {
    expect(tieneCookieDeSesion([])).toBe(false);
    expect(tieneCookieDeSesion(["theme", "sb-abc123-code-verifier", "pb_recuperacion"])).toBe(false);
  });
});

describe("debeRedirigirAlLogin", () => {
  const sinSesion: string[] = [];
  const conSesion = ["sb-abc-auth-token"];

  it("manda al login al anónimo que pide una página protegida", () => {
    expect(debeRedirigirAlLogin("GET", "/coleccion", sinSesion)).toBe(true);
    expect(debeRedirigirAlLogin("GET", "/admin/usuarios", sinSesion)).toBe(true);
  });

  it("no toca a quien tiene cookie de sesión, aunque esté caducada: la página decide", () => {
    expect(debeRedirigirAlLogin("GET", "/coleccion", conSesion)).toBe(false);
  });

  it("no toca las acciones (POST) ni otros métodos", () => {
    for (const metodo of ["POST", "PUT", "DELETE", "HEAD"]) {
      expect(debeRedirigirAlLogin(metodo, "/coleccion", sinSesion)).toBe(false);
    }
  });

  it("no toca las páginas públicas ni las descargas", () => {
    expect(debeRedirigirAlLogin("GET", "/catalogo", sinSesion)).toBe(false);
    expect(debeRedirigirAlLogin("GET", "/login", sinSesion)).toBe(false);
    expect(debeRedirigirAlLogin("GET", "/reportes/exportar", sinSesion)).toBe(false);
  });
});
