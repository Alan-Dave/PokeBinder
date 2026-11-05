import { beforeEach, describe, expect, it, vi } from "vitest";

// lib/inventario.ts es solo de servidor y crea el cliente de Supabase con las
// cookies de la petición: en las pruebas se reemplazan ambos.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import {
  agregarAlInventario,
  cambiarCantidad,
  eliminarDelInventario,
  listarInventario,
  SIN_SESION,
  TAMANO_PAGINA,
} from "./inventario";

type RespuestaBase = { data?: unknown; error?: { code?: string } | null; count?: number | null };

/**
 * Cliente falso de Supabase: registra cada método encadenado de la consulta
 * y resuelve con la respuesta indicada al final de la cadena.
 */
function clienteFalso({ usuario = { id: "u1" } as object | null, respuesta = {} as RespuestaBase } = {}) {
  const llamadas: Array<[string, unknown[]]> = [];
  const resultado = { data: null, error: null, count: null, ...respuesta };

  const consulta: Record<string, unknown> = {};
  for (const metodo of ["insert", "update", "delete", "select", "eq", "order", "range"]) {
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

const entradaValida = { cartaId: 10, variante: "holo", cantidad: 2 };

beforeEach(() => {
  vi.mocked(createClient).mockReset();
});

describe("agregarAlInventario", () => {
  it("inserta solo los campos validados y devuelve el id", async () => {
    const { llamadas } = clienteFalso({ respuesta: { data: { id: 7 } } });

    const resultado = await agregarAlInventario({ ...entradaValida, variante: "  holo  " });

    expect(resultado).toEqual({ ok: true, datos: { id: 7 } });
    // usuario_id nunca viaja desde la aplicación: lo pone auth.uid() en la base.
    expect(llamadas).toContainEqual(["insert", [{ carta_id: 10, variante: "holo", cantidad: 2 }]]);
  });

  it("no toca la base si la entrada es inválida", async () => {
    const { cliente } = clienteFalso();

    const resultado = await agregarAlInventario({ ...entradaValida, cantidad: 0 });

    expect(resultado).toEqual({ ok: false, error: "La cantidad mínima es 1." });
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("ignora campos extra como usuario_id (no hay asignación masiva)", async () => {
    const { llamadas } = clienteFalso({ respuesta: { data: { id: 1 } } });

    await agregarAlInventario({ ...entradaValida, usuario_id: "otro-usuario" });

    const [, [fila]] = llamadas.find(([metodo]) => metodo === "insert")!;
    expect(fila).not.toHaveProperty("usuario_id");
  });

  it("exige una sesión iniciada", async () => {
    const { cliente } = clienteFalso({ usuario: null });

    expect(await agregarAlInventario(entradaValida)).toEqual({ ok: false, error: SIN_SESION });
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("traduce el duplicado de la base a un mensaje para el usuario", async () => {
    clienteFalso({ respuesta: { error: { code: "23505" } } });

    const resultado = await agregarAlInventario(entradaValida);

    expect(resultado).toEqual({
      ok: false,
      error: "Esa carta y variante ya están en tu inventario. Edita la cantidad.",
    });
  });

  it("no expone el detalle de un error inesperado", async () => {
    clienteFalso({ respuesta: { error: { code: "XX000", message: "detalle interno de Postgres" } as never } });
    const consola = vi.spyOn(console, "error").mockImplementation(() => {});

    const resultado = await agregarAlInventario(entradaValida);

    expect(resultado).toEqual({ ok: false, error: "No se pudo completar la operación." });
    expect(consola).toHaveBeenCalled();
    consola.mockRestore();
  });
});

describe("cambiarCantidad", () => {
  it("actualiza la cantidad de la fila indicada", async () => {
    const { llamadas } = clienteFalso({ respuesta: { data: { id: 3 } } });

    expect(await cambiarCantidad({ id: 3, cantidad: 5 })).toEqual({ ok: true, datos: null });
    expect(llamadas).toContainEqual(["update", [{ cantidad: 5 }]]);
    expect(llamadas).toContainEqual(["eq", ["id", 3]]);
  });

  it("rechaza una cantidad sobre el máximo sin tocar la base", async () => {
    const { cliente } = clienteFalso();

    const resultado = await cambiarCantidad({ id: 3, cantidad: 10000 });

    expect(resultado.ok).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("responde lo mismo si la fila no existe o es de otro usuario", async () => {
    clienteFalso({ respuesta: { data: null } });

    expect(await cambiarCantidad({ id: 999, cantidad: 1 })).toEqual({
      ok: false,
      error: "El registro no existe o no te pertenece.",
    });
  });

  it("exige una sesión iniciada", async () => {
    clienteFalso({ usuario: null });
    expect(await cambiarCantidad({ id: 3, cantidad: 1 })).toEqual({ ok: false, error: SIN_SESION });
  });

  it("traduce el rechazo de permisos de la base", async () => {
    clienteFalso({ respuesta: { error: { code: "42501" } } });
    expect(await cambiarCantidad({ id: 3, cantidad: 1 })).toEqual({
      ok: false,
      error: "No tienes permiso para realizar esta acción.",
    });
  });
});

describe("eliminarDelInventario", () => {
  it("elimina la fila indicada", async () => {
    const { llamadas } = clienteFalso({ respuesta: { data: { id: 4 } } });

    expect(await eliminarDelInventario({ id: 4 })).toEqual({ ok: true, datos: null });
    expect(llamadas).toContainEqual(["delete", []]);
    expect(llamadas).toContainEqual(["eq", ["id", 4]]);
  });

  it.each([[0], [-1], [1.5], ["4"], [null]])("rechaza el id %s sin tocar la base", async (id) => {
    const { cliente } = clienteFalso();

    expect((await eliminarDelInventario({ id })).ok).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("responde lo mismo si la fila no existe o es de otro usuario", async () => {
    clienteFalso({ respuesta: { data: null } });
    expect(await eliminarDelInventario({ id: 4 })).toEqual({
      ok: false,
      error: "El registro no existe o no te pertenece.",
    });
  });

  it("exige una sesión iniciada", async () => {
    clienteFalso({ usuario: null });
    expect(await eliminarDelInventario({ id: 4 })).toEqual({ ok: false, error: SIN_SESION });
  });

  it("traduce el error de la base", async () => {
    clienteFalso({ respuesta: { error: { code: "23503" } } });
    expect(await eliminarDelInventario({ id: 4 })).toEqual({ ok: false, error: "La carta no existe." });
  });
});

describe("listarInventario", () => {
  it("pagina de a TAMANO_PAGINA filas", async () => {
    const { llamadas } = clienteFalso({ respuesta: { data: [], count: 45 } });

    const resultado = await listarInventario({ pagina: 2 });

    expect(resultado).toEqual({ ok: true, datos: { filas: [], total: 45 } });
    expect(llamadas).toContainEqual(["range", [TAMANO_PAGINA, 2 * TAMANO_PAGINA - 1]]);
  });

  it("usa la página 1 por defecto y total 0 si la base no informa conteo", async () => {
    const { llamadas } = clienteFalso({ respuesta: { data: [], count: null } });

    const resultado = await listarInventario();

    expect(resultado).toEqual({ ok: true, datos: { filas: [], total: 0 } });
    expect(llamadas).toContainEqual(["range", [0, TAMANO_PAGINA - 1]]);
  });

  it("rechaza una página inválida sin tocar la base", async () => {
    const { cliente } = clienteFalso();

    expect((await listarInventario({ pagina: 0 })).ok).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("exige una sesión iniciada", async () => {
    clienteFalso({ usuario: null });
    expect(await listarInventario()).toEqual({ ok: false, error: SIN_SESION });
  });

  it("traduce el error de la base", async () => {
    clienteFalso({ respuesta: { error: { code: "42501" } } });
    expect(await listarInventario()).toEqual({
      ok: false,
      error: "No tienes permiso para realizar esta acción.",
    });
  });
});
