import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { exportarFaltantes, FILAS_MAX, obtenerFaltantes, obtenerResumenInventario } from "./reportes";

type Resp = { data: unknown; error: { code: string } | null };

/**
 * Cliente falso: cada tabla responde con lo indicado. `inventario` puede traer
 * varias respuestas seguidas (lectura por bloques). Las consultas son
 * encadenables y se resuelven al esperarlas.
 */
function cliente(
  user: object | null,
  tablas: { inventario?: Resp[]; cartas?: Resp; sets?: Resp },
) {
  const llamadas: { tabla: string; filtros: unknown[][] }[] = [];
  const colaInventario = [...(tablas.inventario ?? [])];

  const from = vi.fn((tabla: keyof typeof tablas) => {
    const registro = { tabla, filtros: [] as unknown[][] };
    llamadas.push(registro);
    const resp = () => (tabla === "inventario" ? colaInventario.shift() : tablas[tabla]) ?? { data: [], error: null };
    const consulta: Record<string, unknown> = {};
    for (const m of ["select", "order", "range", "limit", "in", "eq"]) {
      consulta[m] = (...args: unknown[]) => {
        registro.filtros.push([m, ...args]);
        return consulta;
      };
    }
    consulta.maybeSingle = () => Promise.resolve(resp());
    consulta.then = (r: (v: unknown) => unknown) => Promise.resolve(resp()).then(r);
    return consulta;
  });

  const c = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) }, from };
  vi.mocked(createClient).mockResolvedValue(c as never);
  return { c, llamadas };
}

const inv = (carta_id: number, cantidad: number, set_id = "sv1", idioma = "en", price: number | null = 1) => ({
  carta_id,
  cantidad,
  cartas: { set_id, idioma, price },
});

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("obtenerResumenInventario", () => {
  it("sin sesión no consulta la base", async () => {
    const { c } = cliente(null, {});

    expect(await obtenerResumenInventario()).toEqual({ ok: false, error: "Se requiere una sesión iniciada." });
    expect(c.from).not.toHaveBeenCalled();
  });

  it("resume el inventario y agrega el nombre de los sets", async () => {
    cliente({ id: "u1" }, {
      inventario: [{ data: [inv(1, 2), inv(2, 1)], error: null }],
      sets: { data: [{ id: "sv1", idioma: "en", nombre: "Scarlet & Violet" }, { id: "sv1", idioma: "es", nombre: null }], error: null },
    });

    const r = await obtenerResumenInventario();

    expect(r.ok && r.datos.copias).toBe(3);
    expect(r.ok && r.datos.nombresSet).toEqual({ "sv1|en": "Scarlet & Violet" });
  });

  it("con inventario vacío no consulta los sets", async () => {
    const { llamadas } = cliente({ id: "u1" }, { inventario: [{ data: [], error: null }] });

    const r = await obtenerResumenInventario();

    expect(r.ok && r.datos.copias).toBe(0);
    expect(llamadas.map((l) => l.tabla)).toEqual(["inventario"]);
  });

  it("tolera que la consulta de sets no devuelva filas", async () => {
    cliente({ id: "u1" }, { inventario: [{ data: [inv(1, 1)], error: null }], sets: { data: null, error: null } });

    const r = await obtenerResumenInventario();

    expect(r.ok && r.datos.nombresSet).toEqual({});
  });

  it("sigue leyendo mientras el bloque venga lleno y respeta el tope", async () => {
    const lleno = Array.from({ length: 1000 }, (_, i) => inv(i + 1, 1));
    const { llamadas } = cliente({ id: "u1" }, {
      inventario: Array.from({ length: FILAS_MAX / 1000 + 5 }, () => ({ data: lleno, error: null })),
    });

    await obtenerResumenInventario();

    expect(llamadas.filter((l) => l.tabla === "inventario")).toHaveLength(FILAS_MAX / 1000);
  });

  it("oculta el detalle si falla la lectura del inventario", async () => {
    cliente({ id: "u1" }, { inventario: [{ data: null, error: { code: "XX000" } }] });

    expect(await obtenerResumenInventario()).toEqual({ ok: false, error: "No se pudo generar el reporte." });
  });

  it("oculta el detalle si falla la lectura de los sets", async () => {
    cliente({ id: "u1" }, { inventario: [{ data: [inv(1, 1)], error: null }], sets: { data: null, error: { code: "XX000" } } });

    expect(await obtenerResumenInventario()).toEqual({ ok: false, error: "No se pudo generar el reporte." });
  });
});

