import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { CARPETA_CACHE, idiomasAProbar, rutaCache } from "./imagen-hd";

describe("idiomasAProbar", () => {
  it("prueba el idioma de la carta y después el inglés", () => {
    expect(idiomasAProbar("es")).toEqual(["es", "en"]);
    expect(idiomasAProbar("ja")).toEqual(["ja", "en"]);
  });

  it("no repite el inglés y manda el chino directo a inglés", () => {
    expect(idiomasAProbar("en")).toEqual(["en"]);
    expect(idiomasAProbar("zh")).toEqual(["en"]);
  });
});

describe("rutaCache", () => {
  it("queda siempre dentro de la carpeta de caché, con nombre hexadecimal", () => {
    const ruta = rutaCache("en", "base1-4");
    expect(path.dirname(ruta)).toBe(CARPETA_CACHE);
    expect(path.basename(ruta)).toMatch(/^[0-9a-f]{64}\.webp$/);
  });

  it("no se sale de la carpeta aunque el id traiga rutas", () => {
    const ruta = rutaCache("en", "../../etc/passwd");
    expect(path.dirname(ruta)).toBe(CARPETA_CACHE);
  });

  it("distingue idiomas y cartas", () => {
    expect(rutaCache("en", "base1-4")).not.toBe(rutaCache("fr", "base1-4"));
    expect(rutaCache("en", "base1-4")).not.toBe(rutaCache("en", "base1-5"));
  });
});
