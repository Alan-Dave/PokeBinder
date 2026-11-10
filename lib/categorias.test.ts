import { beforeEach, describe, expect, it, vi } from "vitest";

// lib/categorias.ts es solo de servidor y crea el cliente de Supabase con las
// cookies de la petición: en las pruebas se reemplazan ambos.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import {
  asignarACategoria,
  categoriasDeCartas,
  crearCategoria,
  eliminarCategoria,
  listarCategorias,
  quitarDeCategoria,
  renombrarCategoria,
  SIN_SESION,
} from "./categorias";

type RespuestaBase = { data?: unknown; error?: { code?: string } | null };

/** Cliente falso de Supabase: registra cada método encadenado y resuelve con la respuesta indicada. */
function clienteFalso({ usuario = { id: "u1" } as object | null, respuesta = {} as RespuestaBase } = {}) {
  const llamadas: Array<[string, unknown[]]> = [];
  const resultado = { data: null, error: null, ...respuesta };

  const consulta: Record<string, unknown> = {};
  for (const metodo of ["insert", "update", "delete", "select", "eq", "in", "order"]) {
    consulta[metodo] = (...args: unknown[]) => {
      llamadas.push([metodo, args]);
      return consulta;
    };
  }
  consulta.single = () => Promise.resolve(resultado);
  consulta.maybeSingle = () => Promise.resolve(resultado);
  consulta.then = (resolver: (valor: unknown) => unknown) => Promise.resolve(resultado).then(resolver);

  const cliente = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: usuario } }) },
    from: vi.fn((tabla: string) => {
      llamadas.push(["from", [tabla]]);
      return consulta;
    }),
  };
  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return { cliente, llamadas };
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("sin sesión", () => {
  it.each([
    ["crearCategoria", () => crearCategoria({ nombre: "x" })],
    ["listarCategorias", () => listarCategorias()],
    ["renombrarCategoria", () => renombrarCategoria({ id: 1, nombre: "x" })],
    ["eliminarCategoria", () => eliminarCategoria({ id: 1 })],
    ["asignarACategoria", () => asignarACategoria({ categoriaId: 1, inventarioId: 1 })],
    ["quitarDeCategoria", () => quitarDeCategoria({ categoriaId: 1, inventarioId: 1 })],
    ["categoriasDeCartas", () => categoriasDeCartas([1])],
  ])("%s pide iniciar sesión y no toca la base", async (_, llamar) => {
    const { cliente } = clienteFalso({ usuario: null });

    expect(await llamar()).toEqual({ ok: false, error: SIN_SESION });
    expect(cliente.from).not.toHaveBeenCalled();
  });
});

describe("entrada inválida", () => {
  it.each([
    ["crear con nombre vacío", () => crearCategoria({ nombre: " " })],
    ["renombrar con id manipulado", () => renombrarCategoria({ id: "1 OR 1=1", nombre: "x" })],
    ["eliminar sin id", () => eliminarCategoria({})],
    ["asignar con carta negativa", () => asignarACategoria({ categoriaId: 1, inventarioId: -1 })],
    ["quitar con categoría 0", () => quitarDeCategoria({ categoriaId: 0, inventarioId: 1 })],
    ["categorías de demasiadas cartas", () => categoriasDeCartas(Array.from({ length: 31 }, (_, i) => i + 1))],
  ])("rechaza %s antes de llegar a la base", async (_, llamar) => {
    const { cliente } = clienteFalso();

    const r = await llamar();

    expect(r.ok).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
  });
});

describe("crearCategoria", () => {
  it("inserta solo el nombre: el usuario lo pone la base", async () => {
    const { llamadas } = clienteFalso({ respuesta: { data: { id: 7 } } });

    expect(await crearCategoria({ nombre: "  Mis Sylveon " })).toEqual({ ok: true, datos: { id: 7 } });
    expect(llamadas).toContainEqual(["from", ["categorias_coleccion"]]);
    expect(llamadas).toContainEqual(["insert", [{ nombre: "Mis Sylveon" }]]);
  });

  it.each([
    ["23505", "Ya tienes una categoría con ese nombre"],
    ["23514", "máximo de 100"],
    ["42501", "No tienes permiso"],
  ])("traduce el error %s", async (codigo, texto) => {
    clienteFalso({ respuesta: { error: { code: codigo } } });

    const r = await crearCategoria({ nombre: "x" });

    expect(r.ok === false && r.error).toContain(texto);
  });

  it("un error inesperado no revela el detalle", async () => {
    clienteFalso({ respuesta: { error: { code: "XX000" } } });

    expect(await crearCategoria({ nombre: "x" })).toEqual({ ok: false, error: "No se pudo completar la operación." });
  });
});