describe("obtenerFaltantes", () => {
  const cartas = {
    data: [
      { id: 1, nombre: "A", number: "1", rarity: "Common" },
      { id: 2, nombre: "B", number: "2", rarity: null },
    ],
    error: null,
  };

  it.each([
    ["set con inyección", { setId: "x' OR '1'='1", idioma: "en" }],
    ["idioma inválido", { setId: "sv1", idioma: "xx" }],
    ["sin parámetros", {}],
  ])("rechaza %s sin tocar la base", async (_, entrada) => {
    const { c } = cliente({ id: "u1" }, {});

    const r = await obtenerFaltantes(entrada);

    expect(r.ok).toBe(false);
    expect(c.from).not.toHaveBeenCalled();
  });

  it("sin sesión no consulta la base", async () => {
    const { c } = cliente(null, {});

    expect(await obtenerFaltantes({ setId: "sv1", idioma: "en" })).toEqual({ ok: false, error: "Se requiere una sesión iniciada." });
    expect(c.from).not.toHaveBeenCalled();
  });

  it("calcula lo que falta y filtra por set e idioma como parámetros", async () => {
    const { llamadas } = cliente({ id: "u1" }, {
      cartas,
      inventario: [{ data: [{ carta_id: 1 }], error: null }],
      sets: { data: { nombre: "Escarlata" }, error: null },
    });

    const r = await obtenerFaltantes({ setId: "sv1", idioma: "es" });

    expect(r.ok && r.datos).toMatchObject({ total: 2, tengo: 1, nombreSet: "Escarlata", setId: "sv1", idioma: "es" });
    expect(r.ok && r.datos.faltan.map((x) => x.id)).toEqual([2]);
    const delCatalogo = llamadas.find((l) => l.tabla === "cartas")!.filtros;
    expect(delCatalogo).toContainEqual(["eq", "set_id", "sv1"]);
    expect(delCatalogo).toContainEqual(["eq", "idioma", "es"]);
  });

  it("deja el nombre en null si el set no lo trae", async () => {
    cliente({ id: "u1" }, { cartas, inventario: [{ data: [], error: null }], sets: { data: null, error: null } });

    const r = await obtenerFaltantes({ setId: "sv1", idioma: "en" });

    expect(r.ok && r.datos.nombreSet).toBeNull();
  });

  it("informa si el set no existe en ese idioma", async () => {
    cliente({ id: "u1" }, { cartas: { data: [], error: null }, inventario: [{ data: [], error: null }] });

    expect(await obtenerFaltantes({ setId: "nada", idioma: "en" })).toEqual({ ok: false, error: "No existe ese set en ese idioma." });
  });

  it.each(["cartas", "inventario", "sets"])("oculta el detalle si falla la consulta de %s", async (tabla) => {
    const mal = { data: null, error: { code: "XX000" } };
    cliente({ id: "u1" }, {
      cartas: tabla === "cartas" ? mal : cartas,
      inventario: [tabla === "inventario" ? mal : { data: [], error: null }],
      sets: tabla === "sets" ? mal : { data: null, error: null },
    });

    expect(await obtenerFaltantes({ setId: "sv1", idioma: "en" })).toEqual({ ok: false, error: "No se pudo generar el reporte." });
  });
});

describe("exportarFaltantes", () => {
  const entrada = { setId: "sv1", idioma: "en" };
  const cartas = { data: [{ id: 1, nombre: "=CMD()", number: "1", rarity: null }], error: null };

  it("rechaza un formato inválido sin tocar la base", async () => {
    const { c } = cliente({ id: "u1" }, {});

    const r = await exportarFaltantes({ ...entrada, formato: "pdf" });

    expect(r).toEqual({ ok: false, error: "El formato debe ser csv o xlsx." });
    expect(c.from).not.toHaveBeenCalled();
  });

  it("sin sesión no consulta la base", async () => {
    const { c } = cliente(null, {});

    expect(await exportarFaltantes(entrada)).toEqual({ ok: false, error: "Se requiere una sesión iniciada." });
    expect(c.from).not.toHaveBeenCalled();
  });

  it("entrega un CSV con nombre fijo y neutraliza fórmulas", async () => {
    cliente({ id: "u1" }, { cartas, inventario: [{ data: [], error: null }], sets: { data: null, error: null } });

    const r = await exportarFaltantes(entrada);

    expect(r.ok && r.datos.nombre).toBe("faltantes-sv1-en.csv");
    expect(r.ok && (r.datos.contenido as string)).toContain("Número,Nombre,Rareza");
    expect(r.ok && (r.datos.contenido as string)).toContain("'=CMD()");
  });

  it("entrega un xlsx", async () => {
    cliente({ id: "u1" }, { cartas, inventario: [{ data: [], error: null }], sets: { data: null, error: null } });

    const r = await exportarFaltantes({ ...entrada, formato: "xlsx" });

    expect(r.ok && r.datos.nombre).toBe("faltantes-sv1-en.xlsx");
  });

  it("propaga el error si el set no existe", async () => {
    cliente({ id: "u1" }, { cartas: { data: [], error: null }, inventario: [{ data: [], error: null }] });

    expect(await exportarFaltantes(entrada)).toEqual({ ok: false, error: "No existe ese set en ese idioma." });
  });
});
