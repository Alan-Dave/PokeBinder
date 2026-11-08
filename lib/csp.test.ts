import { describe, expect, it } from "vitest";
import { construirCsp, origenSupabase } from "./csp";

const directiva = (csp: string, nombre: string) =>
  csp
    .split("; ")
    .find((d) => d.startsWith(`${nombre} `))
    ?.split(" ")
    .slice(1);

describe("origenSupabase", () => {
  it("usa solo el origen de la URL del proyecto", () => {
    expect(origenSupabase("https://abc.supabase.co/rest/v1?x=1")).toBe("https://abc.supabase.co");
  });

  it.each([
    ["no está definida", undefined],
    ["está vacía", ""],
    ["no es una URL", "esto no es una url"],
    ["usa otro esquema", "javascript:alert(1)"],
    ["usa data:", "data:text/html,x"],
  ])("cae al comodín de Supabase si la URL %s", (_, entrada) => {
    expect(origenSupabase(entrada)).toBe("https://*.supabase.co");
  });

  it("acepta http en local", () => {
    expect(origenSupabase("http://127.0.0.1:54321")).toBe("http://127.0.0.1:54321");
  });
});

describe("construirCsp", () => {
  const prod = construirCsp({ supabaseUrl: "https://abc.supabase.co" });

  it("por defecto solo admite el propio sitio", () => {
    expect(directiva(prod, "default-src")).toEqual(["'self'"]);
  });

  it("admite las imágenes del propio sitio y de Supabase, y nada más", () => {
    expect(directiva(prod, "img-src")).toEqual(["'self'", "data:", "blob:", "https://abc.supabase.co"]);
  });

  it("impide incrustar la aplicación, plugins y formularios hacia fuera", () => {
    expect(directiva(prod, "frame-ancestors")).toEqual(["'none'"]);
    expect(directiva(prod, "object-src")).toEqual(["'none'"]);
    expect(directiva(prod, "form-action")).toEqual(["'self'"]);
    expect(directiva(prod, "base-uri")).toEqual(["'self'"]);
  });

  it("en producción no permite eval ni conexiones a otros orígenes", () => {
    expect(directiva(prod, "script-src")).not.toContain("'unsafe-eval'");
    expect(directiva(prod, "connect-src")).toEqual(["'self'"]);
  });

  it("en desarrollo permite eval y websockets para la recarga en caliente", () => {
    const dev = construirCsp({ supabaseUrl: "https://abc.supabase.co", desarrollo: true });

    expect(directiva(dev, "script-src")).toContain("'unsafe-eval'");
    expect(directiva(dev, "connect-src")).toEqual(expect.arrayContaining(["ws:", "wss:"]));
  });

  it("funciona sin opciones y no deja directivas vacías ni dobles espacios", () => {
    const csp = construirCsp();

    expect(directiva(csp, "img-src")).toContain("https://*.supabase.co");
    expect(csp).not.toMatch(/;;|  |; $/);
  });
});
