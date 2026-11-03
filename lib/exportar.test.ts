import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { exportarInventarioCsv, FILAS_MAX } from "./exportar";

type Respuesta = { data: unknown[] | null; error: { code: string } | null };

function sesion(user: object | null, respuestas: Respuesta[]) {
  const range = vi.fn();
  for (const r of respuestas) range.mockResolvedValueOnce(r);
  const consulta = { select: () => consulta, order: () => consulta, range };
  const cliente = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => consulta),
  };
  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return { cliente, range };
}

const fila = (nombre: string, cantidad = 1) => ({
  variante: "normal",
  cantidad,
  cartas: { id_api: "x1", nombre, idioma: "es" },
});

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("exportarInventarioCsv", () => {
  it("sin sesión no consulta la base", async () => {
    const { cliente } = sesion(null, []);

    const r = await exportarInventarioCsv();

    expect(r).toEqual({ ok: false, error: "Se requiere una sesión iniciada." });
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("exporta encabezados y filas", async () => {
    sesion({ id: "u1" }, [{ data: [fila("Pikachu", 2)], error: null }]);

    const r = await exportarInventarioCsv();

    expect(r.ok && r.csv).toContain("ID de carta (API),Nombre,Idioma,Variante,Cantidad");
    expect(r.ok && r.csv).toContain("x1,Pikachu,es,normal,2");
  });

  it("deja vacíos los datos de una carta que ya no existe", async () => {
    sesion({ id: "u1" }, [{ data: [{ variante: "normal", cantidad: 1, cartas: null }], error: null }]);

    const r = await exportarInventarioCsv();

    expect(r.ok && r.csv).toContain(",,,normal,1");
  });

  it("neutraliza un nombre que empieza como fórmula", async () => {
    sesion({ id: "u1" }, [{ data: [fila("=CMD()")], error: null }]);

    const r = await exportarInventarioCsv();

    expect(r.ok && r.csv).toContain("'=CMD()");
  });

  it("sigue leyendo mientras el bloque venga lleno", async () => {
    const lleno = Array.from({ length: 1000 }, () => fila("A"));
    const { range } = sesion({ id: "u1" }, [
      { data: lleno, error: null },
      { data: [fila("B")], error: null },
    ]);

    const r = await exportarInventarioCsv();

    expect(range).toHaveBeenCalledTimes(2);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(r.ok && r.csv.split("\r\n")).toHaveLength(1 + 1001 + 1);
  });

  it("se detiene en el tope de filas", async () => {
    const lleno = Array.from({ length: 1000 }, () => fila("A"));
    const { range } = sesion(
      { id: "u1" },
      Array.from({ length: FILAS_MAX / 1000 + 5 }, () => ({ data: lleno, error: null })),
    );

    await exportarInventarioCsv();

    expect(range).toHaveBeenCalledTimes(FILAS_MAX / 1000);
  });

  it("oculta el detalle de un fallo de la base", async () => {
    sesion({ id: "u1" }, [{ data: null, error: { code: "XX000" } }]);

    const r = await exportarInventarioCsv();

    expect(r).toEqual({ ok: false, error: "No se pudo generar la exportación." });
  });
});
