import { describe, expect, it } from "vitest";
import {
  aprobarPropuestaSchema,
  crearPropuestaSchema,
  IMAGEN_MAX_BYTES,
  rechazarPropuestaSchema,
} from "./propuestas";

const archivo = (bytes: number) => new File([new Uint8Array(bytes)], "carta.png", { type: "image/png" });

const valida = { cartaId: 7, descripcion: "  Una carta  ", detalles: "Texto libre", archivo: archivo(10) };

describe("crearPropuestaSchema", () => {
  it("acepta una propuesta válida y recorta los textos", () => {
    const r = crearPropuestaSchema.parse(valida);
    expect(r.descripcion).toBe("Una carta");
    expect(r.archivo).toBeInstanceOf(File);
  });

  it.each([
    ["sin archivo", { ...valida, archivo: null }],
    ["un texto en vez de archivo", { ...valida, archivo: "carta.png" }],
    ["un archivo vacío", { ...valida, archivo: archivo(0) }],
    ["un archivo de más de 2 MB", { ...valida, archivo: archivo(IMAGEN_MAX_BYTES + 1) }],
    ["descripción vacía", { ...valida, descripcion: "   " }],
    ["descripción de más de 1000 caracteres", { ...valida, descripcion: "a".repeat(1001) }],
    ["detalles de más de 2000 caracteres", { ...valida, detalles: "a".repeat(2001) }],
    ["id de carta manipulado", { ...valida, cartaId: Number("1 or 1=1") }],
    ["id de carta negativo", { ...valida, cartaId: -1 }],
  ])("rechaza %s", (_, entrada) => {
    expect(crearPropuestaSchema.safeParse(entrada).success).toBe(false);
  });
});

describe("revisión", () => {
  it("aprobar exige un id entero positivo", () => {
    expect(aprobarPropuestaSchema.safeParse({ propuestaId: 3 }).success).toBe(true);
    expect(aprobarPropuestaSchema.safeParse({ propuestaId: 1.5 }).success).toBe(false);
    expect(aprobarPropuestaSchema.safeParse({ propuestaId: NaN }).success).toBe(false);
  });

  it("rechazar exige un motivo de 5 a 300 caracteres", () => {
    expect(rechazarPropuestaSchema.safeParse({ propuestaId: 3, motivo: "Imagen borrosa" }).success).toBe(true);
    expect(rechazarPropuestaSchema.safeParse({ propuestaId: 3, motivo: "mal" }).success).toBe(false);
    expect(rechazarPropuestaSchema.safeParse({ propuestaId: 3, motivo: "a".repeat(301) }).success).toBe(false);
  });
});
