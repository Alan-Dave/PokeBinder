import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { exportarInventario, FILAS_MAX } from "./exportar";

type Respuesta = { data: unknown[] | null; error: { code: string } | null };

function sesion(user: object | null, respuestas: Respuesta[]) {
  const range = vi.fn();
  for (const r of respuestas) range.mockResolvedValueOnce(r);
  const filtros: unknown[][] = [];
  const registrar = (m: string) => (...args: unknown[]) => {
    filtros.push([m, ...args]);
    return consulta;
  };
  const consulta = { select: registrar("select"), order: registrar("order"), eq: registrar("eq"), ilike: registrar("ilike"), range };
  const cliente = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => consulta),
  };
  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return { cliente, range, filtros };
}

function csv(r: { ok: true; archivo: { contenido: string | Uint8Array } }) {
  return r.archivo.contenido as string;
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

describe("exportarInventario", () => {
  it("sin sesión no consulta la base", async () => {
    const { cliente } = sesion(null, []);

    const r = await exportarInventario({});

    expect(r).toEqual({ ok: false, error: "Se requiere una sesión iniciada." });
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("exporta encabezados y filas", async () => {
    sesion({ id: "u1" }, [{ data: [fila("Pikachu", 2)], error: null }]);

    const r = await exportarInventario({});

    expect(r.ok && csv(r)).toContain("ID de carta (API),Nombre,Idioma,Variante,Cantidad");
    expect(r.ok && csv(r)).toContain("x1,Pikachu,es,normal,2");
  });

  it("deja vacíos los datos de una carta que ya no existe", async () => {
    sesion({ id: "u1" }, [{ data: [{ variante: "normal", cantidad: 1, cartas: null }], error: null }]);

    const r = await exportarInventario({});

    expect(r.ok && csv(r)).toContain(",,,normal,1");
  });

  it("neutraliza un nombre que empieza como fórmula", async () => {
    sesion({ id: "u1" }, [{ data: [fila("=CMD()")], error: null }]);

    const r = await exportarInventario({});

    expect(r.ok && csv(r)).toContain("'=CMD()");
  });

  it("sigue leyendo mientras el bloque venga lleno", async () => {
    const lleno = Array.from({ length: 1000 }, () => fila("A"));
    const { range } = sesion({ id: "u1" }, [
      { data: lleno, error: null },
      { data: [fila("B")], error: null },
    ]);

    const r = await exportarInventario({});

    expect(range).toHaveBeenCalledTimes(2);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(r.ok && csv(r).split("\r\n")).toHaveLength(1 + 1001 + 1);
  });

  it("se detiene en el tope de filas", async () => {
    const lleno = Array.from({ length: 1000 }, () => fila("A"));
    const { range } = sesion(
      { id: "u1" },
      Array.from({ length: FILAS_MAX / 1000 + 5 }, () => ({ data: lleno, error: null })),
    );

    await exportarInventario({});

    expect(range).toHaveBeenCalledTimes(FILAS_MAX / 1000);
  });

  it("oculta el detalle de un fallo de la base", async () => {
    sesion({ id: "u1" }, [{ data: null, error: { code: "XX000" } }]);

    const r = await exportarInventario({});

    expect(r).toEqual({ ok: false, error: "No se pudo generar la exportación." });
  });

  it("rechaza un formato no permitido sin consultar la base", async () => {
    const { cliente } = sesion({ id: "u1" }, []);

    const r = await exportarInventario({ formato: "pdf" });

    expect(r).toEqual({ ok: false, error: "El formato debe ser csv o xlsx." });
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("entrega un CSV con su tipo y nombre", async () => {
    sesion({ id: "u1" }, [{ data: [fila("A")], error: null }]);

    const r = await exportarInventario({ formato: "csv" });

    expect(r.ok && r.archivo).toMatchObject({ tipo: "text/csv; charset=utf-8", nombre: "inventario.csv" });
  });

  it("entrega un xlsx con su tipo y nombre", async () => {
    sesion({ id: "u1" }, [{ data: [fila("A")], error: null }]);

    const r = await exportarInventario({ formato: "xlsx" });

    expect(r.ok && r.archivo.nombre).toBe("inventario.xlsx");
    expect(r.ok && r.archivo.tipo).toContain("spreadsheetml.sheet");
    // Un .xlsx es un ZIP: empieza con la firma «PK».
    expect(r.ok && (r.archivo.contenido as Uint8Array).slice(0, 2)).toEqual(new Uint8Array([0x50, 0x4b]));
  });

  it("aplica los filtros validados como parámetros", async () => {
    const { filtros } = sesion({ id: "u1" }, [{ data: [fila("A")], error: null }]);

    await exportarInventario({ idioma: "en", setId: "sv1", rareza: "Rare" });

    expect(filtros).toContainEqual(["eq", "cartas.idioma", "en"]);
    expect(filtros).toContainEqual(["eq", "cartas.set_id", "sv1"]);
    expect(filtros).toContainEqual(["ilike", "cartas.rarity", "rare%"]);
  });

  it("rechaza un filtro inválido sin consultar la base", async () => {
    const { cliente } = sesion({ id: "u1" }, []);

    const r = await exportarInventario({ setId: "x' OR '1'='1" });

    expect(r.ok).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
  });
});
