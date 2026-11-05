import { beforeEach, describe, expect, it, vi } from "vitest";

// Una Server Action es un endpoint público: estas pruebas le envían lo que
// enviaría un formulario manipulado y verifican que la validación de
// lib/reportes.ts lo frena antes de llegar a la base.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cambiarEstadoReporteAccion, reportarErrorAccion } from "./acciones";

const INICIAL = { error: null, exito: false };

function formulario(campos: Record<string, string>) {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

function sesion(respuesta: { data?: unknown; error?: { code?: string } | null } = {}) {
  const resultado = { data: { id: 1 }, error: null, ...respuesta };
  const consulta: Record<string, unknown> = {};
  for (const m of ["update", "eq", "select"]) consulta[m] = () => consulta;
  consulta.insert = () => Promise.resolve(resultado);
  consulta.maybeSingle = () => Promise.resolve(resultado);

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    from: vi.fn(() => consulta),
  } as never);
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(revalidatePath).mockReset();
});

describe("reportarErrorAccion", () => {
  it("envía un reporte válido", async () => {
    sesion();

    const estado = await reportarErrorAccion(
      INICIAL,
      formulario({ cartaId: "5", motivo: "nombre", detalle: "El nombre tiene una errata" }),
    );

    expect(estado).toEqual({ error: null, exito: true });
  });

  it.each([
    ["un motivo inventado", { cartaId: "5", motivo: "hackeo", detalle: "Detalle suficientemente largo" }],
    ["un detalle corto", { cartaId: "5", motivo: "otro", detalle: "corto" }],
    ["una carta no numérica", { cartaId: "abc", motivo: "otro", detalle: "Detalle suficientemente largo" }],
    ["campos ausentes", {}],
  ])("rechaza %s sin tocar la base", async (_, campos) => {
    const estado = await reportarErrorAccion(INICIAL, formulario(campos));

    expect(estado.exito).toBe(false);
    expect(estado.error).toBeTruthy();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("muestra el error de la base ya traducido", async () => {
    sesion({ error: { code: "23505" } });

    const estado = await reportarErrorAccion(
      INICIAL,
      formulario({ cartaId: "5", motivo: "nombre", detalle: "El nombre tiene una errata" }),
    );

    expect(estado).toEqual({ error: "Ya enviaste un reporte abierto de ese tipo para esta carta.", exito: false });
  });
});

describe("cambiarEstadoReporteAccion", () => {
  it("cierra el reporte y refresca la pantalla de revisión", async () => {
    sesion();

    const estado = await cambiarEstadoReporteAccion(INICIAL, formulario({ id: "3", estado: "resuelto" }));

    expect(estado).toEqual({ error: null, exito: true });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/reportes");
  });

  it.each([
    ["reabrir un reporte", { id: "3", estado: "abierto" }],
    ["un estado inventado", { id: "3", estado: "borrado" }],
    ["un id inválido", { id: "-1", estado: "resuelto" }],
    ["campos ausentes", {}],
  ])("rechaza %s sin tocar la base", async (_, campos) => {
    const estado = await cambiarEstadoReporteAccion(INICIAL, formulario(campos));

    expect(estado.exito).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("no confirma si RLS oculta el reporte (usuario sin permiso)", async () => {
    sesion({ data: null });

    const estado = await cambiarEstadoReporteAccion(INICIAL, formulario({ id: "3", estado: "descartado" }));

    expect(estado.exito).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
