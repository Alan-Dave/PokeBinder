import { describe, expect, it } from "vitest";
import { esClaveSecreta, parsePublicEnv } from "./env";

// Construye un JWT sin firma válida: solo interesa el payload.
function jwtConRol(role: string): string {
  const codificar = (objeto: object) => Buffer.from(JSON.stringify(objeto)).toString("base64url");
  return `${codificar({ alg: "HS256", typ: "JWT" })}.${codificar({ role })}.firma`;
}

const envValido = {
  NEXT_PUBLIC_SUPABASE_URL: "https://proyecto.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abc123",
};

describe("parsePublicEnv", () => {
  it("acepta una configuración válida", () => {
    expect(parsePublicEnv(envValido)).toEqual(envValido);
  });

  it("acepta la clave anon antigua en formato JWT", () => {
    const env = { ...envValido, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwtConRol("anon") };
    expect(() => parsePublicEnv(env)).not.toThrow();
  });

  it("falla si falta la URL", () => {
    const env = { ...envValido, NEXT_PUBLIC_SUPABASE_URL: undefined };
    expect(() => parsePublicEnv(env)).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("falla si la URL no usa https", () => {
    const env = { ...envValido, NEXT_PUBLIC_SUPABASE_URL: "http://proyecto.supabase.co" };
    expect(() => parsePublicEnv(env)).toThrow(/https/);
  });

  it("falla si falta la clave publicable", () => {
    const env = { ...envValido, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined };
    expect(() => parsePublicEnv(env)).toThrow(/PUBLISHABLE_KEY/);
  });

  it("rechaza una clave secreta nueva en la variable pública", () => {
    const env = { ...envValido, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_xyz" };
    expect(() => parsePublicEnv(env)).toThrow(/clave secreta/);
  });

  it("rechaza una clave service_role antigua en la variable pública", () => {
    const env = { ...envValido, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwtConRol("service_role") };
    expect(() => parsePublicEnv(env)).toThrow(/clave secreta/);
  });
});

describe("esClaveSecreta", () => {
  it("no confunde texto con puntos con un JWT", () => {
    expect(esClaveSecreta("a.b.c")).toBe(false);
  });
});
