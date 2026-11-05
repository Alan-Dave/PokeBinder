import { describe, expect, it } from "vitest";
import {
  cambiarEstadoReporteSchema,
  crearReporteSchema,
  DETALLE_MAX,
  DETALLE_MIN,
  listarReportesSchema,
} from "./reportes";

const valido = { cartaId: 5, motivo: "nombre", detalle: "El nombre tiene una errata" };

describe("crearReporteSchema", () => {
  it("acepta un reporte válido y recorta los espacios del detalle", () => {
    const r = crearReporteSchema.parse({ ...valido, detalle: "  El nombre tiene una errata  " });

    expect(r.detalle).toBe("El nombre tiene una errata");
  });

  it.each([
    ["sin carta", { ...valido, cartaId: undefined }],
    ["carta negativa", { ...valido, cartaId: -1 }],
    ["carta decimal", { ...valido, cartaId: 1.5 }],
    ["carta como texto", { ...valido, cartaId: "5" }],
    ["motivo fuera de la lista", { ...valido, motivo: "inventado" }],
    ["sin motivo", { ...valido, motivo: undefined }],
    ["detalle corto", { ...valido, detalle: "x".repeat(DETALLE_MIN - 1) }],
    ["detalle solo espacios", { ...valido, detalle: " ".repeat(30) }],
    ["detalle demasiado largo", { ...valido, detalle: "x".repeat(DETALLE_MAX + 1) }],
    ["detalle que no es texto", { ...valido, detalle: 123 }],
  ])("rechaza %s", (_, entrada) => {
    expect(crearReporteSchema.safeParse(entrada).success).toBe(false);
  });

  it("admite el detalle justo en los límites", () => {
    expect(crearReporteSchema.safeParse({ ...valido, detalle: "x".repeat(DETALLE_MIN) }).success).toBe(true);
    expect(crearReporteSchema.safeParse({ ...valido, detalle: "x".repeat(DETALLE_MAX) }).success).toBe(true);
  });
});

describe("listarReportesSchema", () => {
  it("muestra los abiertos por defecto", () => {
    expect(listarReportesSchema.parse({})).toEqual({ estado: "abierto" });
  });

  it.each(["resuelto", "descartado"])("acepta el estado %s", (estado) => {
    expect(listarReportesSchema.parse({ estado })).toEqual({ estado });
  });

  it("rechaza un estado desconocido", () => {
    expect(listarReportesSchema.safeParse({ estado: "todos" }).success).toBe(false);
  });
});

describe("cambiarEstadoReporteSchema", () => {
  it.each(["resuelto", "descartado"])("acepta cerrar como %s", (estado) => {
    expect(cambiarEstadoReporteSchema.safeParse({ id: 3, estado }).success).toBe(true);
  });

  it.each([
    ["reabrir", { id: 3, estado: "abierto" }],
    ["estado inventado", { id: 3, estado: "borrado" }],
    ["id inválido", { id: 0, estado: "resuelto" }],
    ["id como texto", { id: "3", estado: "resuelto" }],
    ["sin id", { estado: "resuelto" }],
  ])("rechaza %s", (_, entrada) => {
    expect(cambiarEstadoReporteSchema.safeParse(entrada).success).toBe(false);
  });
});
