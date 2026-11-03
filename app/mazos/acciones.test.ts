import { beforeEach, describe, expect, it, vi } from "vitest";

// Una Server Action es un endpoint público: estas pruebas le envían lo que
// enviaría un formulario manipulado y verifican que la validación de
// lib/mazos.ts lo frena antes de llegar a la base.
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
  agregarCartaAlMazoAccion,
  crearMazoAccion,
  eliminarMazoAccion,
  fijarCantidadEnMazoAccion,
  quitarDelMazoAccion,
} from "./acciones";

const INICIAL = { error: null, exito: false };

function formulario(campos: Record<string, string>) {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

/** Sesión iniciada y una consulta que termina con la respuesta indicada. */
function sesion(respuesta: { data?: unknown; error?: { code?: string } | null } = {}) {
  const resultado = { data: { id: 1, cantidad: 1 }, error: null, ...respuesta };
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

describe("crearMazoAccion", () => {
  it("crea el mazo y redirige a él", async () => {
    sesion({ data: { id: 7 } });

    await expect(crearMazoAccion(INICIAL, formulario({ nombre: "Fuego" }))).rejects.toThrow("REDIRECT /mazos/7");
    expect(redirect).toHaveBeenCalledWith("/mazos/7");
  });

  it.each([
    ["nombre vacío", { nombre: "" }],
    ["nombre solo con espacios", { nombre: "   " }],
    ["nombre demasiado largo", { nombre: "a".repeat(61) }],
    ["campo ausente", {}],
  ])("rechaza %s sin tocar la base", async (_, campos) => {
    const cliente = sesion();

    const estado = await crearMazoAccion(INICIAL, formulario(campos));

    expect(estado.exito).toBe(false);
    expect(estado.error).toBeTruthy();
    expect(cliente.from).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("devuelve el error de la base sin redirigir", async () => {
    sesion({ error: { code: "42501" } });

    const estado = await crearMazoAccion(INICIAL, formulario({ nombre: "Fuego" }));

    expect(estado).toEqual({ error: "No tienes permiso para realizar esta acción.", exito: false });
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("agregarCartaAlMazoAccion", () => {
  it("agrega la carta y refresca el mazo", async () => {
    sesion();

    const estado = await agregarCartaAlMazoAccion(INICIAL, formulario({ mazoId: "3", cartaId: "10" }));

    expect(estado).toEqual({ error: null, exito: true });
    expect(revalidatePath).toHaveBeenCalledWith("/mazos/3");
  });

  it.each([
    ["mazo manipulado", { mazoId: "1 OR 1=1", cartaId: "10" }],
    ["carta en cero", { mazoId: "3", cartaId: "0" }],
    ["campos ausentes", {}],
    ["campos vacíos", { mazoId: "", cartaId: "" }],
  ])("rechaza %s sin tocar la base", async (_, campos) => {
    const cliente = sesion();

    const estado = await agregarCartaAlMazoAccion(INICIAL, formulario(campos));

    expect(estado.exito).toBe(false);
    expect(estado.error).toBeTruthy();
    expect(cliente.from).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("devuelve el error de la base sin refrescar", async () => {
    sesion({ error: { code: "23503" } });

    const estado = await agregarCartaAlMazoAccion(INICIAL, formulario({ mazoId: "3", cartaId: "10" }));

    expect(estado).toEqual({ error: "El mazo o la carta no existe.", exito: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("fijarCantidadEnMazoAccion", () => {
  const campos = { mazoId: "3", cartaId: "10", cantidad: "4" };

  it("guarda la cantidad y refresca el mazo", async () => {
    sesion();

    const estado = await fijarCantidadEnMazoAccion(INICIAL, formulario(campos));

    expect(estado).toEqual({ error: null, exito: true });
    expect(revalidatePath).toHaveBeenCalledWith("/mazos/3");
  });

  it.each([
    ["cantidad en cero", { ...campos, cantidad: "0" }],
    ["cantidad sobre el máximo", { ...campos, cantidad: "61" }],
    ["cantidad decimal", { ...campos, cantidad: "1.5" }],
    ["cantidad con texto", { ...campos, cantidad: "abc" }],
    ["cantidad ausente", { mazoId: "3", cartaId: "10" }],
  ])("rechaza %s sin tocar la base", async (_, entrada) => {
    const cliente = sesion();

    const estado = await fijarCantidadEnMazoAccion(INICIAL, formulario(entrada));

    expect(estado.exito).toBe(false);
    expect(estado.error).toBeTruthy();
    expect(cliente.from).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("devuelve el error de la base sin refrescar", async () => {
    sesion({ error: { code: "23514" } });

    const estado = await fijarCantidadEnMazoAccion(INICIAL, formulario(campos));

    expect(estado.exito).toBe(false);
    expect(estado.error).toContain("entre 1 y 60");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("quitarDelMazoAccion", () => {
  it("quita la carta y refresca el mazo", async () => {
    sesion();

    const estado = await quitarDelMazoAccion(INICIAL, formulario({ mazoId: "3", cartaId: "10" }));

    expect(estado).toEqual({ error: null, exito: true });
    expect(revalidatePath).toHaveBeenCalledWith("/mazos/3");
  });

  it("rechaza una carta negativa sin tocar la base", async () => {
    const cliente = sesion();

    const estado = await quitarDelMazoAccion(INICIAL, formulario({ mazoId: "3", cartaId: "-1" }));

    expect(estado.exito).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("devuelve el error de la base sin refrescar", async () => {
    sesion({ error: { code: "42501" } });

    const estado = await quitarDelMazoAccion(INICIAL, formulario({ mazoId: "3", cartaId: "10" }));

    expect(estado).toEqual({ error: "No tienes permiso para realizar esta acción.", exito: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("eliminarMazoAccion", () => {
  it("elimina el mazo y redirige a la lista", async () => {
    sesion();

    await expect(eliminarMazoAccion(INICIAL, formulario({ mazoId: "3" }))).rejects.toThrow("REDIRECT /mazos");
    expect(redirect).toHaveBeenCalledWith("/mazos");
  });

  it("rechaza un id manipulado sin tocar la base", async () => {
    const cliente = sesion();

    const estado = await eliminarMazoAccion(INICIAL, formulario({ mazoId: "1 OR 1=1" }));

    expect(estado.exito).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("informa que el mazo no existe o no es del usuario, sin redirigir", async () => {
    sesion({ data: null });

    const estado = await eliminarMazoAccion(INICIAL, formulario({ mazoId: "3" }));

    expect(estado).toEqual({ error: "El mazo no existe o no te pertenece.", exito: false });
    expect(redirect).not.toHaveBeenCalled();
  });
});
