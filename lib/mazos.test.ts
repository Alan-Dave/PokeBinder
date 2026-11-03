import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import {
  SIN_SESION,
  agregarCartaAlMazo,
  crearMazo,
  eliminarMazo,
  fijarCantidadEnMazo,
  listarMazos,
  obtenerMazo,
  quitarDelMazo,
} from "./mazos";

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
      for (const metodo of ["insert", "upsert", "update", "delete", "select", "eq", "in", "order"]) {
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
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("crearMazo", () => {
  it("inserta solo el nombre validado, sin usuario_id", async () => {
    const { llamadas } = clienteFalso({ respuestas: [{ data: { id: 5 } }] });

    const r = await crearMazo({ nombre: "  Fuego  ", usuario_id: "otro" });

    expect(r).toEqual({ ok: true, datos: { id: 5 } });
    expect(llamadas).toContainEqual(["insert", [{ nombre: "Fuego" }]]);
  });

  it("no toca la base con un nombre inválido", async () => {
    const { cliente } = clienteFalso();
    expect((await crearMazo({ nombre: "   " })).ok).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("exige sesión", async () => {
    const { cliente } = clienteFalso({ usuario: null });
    expect(await crearMazo({ nombre: "Fuego" })).toEqual({ ok: false, error: SIN_SESION });
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("no filtra el detalle de un error desconocido", async () => {
    clienteFalso({ respuestas: [{ error: { code: "XX000" } }] });
    expect(await crearMazo({ nombre: "Fuego" })).toEqual({ ok: false, error: "No se pudo completar la operación." });
  });
});

describe("listarMazos", () => {
  it("suma las copias de cada mazo", async () => {
    clienteFalso({
      respuestas: [
        {
          data: [
            { id: 2, nombre: "Agua", mazo_cartas: [{ cantidad: 4 }, { cantidad: 3 }] },
            { id: 1, nombre: "Vacío", mazo_cartas: [] },
          ],
        },
      ],
    });

    expect(await listarMazos()).toEqual({
      ok: true,
      datos: [
        { id: 2, nombre: "Agua", totalCartas: 7 },
        { id: 1, nombre: "Vacío", totalCartas: 0 },
      ],
    });
  });

  it("exige sesión", async () => {
    clienteFalso({ usuario: null });
    expect(await listarMazos()).toEqual({ ok: false, error: SIN_SESION });
  });

  it("traduce el error de la base", async () => {
    clienteFalso({ respuestas: [{ error: { code: "42501" } }] });
    expect(await listarMazos()).toEqual({ ok: false, error: "No tienes permiso para realizar esta acción." });
  });
});

describe("obtenerMazo", () => {
  const mazo = { data: { id: 3, nombre: "Rayo" } };

  it("arma las líneas, completa la etapa con la edición en inglés y valida las reglas", async () => {
    clienteFalso({
      respuestas: [
        mazo,
        {
          data: [
            {
              carta_id: 10,
              cantidad: 4,
              cartas: { id_api: "swsh9-043", idioma: "es", nombre: "Beartic", stage: null, subtipos: [] },
            },
            {
              carta_id: 11,
              cantidad: 2,
              cartas: { id_api: "swsh1-9", idioma: "en", nombre: "Radiant Eevee", stage: "Basic", subtipos: ["Radiant"] },
            },
          ],
        },
        { data: [{ id_api: "swsh9-043", nombre: "Beartic", stage: "Stage 1", subtipos: [] }] },
      ],
    });

    const r = await obtenerMazo({ mazoId: 3 });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datos.mazo).toEqual({ id: 3, nombre: "Rayo" });
    expect(r.datos.lineas).toEqual([
      { cartaId: 10, cantidad: 4, nombre: "Beartic", idApi: "swsh9-043", idioma: "es", stage: "Stage 1" },
      { cartaId: 11, cantidad: 2, nombre: "Radiant Eevee", idApi: "swsh1-9", idioma: "en", stage: "Basic" },
    ]);
    expect(r.datos.reglas.total).toBe(6);
    // Dos copias de una carta Radiant incumplen el límite de una.
    expect(r.datos.reglas.errores.map((e) => e.regla)).toContain("radiant");
  });

  it("un mazo sin cartas no consulta el catálogo", async () => {
    const { cliente } = clienteFalso({ respuestas: [mazo, { data: [] }] });

    const r = await obtenerMazo({ mazoId: 3 });

    expect(r.ok && r.datos.lineas).toEqual([]);
    expect(r.ok && r.datos.reglas.total).toBe(0);
    expect(cliente.from).toHaveBeenCalledTimes(2);
  });

  it("ignora una fila cuya carta ya no se puede leer", async () => {
    clienteFalso({ respuestas: [mazo, { data: [{ carta_id: 1, cantidad: 2, cartas: null }] }] });
    const r = await obtenerMazo({ mazoId: 3 });
    expect(r.ok && r.datos.lineas).toEqual([]);
  });

  it("responde igual si el mazo no existe o es de otro usuario", async () => {
    clienteFalso({ respuestas: [{ data: null }] });
    expect(await obtenerMazo({ mazoId: 3 })).toEqual({ ok: false, error: "El mazo no existe o no te pertenece." });
  });

  it("no toca la base con un id inválido", async () => {
    const { cliente } = clienteFalso();
    expect((await obtenerMazo({ mazoId: "1 OR 1=1" })).ok).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("exige sesión", async () => {
    clienteFalso({ usuario: null });
    expect(await obtenerMazo({ mazoId: 3 })).toEqual({ ok: false, error: SIN_SESION });
  });

  it("traduce un error al leer las cartas del mazo", async () => {
    clienteFalso({ respuestas: [mazo, { error: { code: "42501" } }] });
    expect(await obtenerMazo({ mazoId: 3 })).toEqual({
      ok: false,
      error: "No tienes permiso para realizar esta acción.",
    });
  });

  it("traduce un error al leer la edición en inglés", async () => {
    clienteFalso({
      respuestas: [
        mazo,
        { data: [{ carta_id: 1, cantidad: 1, cartas: { id_api: "a-1", idioma: "es", nombre: "X", stage: null, subtipos: [] } }] },
        { error: { code: "42501" } },
      ],
    });
    expect((await obtenerMazo({ mazoId: 3 })).ok).toBe(false);
  });

  it("traduce un error al leer el mazo", async () => {
    clienteFalso({ respuestas: [{ error: { code: "XX000" } }] });
    expect(await obtenerMazo({ mazoId: 3 })).toEqual({ ok: false, error: "No se pudo completar la operación." });
  });
});

describe("fijarCantidadEnMazo", () => {
  it("hace upsert con solo los campos validados", async () => {
    const { llamadas } = clienteFalso();

    const r = await fijarCantidadEnMazo({ mazoId: 3, cartaId: 10, cantidad: 4, usuario_id: "otro" });

    expect(r).toEqual({ ok: true, datos: null });
    expect(llamadas).toContainEqual([
      "upsert",
      [{ mazo_id: 3, carta_id: 10, cantidad: 4 }, { onConflict: "mazo_id,carta_id" }],
    ]);
  });

  it.each([0, 61, 1.5, "abc"])("no toca la base con la cantidad %s", async (cantidad) => {
    const { cliente } = clienteFalso();
    expect((await fijarCantidadEnMazo({ mazoId: 3, cartaId: 10, cantidad })).ok).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("traduce el rechazo de RLS sin revelar nada más", async () => {
    clienteFalso({ respuestas: [{ error: { code: "42501" } }] });
    expect(await fijarCantidadEnMazo({ mazoId: 3, cartaId: 10, cantidad: 2 })).toEqual({
      ok: false,
      error: "No tienes permiso para realizar esta acción.",
    });
  });

  it("traduce la violación del rango de la base", async () => {
    clienteFalso({ respuestas: [{ error: { code: "23514" } }] });
    const r = await fijarCantidadEnMazo({ mazoId: 3, cartaId: 10, cantidad: 2 });
    expect(r).toEqual({ ok: false, error: "La cantidad de una carta debe estar entre 1 y 60." });
  });

  it("exige sesión", async () => {
    clienteFalso({ usuario: null });
    expect(await fijarCantidadEnMazo({ mazoId: 3, cartaId: 10, cantidad: 2 })).toEqual({
      ok: false,
      error: SIN_SESION,
    });
  });
});

describe("agregarCartaAlMazo", () => {
  it("suma una copia a la cantidad que ya tiene", async () => {
    const { llamadas } = clienteFalso({ respuestas: [{ data: { cantidad: 2 } }, {}] });

    expect(await agregarCartaAlMazo({ mazoId: 3, cartaId: 10 })).toEqual({ ok: true, datos: null });
    expect(llamadas).toContainEqual([
      "upsert",
      [{ mazo_id: 3, carta_id: 10, cantidad: 3 }, { onConflict: "mazo_id,carta_id" }],
    ]);
  });

  it("empieza en una copia si la carta no estaba", async () => {
    const { llamadas } = clienteFalso({ respuestas: [{ data: null }, {}] });

    await agregarCartaAlMazo({ mazoId: 3, cartaId: 10 });

    expect(llamadas).toContainEqual([
      "upsert",
      [{ mazo_id: 3, carta_id: 10, cantidad: 1 }, { onConflict: "mazo_id,carta_id" }],
    ]);
  });

  it("no pasa de 60 copias", async () => {
    const { llamadas } = clienteFalso({ respuestas: [{ data: { cantidad: 60 } }, {}] });

    await agregarCartaAlMazo({ mazoId: 3, cartaId: 10 });

    expect(llamadas).toContainEqual([
      "upsert",
      [{ mazo_id: 3, carta_id: 10, cantidad: 60 }, { onConflict: "mazo_id,carta_id" }],
    ]);
  });

  it("traduce un error al leer o al escribir", async () => {
    clienteFalso({ respuestas: [{ error: { code: "42501" } }] });
    expect((await agregarCartaAlMazo({ mazoId: 3, cartaId: 10 })).ok).toBe(false);

    clienteFalso({ respuestas: [{ data: null }, { error: { code: "23503" } }] });
    expect(await agregarCartaAlMazo({ mazoId: 3, cartaId: 10 })).toEqual({
      ok: false,
      error: "El mazo o la carta no existe.",
    });
  });

  it("no toca la base con ids inválidos y exige sesión", async () => {
    const { cliente } = clienteFalso();
    expect((await agregarCartaAlMazo({ mazoId: 0, cartaId: 10 })).ok).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();

    clienteFalso({ usuario: null });
    expect(await agregarCartaAlMazo({ mazoId: 3, cartaId: 10 })).toEqual({ ok: false, error: SIN_SESION });
  });
});

describe("quitarDelMazo", () => {
  it("borra por mazo y carta", async () => {
    const { llamadas } = clienteFalso();

    expect(await quitarDelMazo({ mazoId: 3, cartaId: 10 })).toEqual({ ok: true, datos: null });
    expect(llamadas).toContainEqual(["eq", ["mazo_id", 3]]);
    expect(llamadas).toContainEqual(["eq", ["carta_id", 10]]);
  });

  it("traduce el error, rechaza ids inválidos y exige sesión", async () => {
    clienteFalso({ respuestas: [{ error: { code: "42501" } }] });
    expect((await quitarDelMazo({ mazoId: 3, cartaId: 10 })).ok).toBe(false);

    const { cliente } = clienteFalso();
    expect((await quitarDelMazo({ mazoId: 3, cartaId: -1 })).ok).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();

    clienteFalso({ usuario: null });
    expect(await quitarDelMazo({ mazoId: 3, cartaId: 10 })).toEqual({ ok: false, error: SIN_SESION });
  });
});

describe("eliminarMazo", () => {
  it("borra y confirma", async () => {
    clienteFalso({ respuestas: [{ data: { id: 3 } }] });
    expect(await eliminarMazo({ mazoId: 3 })).toEqual({ ok: true, datos: null });
  });

  it("informa si el mazo no existe o no es del usuario", async () => {
    clienteFalso({ respuestas: [{ data: null }] });
    expect(await eliminarMazo({ mazoId: 3 })).toEqual({ ok: false, error: "El mazo no existe o no te pertenece." });
  });

  it("traduce el error, rechaza un id inválido y exige sesión", async () => {
    clienteFalso({ respuestas: [{ error: { code: "42501" } }] });
    expect((await eliminarMazo({ mazoId: 3 })).ok).toBe(false);

    const { cliente } = clienteFalso();
    expect((await eliminarMazo({ mazoId: "x" })).ok).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();

    clienteFalso({ usuario: null });
    expect(await eliminarMazo({ mazoId: 3 })).toEqual({ ok: false, error: SIN_SESION });
  });
});
