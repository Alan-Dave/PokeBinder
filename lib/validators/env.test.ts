import { describe, expect, it } from "vitest";
import { esClaveSecreta, parsePublicEnv, parseServerEnv } from "./env";

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

describe("parseServerEnv", () => {
  it("acepta la clave secreta nueva", () => {
    const env = parseServerEnv({ SUPABASE_SECRET_KEY: "sb_secret_xyz" });
    expect(env.SUPABASE_SECRET_KEY).toBe("sb_secret_xyz");
  });

  it("acepta la clave service_role antigua en formato JWT", () => {
    const clave = jwtConRol("service_role");
    expect(() => parseServerEnv({ SUPABASE_SECRET_KEY: clave })).not.toThrow();
  });

  it("rechaza la clave publicable por error en la variable del servidor", () => {
    const env = { SUPABASE_SECRET_KEY: "sb_publishable_abc123" };
    expect(() => parseServerEnv(env)).toThrow(/no es una clave secreta/);
  });

  it("rechaza la clave anon en formato JWT", () => {
    const env = { SUPABASE_SECRET_KEY: jwtConRol("anon") };
    expect(() => parseServerEnv(env)).toThrow(/no es una clave secreta/);
  });

  it("falla si falta la variable", () => {
    expect(() => parseServerEnv({})).toThrow(/Falta SUPABASE_SECRET_KEY/);
  });
});
