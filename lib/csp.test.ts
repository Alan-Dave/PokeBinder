import { describe, expect, it } from "vitest";
import { construirCsp, nonceDesdeBytes, origenSupabase } from "./csp";

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

describe("construirCsp con nonce (F3)", () => {
  const nonce = "AAAAAAAAAAAAAAAAAAAAAA==";
  const csp = construirCsp({ supabaseUrl: "https://abc.supabase.co", nonce });

  it("admite solo los scripts con el nonce y los que ellos carguen, sin unsafe-inline", () => {
    expect(directiva(csp, "script-src")).toEqual(["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"]);
    expect(directiva(csp, "script-src")).not.toContain("'unsafe-inline'");
  });

  it("sin nonce conserva el comportamiento anterior (unsafe-inline)", () => {
    expect(directiva(construirCsp(), "script-src")).toContain("'unsafe-inline'");
  });

  it("el resto de directivas no cambia con el nonce", () => {
    for (const nombre of ["default-src", "img-src", "frame-ancestors", "object-src", "form-action", "base-uri", "connect-src"]) {
      expect(directiva(csp, nombre)).toEqual(directiva(construirCsp({ supabaseUrl: "https://abc.supabase.co" }), nombre));
    }
  });

  it("en desarrollo mantiene eval además del nonce", () => {
    const dev = construirCsp({ nonce, desarrollo: true });

    expect(directiva(dev, "script-src")).toEqual(["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", "'unsafe-eval'"]);
  });

  it.each([
    ["con comillas", "abc'; script-src *; x='"],
    ["con espacios", "AAAA AAAA AAAA AAAA"],
    ["con punto y coma", "AAAAAAAAAAAAAAAA;"],
    ["demasiado corto", "abc"],
    ["vacío", ""],
  ])("rechaza un nonce %s antes de que llegue a la cabecera", (_, malo) => {
    expect(() => construirCsp({ nonce: malo })).toThrow("El nonce de la CSP no es válido.");
  });
});

describe("nonceDesdeBytes", () => {
  it("codifica los bytes en base64 y el resultado es un nonce válido", () => {
    const bytes = Uint8Array.from({ length: 16 }, (_, i) => i * 15);

    const nonce = nonceDesdeBytes(bytes);

    expect(nonce).toBe(btoa(String.fromCharCode(...bytes)));
    expect(() => construirCsp({ nonce })).not.toThrow();
  });

  it("bytes distintos dan nonces distintos", () => {
    expect(nonceDesdeBytes(new Uint8Array(16).fill(1))).not.toBe(nonceDesdeBytes(new Uint8Array(16).fill(2)));
  });
});
