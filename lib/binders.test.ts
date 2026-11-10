import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import {
  SIN_SESION,
  cambiarPaginas,
  colocarCarta,
  crearBinder,
  eliminarBinder,
  listarBinders,
  moverCarta,
  obtenerBinder,
  quitarCarta,
} from "./binders";

type RespuestaBase = { data?: unknown; error?: { code?: string } | null };

/**
 * Cliente falso de Supabase: cada llamada a from() devuelve la siguiente
 * respuesta de la lista, y se registra cada método encadenado.
 */
function clienteFalso({
  usuario = { id: "u1" } as object | null,
  respuestas = [{}] as RespuestaBase[],
} = {}) {
  const llamadas: Array<[string, unknown[]]> = [];
  let turno = 0;

  const cliente = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: usuario } }) },
    from: vi.fn((tabla: string) => {
      llamadas.push(["from", [tabla]]);
      const resultado = { data: null, error: null, ...(respuestas[turno++] ?? respuestas.at(-1)) };
      const consulta: Record<string, unknown> = {};
      for (const metodo of ["insert", "upsert", "update", "delete", "select", "eq", "order"]) {
        consulta[metodo] = (...args: unknown[]) => {
          llamadas.push([metodo, args]);
          return consulta;
        };
      }
      consulta.single = () => Promise.resolve(resultado);
      consulta.maybeSingle = () => Promise.resolve(resultado);
      consulta.then = (resolver: (valor: unknown) => unknown) => Promise.resolve(resultado).then(resolver);
      return consulta;
    }),
  };

  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return { cliente, llamadas };
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
});