describe("listarCategorias", () => {
  it("devuelve las categorías con su conteo, ordenadas por nombre", async () => {
    clienteFalso({
      respuesta: {
        data: [
          { id: 2, nombre: "Zubat", categoria_cartas: [{ count: 0 }] },
          { id: 1, nombre: "Sylveon", categoria_cartas: [{ count: 4 }] },
          { id: 3, nombre: "Eevee", categoria_cartas: [] },
        ],
      },
    });

    expect(await listarCategorias()).toEqual({
      ok: true,
      datos: [
        { id: 3, nombre: "Eevee", cartas: 0 },
        { id: 1, nombre: "Sylveon", cartas: 4 },
        { id: 2, nombre: "Zubat", cartas: 0 },
      ],
    });
  });

  it("traduce los errores de la base", async () => {
    clienteFalso({ respuesta: { error: { code: "XX000" } } });

    expect(await listarCategorias()).toEqual({ ok: false, error: "No se pudo completar la operación." });
  });
});

describe("renombrarCategoria y eliminarCategoria", () => {
  it("renombra por id", async () => {
    const { llamadas } = clienteFalso({ respuesta: { data: { id: 1 } } });

    expect(await renombrarCategoria({ id: 1, nombre: "Nuevo" })).toEqual({ ok: true, datos: null });
    expect(llamadas).toContainEqual(["update", [{ nombre: "Nuevo" }]]);
    expect(llamadas).toContainEqual(["eq", ["id", 1]]);
  });

  it("si no existe o es de otro usuario, responde igual (RLS oculta la fila)", async () => {
    clienteFalso({ respuesta: { data: null } });
    const esperado = { ok: false, error: "La categoría no existe o no te pertenece." };

    expect(await renombrarCategoria({ id: 9, nombre: "x" })).toEqual(esperado);
    expect(await eliminarCategoria({ id: 9 })).toEqual(esperado);
  });

  it("elimina por id", async () => {
    const { llamadas } = clienteFalso({ respuesta: { data: { id: 1 } } });

    expect(await eliminarCategoria({ id: 1 })).toEqual({ ok: true, datos: null });
    expect(llamadas).toContainEqual(["from", ["categorias_coleccion"]]);
    expect(llamadas.some(([m]) => m === "delete")).toBe(true);
  });

  it("traduce el nombre repetido al renombrar y los errores al eliminar", async () => {
    clienteFalso({ respuesta: { error: { code: "23505" } } });
    const r = await renombrarCategoria({ id: 1, nombre: "x" });
    expect(r.ok === false && r.error).toContain("Ya tienes una categoría");

    clienteFalso({ respuesta: { error: { code: "XX000" } } });
    expect((await eliminarCategoria({ id: 1 })).ok).toBe(false);
  });
});

describe("asignarACategoria y quitarDeCategoria", () => {
  it("asigna una carta a una categoría", async () => {
    const { llamadas } = clienteFalso();

    expect(await asignarACategoria({ categoriaId: 2, inventarioId: 5 })).toEqual({ ok: true, datos: null });
    expect(llamadas).toContainEqual(["from", ["categoria_cartas"]]);
    expect(llamadas).toContainEqual(["insert", [{ categoria_id: 2, inventario_id: 5 }]]);
  });

  it("asignar lo ya asignado no es un error", async () => {
    clienteFalso({ respuesta: { error: { code: "23505" } } });

    expect(await asignarACategoria({ categoriaId: 2, inventarioId: 5 })).toEqual({ ok: true, datos: null });
  });

  it("una carta o categoría ajena la rechaza la política (42501)", async () => {
    clienteFalso({ respuesta: { error: { code: "42501" } } });

    const r = await asignarACategoria({ categoriaId: 2, inventarioId: 5 });

    expect(r.ok === false && r.error).toContain("No tienes permiso");
  });

  it("quita una carta de una categoría", async () => {
    const { llamadas } = clienteFalso();

    expect(await quitarDeCategoria({ categoriaId: 2, inventarioId: 5 })).toEqual({ ok: true, datos: null });
    expect(llamadas).toContainEqual(["eq", ["categoria_id", 2]]);
    expect(llamadas).toContainEqual(["eq", ["inventario_id", 5]]);
  });

  it("traduce los errores al quitar", async () => {
    clienteFalso({ respuesta: { error: { code: "XX000" } } });

    expect((await quitarDeCategoria({ categoriaId: 2, inventarioId: 5 })).ok).toBe(false);
  });
});

describe("categoriasDeCartas", () => {
  it("agrupa las categorías por carta", async () => {
    clienteFalso({
      respuesta: {
        data: [
          { categoria_id: 1, inventario_id: 10 },
          { categoria_id: 2, inventario_id: 10 },
          { categoria_id: 2, inventario_id: 11 },
        ],
      },
    });

    const r = await categoriasDeCartas([10, 11, 12]);

    expect(r.ok && [...r.datos.entries()]).toEqual([
      [10, [1, 2]],
      [11, [2]],
    ]);
  });

  it("con una lista vacía no consulta", async () => {
    const { cliente } = clienteFalso();

    expect(await categoriasDeCartas([])).toEqual({ ok: true, datos: new Map() });
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("traduce los errores de la base", async () => {
    clienteFalso({ respuesta: { error: { code: "XX000" } } });

    expect((await categoriasDeCartas([1])).ok).toBe(false);
  });
});
