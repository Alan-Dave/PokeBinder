import { beforeEach, describe, expect, it, vi } from "vitest";

// Una Server Action es un endpoint público: estas pruebas le envían lo que
// enviaría un formulario manipulado y verifican que la validación de
// lib/binders.ts lo frena antes de llegar a la base.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// redirect de Next.js corta la ejecución lanzando una excepción.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((ruta: string) => {
    throw new Error(`REDIRECT ${ruta}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  cambiarPaginasAccion,
  colocarCartaAccion,
  crearBinderAccion,
  eliminarBinderAccion,
  quitarCartaAccion,
} from "./acciones";

const INICIAL = { error: null, exito: false };

function formulario(campos: Record<string, string>) {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

/** Sesión iniciada y una consulta que termina con la respuesta indicada. */
function sesion(respuesta: { data?: unknown; error?: { code?: string } | null } = {}) {
  const resultado = { data: { id: 1 }, error: null, ...respuesta };
  const consulta: Record<string, unknown> = {};
  for (const metodo of ["insert", "upsert", "update", "delete", "select", "eq"]) consulta[metodo] = () => consulta;
  consulta.single = () => Promise.resolve(resultado);
  consulta.maybeSingle = () => Promise.resolve(resultado);
  consulta.then = (resolver: (valor: unknown) => unknown) => Promise.resolve(resultado).then(resolver);

  const cliente = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    from: vi.fn(() => consulta),
  };
  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return cliente;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(revalidatePath).mockReset();
  vi.mocked(redirect).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("crearBinderAccion", () => {
  it("crea el binder y redirige a él", async () => {
    sesion({ data: { id: 7 } });

    await expect(
      crearBinderAccion(INICIAL, formulario({ nombre: "Mi binder", cuadricula: "3x3", paginas: "4" })),
    ).rejects.toThrow("REDIRECT /binder/7");
    expect(redirect).toHaveBeenCalledWith("/binder/7");
  });

  it("usa una página si el formulario no trae el campo", async () => {
    sesion({ data: { id: 8 } });

    await expect(
      crearBinderAccion(INICIAL, formulario({ nombre: "Sin páginas", cuadricula: "2x2" })),
    ).rejects.toThrow("REDIRECT /binder/8");
  });

  it.each([
    ["cuadrícula que no existe", { nombre: "a", cuadricula: "5x5", paginas: "1" }],
    ["nombre vacío", { nombre: "", cuadricula: "2x2", paginas: "1" }],
    ["páginas con texto", { nombre: "a", cuadricula: "2x2", paginas: "abc" }],
    ["páginas sobre el máximo", { nombre: "a", cuadricula: "2x2", paginas: "101" }],
  ])("rechaza %s sin tocar la base", async (_, campos) => {
    const cliente = sesion();

    const estado = await crearBinderAccion(INICIAL, formulario(campos));

    expect(estado.exito).toBe(false);
    expect(estado.error).toBeTruthy();
    expect(cliente.from).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("devuelve el error de la base sin redirigir", async () => {
    sesion({ error: { code: "23505" } });

    const estado = await crearBinderAccion(INICIAL, formulario({ nombre: "Repetido", cuadricula: "2x2", paginas: "1" }));

    expect(estado).toEqual({ error: "Ya tienes un binder con ese nombre.", exito: false });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("colocarCartaAccion", () => {
  const campos = { binderId: "3", pagina: "1", posicion: "2", inventarioId: "9" };

  it("coloca la carta y refresca el binder", async () => {
    sesion();

    const estado = await colocarCartaAccion(INICIAL, formulario(campos));

    expect(estado).toEqual({ error: null, exito: true });
    expect(revalidatePath).toHaveBeenCalledWith("/binder/3");
  });

  it.each([
    ["posición fuera de la cuadrícula más grande", { ...campos, posicion: "16" }],
    ["página en cero", { ...campos, pagina: "0" }],
    ["id de inventario manipulado", { ...campos, inventarioId: "1 OR 1=1" }],
    ["campos ausentes", {}],
  ])("rechaza %s sin tocar la base", async (_, entrada) => {
    const cliente = sesion();

    const estado = await colocarCartaAccion(INICIAL, formulario(entrada));

    expect(estado.exito).toBe(false);
    expect(estado.error).toBeTruthy();
    expect(cliente.from).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("explica que no quedan copias libres", async () => {
    sesion({ error: { code: "PB001" } });

    const estado = await colocarCartaAccion(INICIAL, formulario(campos));

    expect(estado.exito).toBe(false);
    expect(estado.error).toContain("todas tus copias");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("quitarCartaAccion", () => {
  it("quita la carta y refresca el binder", async () => {
    sesion();

    const estado = await quitarCartaAccion(INICIAL, formulario({ binderId: "3", pagina: "1", posicion: "2" }));

    expect(estado).toEqual({ error: null, exito: true });
    expect(revalidatePath).toHaveBeenCalledWith("/binder/3");
  });

  it("rechaza una posición negativa sin tocar la base", async () => {
    const cliente = sesion();

    const estado = await quitarCartaAccion(INICIAL, formulario({ binderId: "3", pagina: "1", posicion: "-1" }));

    expect(estado.exito).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("devuelve el error de la base sin refrescar", async () => {
    sesion({ error: { code: "42501" } });

    const estado = await quitarCartaAccion(INICIAL, formulario({ binderId: "3", pagina: "1", posicion: "2" }));

    expect(estado).toEqual({ error: "No tienes permiso para realizar esta acción.", exito: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("cambiarPaginasAccion", () => {
  it("cambia las páginas y refresca el binder", async () => {
    sesion();

    const estado = await cambiarPaginasAccion(INICIAL, formulario({ binderId: "3", paginas: "6" }));

    expect(estado).toEqual({ error: null, exito: true });
    expect(revalidatePath).toHaveBeenCalledWith("/binder/3");
  });

  it("rechaza un número de páginas fuera de rango sin tocar la base", async () => {
    const cliente = sesion();

    const estado = await cambiarPaginasAccion(INICIAL, formulario({ binderId: "3", paginas: "0" }));

    expect(estado.exito).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("informa que el binder no existe o no es del usuario", async () => {
    sesion({ data: null });

    const estado = await cambiarPaginasAccion(INICIAL, formulario({ binderId: "3", paginas: "6" }));

    expect(estado).toEqual({ error: "El binder no existe o no te pertenece.", exito: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("eliminarBinderAccion", () => {
  it("elimina el binder y redirige a la lista", async () => {
    sesion();

    await expect(eliminarBinderAccion(INICIAL, formulario({ binderId: "3" }))).rejects.toThrow("REDIRECT /binder");
    expect(redirect).toHaveBeenCalledWith("/binder");
  });

  it("rechaza un id manipulado sin tocar la base", async () => {
    const cliente = sesion();

    const estado = await eliminarBinderAccion(INICIAL, formulario({ binderId: "1 OR 1=1" }));

    expect(estado.exito).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("informa que el binder no existe o no es del usuario, sin redirigir", async () => {
    sesion({ data: null });

    const estado = await eliminarBinderAccion(INICIAL, formulario({ binderId: "3" }));

    expect(estado).toEqual({ error: "El binder no existe o no te pertenece.", exito: false });
    expect(redirect).not.toHaveBeenCalled();
  });
});
