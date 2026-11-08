import { beforeEach, describe, expect, it, vi } from "vitest";

// lib/panel-coleccion.ts es solo de servidor: usa el cliente de Supabase con las
// cookies de la petición y las URLs firmadas de las imágenes. Se reemplazan.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/catalogo", () => ({ urlsImagenesOpcionales: vi.fn() }));

import { urlsImagenesOpcionales } from "@/lib/catalogo";
import { createClient } from "@/lib/supabase/server";
import { TAMANO_PANEL } from "@/lib/validators/panel-coleccion";
import { listarPanelColeccion, SIN_SESION } from "./panel-coleccion";

type Respuesta = { data?: unknown; error?: { code?: string } | null };

function clienteFalso({ usuario = { id: "u1" } as object | null, respuesta = {} as Respuesta } = {}) {
  const llamadas: Array<[string, unknown[]]> = [];
  const resultado = { data: [], error: null, ...respuesta };
  const consulta: Record<string, unknown> = {};
  for (const metodo of ["select", "ilike", "eq", "order"]) {
    consulta[metodo] = (...args: unknown[]) => {
      llamadas.push([metodo, args]);
      return consulta;
    };
  }
  consulta.range = (...args: unknown[]) => {
    llamadas.push(["range", args]);
    return Promise.resolve(resultado);
  };
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

const fila = (id: number, nombre = "Sylveon") => ({
  id,
  carta_id: id * 10,
  variante: "normal",
  cantidad: 2,
  cartas: { id_api: `sv01-${id}`, nombre, idioma: "en" },
});

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(urlsImagenesOpcionales).mockReset().mockResolvedValue({});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("listarPanelColeccion", () => {
  it("devuelve las cartas con su imagen", async () => {
    clienteFalso({ respuesta: { data: [fila(1), fila(2, "Eevee")] } });
    vi.mocked(urlsImagenesOpcionales).mockResolvedValue({ 10: "https://img/10", 20: null });

    const r = await listarPanelColeccion({});

    expect(r).toEqual({
      ok: true,
      datos: {
        hayMas: false,
        cartas: [
          { inventarioId: 1, cartaId: 10, nombre: "Sylveon", idApi: "sv01-1", idioma: "en", variante: "normal", cantidad: 2, imagenUrl: "https://img/10" },
          { inventarioId: 2, cartaId: 20, nombre: "Eevee", idApi: "sv01-2", idioma: "en", variante: "normal", cantidad: 2, imagenUrl: null },
        ],
      },
    });
  });

  it("pide una fila de más para saber si hay otra página, y no la devuelve", async () => {
    const filas = Array.from({ length: TAMANO_PANEL + 1 }, (_, i) => fila(i + 1));
    const { llamadas } = clienteFalso({ respuesta: { data: filas } });

    const r = await listarPanelColeccion({ pagina: 1 });

    expect(llamadas).toContainEqual(["range", [0, TAMANO_PANEL]]);
    expect(r.ok && r.datos.hayMas).toBe(true);
    expect(r.ok && r.datos.cartas).toHaveLength(TAMANO_PANEL);
  });

  it("calcula el desde de las páginas siguientes", async () => {
    const { llamadas } = clienteFalso();

    await listarPanelColeccion({ pagina: 3 });

    expect(llamadas).toContainEqual(["range", [2 * TAMANO_PANEL, 3 * TAMANO_PANEL]]);
  });

  it("sin filtros no filtra por nombre ni por categoría", async () => {
    const { llamadas } = clienteFalso();

    await listarPanelColeccion({});

    expect(llamadas.some(([m]) => m === "ilike" || m === "eq")).toBe(false);
    expect(llamadas.some(([m, a]) => m === "select" && String(a[0]).includes("categoria_cartas"))).toBe(false);
  });

  it("busca el texto en cualquier parte del nombre y escapa los comodines", async () => {
    const { llamadas } = clienteFalso();

    await listarPanelColeccion({ texto: "50%_" });

    expect(llamadas).toContainEqual(["ilike", ["cartas.nombre", "%50\\%\\_%"]]);
  });

  it("con categoría une la tabla de pertenencia y filtra por ella", async () => {
    const { llamadas } = clienteFalso();

    await listarPanelColeccion({ categoriaId: 4 });

    expect(llamadas.some(([m, a]) => m === "select" && String(a[0]).includes("categoria_cartas!inner"))).toBe(true);
    expect(llamadas).toContainEqual(["eq", ["categoria_cartas.categoria_id", 4]]);
  });

  it("deja fuera las filas sin carta y no repite ids al pedir imágenes", async () => {
    clienteFalso({ respuesta: { data: [{ ...fila(1), cartas: null }, fila(2), { ...fila(3), carta_id: 20 }] } });

    const r = await listarPanelColeccion({});

    expect(r.ok && r.datos.cartas.map((c) => c.inventarioId)).toEqual([2, 3]);
    expect(vi.mocked(urlsImagenesOpcionales).mock.calls[0][0].sort()).toEqual([10, 20]);
  });

  it.each([
    ["texto largo", { texto: "x".repeat(51) }],
    ["categoría inválida", { categoriaId: -1 }],
    ["página inválida", { pagina: 0 }],
  ])("rechaza %s sin tocar la base", async (_, entrada) => {
    const { cliente } = clienteFalso();

    expect((await listarPanelColeccion(entrada)).ok).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("exige una sesión iniciada", async () => {
    const { cliente } = clienteFalso({ usuario: null });

    expect(await listarPanelColeccion({})).toEqual({ ok: false, error: SIN_SESION });
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("un error de la base no revela el detalle", async () => {
    clienteFalso({ respuesta: { error: { code: "XX000" } } });

    expect(await listarPanelColeccion({})).toEqual({ ok: false, error: "No se pudo completar la operación." });
  });
});
