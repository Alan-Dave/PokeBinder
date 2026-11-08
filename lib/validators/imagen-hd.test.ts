import { describe, expect, it } from "vitest";
import { esIdiomaTcgdex, idApiSchema, idCartaImagenSchema, tamanoImagenSchema } from "./imagen-hd";

describe("idCartaImagenSchema", () => {
  it("acepta un id numérico y lo convierte", () => {
    expect(idCartaImagenSchema.parse("123")).toBe(123);
  });

  it.each(["", "0", "012", "1e3", "0x10", "-1", "1.5", " 1", "1234567890123456", "abc", "1/2"])(
    "rechaza %j",
    (valor) => {
      expect(idCartaImagenSchema.safeParse(valor).success).toBe(false);
    },
  );
});

describe("idApiSchema", () => {
  it.each(["base1-4", "swsh3-136", "sv3pt5-1", "xy0-1", "swsh12.5-TG05"])("acepta %s", (id) => {
    expect(idApiSchema.safeParse(id).success).toBe(true);
  });

  it.each([
    "",
    "base1",
    "../etc-passwd",
    "base1-4/../../x",
    "base1-4?x=1",
    "base1-4#a",
    "base1-4%2f",
    "base1--4",
    "a b-1",
    "x".repeat(51) + "-1",
  ])("rechaza %j", (id) => {
    expect(idApiSchema.safeParse(id).success).toBe(false);
  });
});

describe("esIdiomaTcgdex", () => {
  it("reconoce los idiomas con código compatible y descarta el chino", () => {
    expect(["en", "es", "fr", "pt", "ja"].every(esIdiomaTcgdex)).toBe(true);
    expect(esIdiomaTcgdex("zh")).toBe(false);
    expect(esIdiomaTcgdex("../")).toBe(false);
  });
});

describe("tamanoImagenSchema", () => {
  it("usa hd cuando no se pide tamaño", () => {
    expect(tamanoImagenSchema.parse(undefined)).toBe("hd");
  });

  it("acepta min y hd", () => {
    expect(tamanoImagenSchema.parse("min")).toBe("min");
    expect(tamanoImagenSchema.parse("hd")).toBe("hd");
  });

  it.each(["", "low", "HD", "min/../x", "1", "min ", null])("rechaza %j", (valor) => {
    expect(tamanoImagenSchema.safeParse(valor).success).toBe(false);
  });
});
