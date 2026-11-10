import sharp from "sharp";
import { describe, expect, it } from "vitest";

// PBI-X15: la ilustración de reemplazo debe tener el formato de las cartas
// (63 × 88 mm) para que no se deforme ni deje bandas dentro de su marco.
describe("imagen de reemplazo de las cartas", () => {
  it("tiene la proporción 63:88", async () => {
    const { width, height } = await sharp("public/imagen-no-disponible.webp").metadata();
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(width! / height!).toBeCloseTo(63 / 88, 2);
  });

  it("pesa poco para cargarse al instante", async () => {
    const { size } = await sharp("public/imagen-no-disponible.webp").metadata();
    expect(size ?? 0).toBeLessThan(150 * 1024);
  });
});