describe("crearBinder", () => {
  it("inserta solo los campos validados, sin usuario_id", async () => {
    const { llamadas } = clienteFalso({ respuestas: [{ data: { id: 4 } }] });

    const r = await crearBinder({ nombre: " Mi binder ", cuadricula: "3x4", paginas: 5, usuario_id: "otro" });

    expect(r).toEqual({ ok: true, datos: { id: 4 } });
    expect(llamadas).toContainEqual(["insert", [{ nombre: "Mi binder", filas: 3, columnas: 4, paginas: 5 }]]);
  });

  it("no toca la base si la cuadrícula no existe", async () => {
    const { cliente } = clienteFalso();
    const r = await crearBinder({ nombre: "a", cuadricula: "5x5" });
    expect(r.ok).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("exige sesión", async () => {
    const { cliente } = clienteFalso({ usuario: null });
    expect(await crearBinder({ nombre: "a", cuadricula: "2x2" })).toEqual({ ok: false, error: SIN_SESION });
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("traduce el nombre repetido y no filtra errores desconocidos", async () => {
    clienteFalso({ respuestas: [{ error: { code: "23505" } }] });
    expect(await crearBinder({ nombre: "a", cuadricula: "2x2" })).toEqual({
      ok: false,
      error: "Ya tienes un binder con ese nombre.",
    });

    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    clienteFalso({ respuestas: [{ error: { code: "XX000" } }] });
    const r = await crearBinder({ nombre: "a", cuadricula: "2x2" });
    expect(r).toEqual({ ok: false, error: "No se pudo completar la operación." });
    espia.mockRestore();
  });
});

describe("listarBinders", () => {
  it("devuelve los binders con su cuadrícula y descarta tamaños inválidos", async () => {
    clienteFalso({
      respuestas: [
        {
          data: [
            { id: 1, nombre: "A", filas: 3, columnas: 3, paginas: 2 },
            { id: 2, nombre: "Rara", filas: 7, columnas: 7, paginas: 1 },
          ],
        },
      ],
    });
    const r = await listarBinders();
    expect(r).toEqual({
      ok: true,
      datos: [{ id: 1, nombre: "A", filas: 3, columnas: 3, paginas: 2, cuadricula: "3x3" }],
    });
  });

  it("exige sesión", async () => {
    clienteFalso({ usuario: null });
    expect(await listarBinders()).toEqual({ ok: false, error: SIN_SESION });
  });
});

describe("obtenerBinder", () => {
  const binder = { id: 1, nombre: "A", filas: 2, columnas: 2, paginas: 3 };

  it("arma las casillas de la página con la carta del inventario", async () => {
    clienteFalso({
      respuestas: [
        { data: binder },
        {
          data: [
            {
              posicion: 1,
              inventario: {
                id: 9,
                carta_id: 20,
                variante: "holo",
                cartas: { id_api: "base1-4", nombre: "Charizard", idioma: "en" },
              },
            },
          ],
        },
      ],
    });

    const r = await obtenerBinder({ binderId: 1, pagina: 2 });

    expect(r).toEqual({
      ok: true,
      datos: {
        binder: { ...binder, cuadricula: "2x2" },
        pagina: 2,
        casillas: [
          { posicion: 1, inventarioId: 9, cartaId: 20, variante: "holo", nombre: "Charizard", idApi: "base1-4", idioma: "en" },
        ],
      },
    });
  });

  it("responde igual si el binder no existe o es de otro usuario", async () => {
    clienteFalso({ respuestas: [{ data: null }] });
    expect(await obtenerBinder({ binderId: 99 })).toEqual({
      ok: false,
      error: "El binder no existe o no te pertenece.",
    });
  });

  it("rechaza una página que el binder no tiene sin consultar las casillas", async () => {
    const { cliente } = clienteFalso({ respuestas: [{ data: binder }] });
    const r = await obtenerBinder({ binderId: 1, pagina: 4 });
    expect(r).toEqual({ ok: false, error: "El binder tiene 3 páginas." });
    expect(cliente.from).toHaveBeenCalledTimes(1);
  });
});

describe("colocarCarta", () => {
  it("hace upsert por casilla con solo los campos validados", async () => {
    const { llamadas } = clienteFalso();
    const r = await colocarCarta({ binderId: 1, pagina: 2, posicion: 3, inventarioId: 9, usuario_id: "otro" });

    expect(r).toEqual({ ok: true, datos: null });
    expect(llamadas).toContainEqual([
      "upsert",
      [{ binder_id: 1, pagina: 2, posicion: 3, inventario_id: 9 }, { onConflict: "binder_id,pagina,posicion" }],
    ]);
  });

  it("traduce la casilla fuera de la cuadrícula", async () => {
    clienteFalso({ respuestas: [{ error: { code: "23514" } }] });
    const r = await colocarCarta({ binderId: 1, pagina: 1, posicion: 9, inventarioId: 9 });
    expect(r).toEqual({ ok: false, error: "Esa casilla no existe en el binder, o el tamaño no es válido." });
  });

  it("explica que no quedan copias libres de la carta", async () => {
    clienteFalso({ respuestas: [{ error: { code: "PB001" } }] });
    const r = await colocarCarta({ binderId: 1, pagina: 1, posicion: 0, inventarioId: 9 });
    expect(r).toEqual({
      ok: false,
      error: "Ya pusiste todas tus copias de esa carta en el binder. Quita una de otra casilla para usarla aquí.",
    });
  });

  it("traduce el rechazo de RLS (inventario ajeno) sin revelar nada más", async () => {
    clienteFalso({ respuestas: [{ error: { code: "42501" } }] });
    const r = await colocarCarta({ binderId: 1, pagina: 1, posicion: 0, inventarioId: 9 });
    expect(r).toEqual({ ok: false, error: "No tienes permiso para realizar esta acción." });
  });

  it("no toca la base con una casilla inválida", async () => {
    const { cliente } = clienteFalso();
    expect((await colocarCarta({ binderId: 1, pagina: 1, posicion: 16, inventarioId: 9 })).ok).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
  });
});

describe("quitarCarta", () => {
  it("borra por binder, página y posición", async () => {
    const { llamadas } = clienteFalso();
    expect(await quitarCarta({ binderId: 1, pagina: 2, posicion: 3 })).toEqual({ ok: true, datos: null });
    expect(llamadas).toContainEqual(["eq", ["binder_id", 1]]);
    expect(llamadas).toContainEqual(["eq", ["pagina", 2]]);
    expect(llamadas).toContainEqual(["eq", ["posicion", 3]]);
  });
});

describe("moverCarta", () => {
  const entrada = { binderId: 1, pagina: 2, desde: 3, hasta: 4 };

  it("actualiza solo la posición de la casilla de origen", async () => {
    const { llamadas } = clienteFalso({ respuestas: [{ data: { posicion: 4 } }] });

    expect(await moverCarta({ ...entrada, inventario_id: 99, usuario_id: "otro" })).toEqual({ ok: true, datos: null });
    expect(llamadas).toContainEqual(["update", [{ posicion: 4 }]]);
    expect(llamadas).toContainEqual(["eq", ["binder_id", 1]]);
    expect(llamadas).toContainEqual(["eq", ["pagina", 2]]);
    expect(llamadas).toContainEqual(["eq", ["posicion", 3]]);
  });

  it("rechaza una casilla de destino ocupada sin reemplazarla", async () => {
    clienteFalso({ respuestas: [{ error: { code: "23505" } }] });

    expect(await moverCarta(entrada)).toEqual({
      ok: false,
      error: "Esa casilla ya está ocupada. Quita su carta o elige una casilla vacía.",
    });
  });

  it("informa si la casilla de origen está vacía", async () => {
    clienteFalso({ respuestas: [{ data: null }] });

    expect(await moverCarta(entrada)).toEqual({ ok: false, error: "La casilla de origen está vacía." });
  });

  it("traduce el destino fuera de la cuadrícula", async () => {
    clienteFalso({ respuestas: [{ error: { code: "23514" } }] });

    expect(await moverCarta(entrada)).toEqual({
      ok: false,
      error: "Esa casilla no existe en el binder, o el tamaño no es válido.",
    });
  });

  it("sin sesión no consulta la base", async () => {
    const { cliente } = clienteFalso({ usuario: null });

    expect(await moverCarta(entrada)).toEqual({ ok: false, error: SIN_SESION });
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it.each([
    ["origen y destino iguales", { ...entrada, hasta: 3 }],
    ["casilla negativa", { ...entrada, desde: -1 }],
    ["casilla fuera de rango", { ...entrada, hasta: 16 }],
    ["binder manipulado", { ...entrada, binderId: "1 OR 1=1" }],
    ["sin campos", {}],
  ])("rechaza %s sin tocar la base", async (_, malo) => {
    const { cliente } = clienteFalso();

    expect((await moverCarta(malo)).ok).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
  });
});

describe("cambiarPaginas y eliminarBinder", () => {
  it("cambiarPaginas informa si el binder no es del usuario", async () => {
    clienteFalso({ respuestas: [{ data: null }] });
    expect(await cambiarPaginas({ binderId: 1, paginas: 5 })).toEqual({
      ok: false,
      error: "El binder no existe o no te pertenece.",
    });
  });

  it("cambiarPaginas traduce el rechazo del trigger al achicar con cartas dentro", async () => {
    clienteFalso({ respuestas: [{ error: { code: "23514" } }] });
    expect((await cambiarPaginas({ binderId: 1, paginas: 1 })).ok).toBe(false);
  });

  it("eliminarBinder borra y confirma", async () => {
    clienteFalso({ respuestas: [{ data: { id: 1 } }] });
    expect(await eliminarBinder({ binderId: 1 })).toEqual({ ok: true, datos: null });
  });

  it("eliminarBinder rechaza un id inválido", async () => {
    const { cliente } = clienteFalso();
    expect((await eliminarBinder({ binderId: 0 })).ok).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
  });
});
