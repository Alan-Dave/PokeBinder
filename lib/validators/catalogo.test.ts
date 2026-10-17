import { describe, expect, it } from "vitest";
import { buscarCatalogoSchema, idDesdeRuta, patronPrefijo } from "./catalogo";

describe("buscarCatalogoSchema", () => {
  it("acepta una búsqueda vacía y usa la página 1", () => {
    expect(buscarCatalogoSchema.parse({})).toEqual({ pagina: 1 });
  });

  it("trata los campos vacíos del formulario como sin filtro", () => {
    const r = buscarCatalogoSchema.parse({ texto: "", idioma: "", tipo: "", rareza: "" });
    expect(r).toEqual({ pagina: 1 });
  });

  it("acepta todos los filtros y recorta los espacios del texto", () => {
    const r = buscarCatalogoSchema.parse({
      texto: "  pika ",
      idioma: "es",
      tipo: "Lightning",
      rareza: "Rare Holo",
      pagina: 3,
    });
    expect(r).toEqual({ texto: "pika", idioma: "es", tipo: "Lightning", rareza: "Rare Holo", pagina: 3 });
  });

  it.each(["en", "es", "fr", "pt", "ja", "zh"])("acepta el idioma %s", (idioma) => {
    expect(buscarCatalogoSchema.safeParse({ idioma }).success).toBe(true);
  });

  it("rechaza un idioma que no existe", () => {
    expect(buscarCatalogoSchema.safeParse({ idioma: "de" }).success).toBe(false);
    expect(buscarCatalogoSchema.safeParse({ idioma: "EN" }).success).toBe(false);
  });

  it("rechaza un texto demasiado largo", () => {
    expect(buscarCatalogoSchema.safeParse({ texto: "a".repeat(51) }).success).toBe(false);
  });

  it("rechaza valores que no son texto", () => {
    expect(buscarCatalogoSchema.safeParse({ texto: 5 }).success).toBe(false);
    expect(buscarCatalogoSchema.safeParse({ tipo: { $ne: "" } }).success).toBe(false);
  });

  it("rechaza páginas menores a 1, no enteras o que no son número", () => {
    expect(buscarCatalogoSchema.safeParse({ pagina: 0 }).success).toBe(false);
    expect(buscarCatalogoSchema.safeParse({ pagina: 1.5 }).success).toBe(false);
    expect(buscarCatalogoSchema.safeParse({ pagina: Number.NaN }).success).toBe(false);
    expect(buscarCatalogoSchema.safeParse({ pagina: "2" }).success).toBe(false);
  });

  it("descarta campos que no existen", () => {
    const r = buscarCatalogoSchema.parse({ texto: "a", orden: "price desc" });
    expect(r).not.toHaveProperty("orden");
  });
});

describe("patronPrefijo", () => {
  it("pasa a minúsculas y agrega el comodín final", () => {
    expect(patronPrefijo("Pika")).toBe("pika%");
  });

  it("recorta los espacios de los extremos", () => {
    expect(patronPrefijo("  Pika ")).toBe("pika%");
  });

  it("conserva los espacios internos", () => {
    expect(patronPrefijo("Mr. Mime")).toBe("mr. mime%");
  });

  it("escapa los comodines de LIKE para que cuenten como letras", () => {
    expect(patronPrefijo("50%")).toBe("50\\%%");
    expect(patronPrefijo("a_b")).toBe("a\\_b%");
  });

  it("escapa la barra invertida", () => {
    expect(patronPrefijo("a\\b")).toBe("a\\\\b%");
  });

  it("elimina el asterisco, que PostgREST convierte en comodín", () => {
    expect(patronPrefijo("pi*ka")).toBe("pika%");
  });

  it("una entrada con forma de inyección queda como texto literal", () => {
    expect(patronPrefijo("x' OR 1=1 --")).toBe("x' or 1=1 --%");
  });
});

describe("idDesdeRuta", () => {
  it.each([
    ["1", 1],
    ["42", 42],
    ["123456789012345", 123456789012345],
  ])("convierte %j en %d", (texto, esperado) => {
    expect(idDesdeRuta(texto)).toBe(esperado);
  });

  it.each(["", "0", "01", "-1", "1.5", "1e3", "0x10", " 12", "12 ", "abc", "1 OR 1=1", "1234567890123456"])(
    "rechaza %j",
    (texto) => {
      expect(idDesdeRuta(texto)).toBeNull();
    },
  );
});
