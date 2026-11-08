import { beforeEach, describe, expect, it, vi } from "vitest";

// Una Server Action es un endpoint público: estas pruebas le envían lo que
// enviaría un formulario manipulado y verifican que la validación de
// lib/inventario.ts lo frena antes de llegar a la base.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { agregarCartaAccion } from "@/app/catalogo/acciones";
import {
  alternarCategoriaAccion,
  crearCategoriaAccion,
  eliminarAccion,
  eliminarCategoriaAccion,
  guardarCantidadAccion,
  renombrarCategoriaAccion,
} from "./acciones";

const INICIAL = { error: null, exito: false };

function formulario(campos: Record<string, string>) {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

function sesion(respuesta: { data: unknown } = { data: { id: 1 } }) {
  const consulta: Record<string, unknown> = {};
  for (const metodo of ["insert", "update", "delete", "select", "eq"]) consulta[metodo] = () => consulta;
  consulta.single = () => Promise.resolve({ error: null, ...respuesta });
  consulta.maybeSingle = () => Promise.resolve({ error: null, ...respuesta });

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
});

describe("guardarCantidadAccion", () => {
  it("guarda una cantidad válida y refresca /coleccion", async () => {
    sesion();

    const estado = await guardarCantidadAccion(INICIAL, formulario({ id: "3", cantidad: "4" }));

    expect(estado).toEqual({ error: null, exito: true });
    expect(revalidatePath).toHaveBeenCalledWith("/coleccion");
  });

  it.each([
    ["texto en vez de número", { id: "3", cantidad: "abc" }],
    ["cantidad negativa", { id: "3", cantidad: "-5" }],
    ["cantidad decimal", { id: "3", cantidad: "1.5" }],
    ["cantidad sobre el máximo", { id: "3", cantidad: "10000" }],
    ["id manipulado", { id: "1 OR 1=1", cantidad: "1" }],
  ])("rechaza %s sin tocar la base", async (_, campos) => {
    const cliente = sesion();

    const estado = await guardarCantidadAccion(INICIAL, formulario(campos));

    expect(estado.exito).toBe(false);
    expect(estado.error).toBeTruthy();
    expect(cliente.from).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("eliminarAccion", () => {
  it("elimina una fila válida y refresca /coleccion", async () => {
    sesion();

    expect(await eliminarAccion(INICIAL, formulario({ id: "3" }))).toEqual({ error: null, exito: true });
    expect(revalidatePath).toHaveBeenCalledWith("/coleccion");
  });

  it("rechaza un id no numérico sin tocar la base", async () => {
    const cliente = sesion();

    const estado = await eliminarAccion(INICIAL, formulario({ id: "../../etc" }));

    expect(estado.exito).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
  });
});

describe("acciones de categorías", () => {
  it("crear una categoría válida refresca /coleccion", async () => {
    sesion();

    expect(await crearCategoriaAccion(INICIAL, formulario({ nombre: "Mis Sylveon" }))).toEqual({
      error: null,
      exito: true,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/coleccion");
  });

  it.each([
    ["crear sin nombre", () => crearCategoriaAccion(INICIAL, formulario({}))],
    ["crear con nombre en blanco", () => crearCategoriaAccion(INICIAL, formulario({ nombre: "   " }))],
    ["crear con nombre larguísimo", () => crearCategoriaAccion(INICIAL, formulario({ nombre: "x".repeat(61) }))],
    ["renombrar con id manipulado", () => renombrarCategoriaAccion(INICIAL, formulario({ id: "1 OR 1=1", nombre: "x" }))],
    ["eliminar con id no numérico", () => eliminarCategoriaAccion(INICIAL, formulario({ id: "../x" }))],
    ["marcar con carta inválida", () => alternarCategoriaAccion(INICIAL, formulario({ categoriaId: "1", inventarioId: "-4", marcar: "1" }))],
    ["desmarcar con categoría inválida", () => alternarCategoriaAccion(INICIAL, formulario({ categoriaId: "x", inventarioId: "4" }))],
  ])("rechaza %s sin tocar la base", async (_, llamar) => {
    const cliente = sesion();

    const estado = await llamar();

    expect(estado.exito).toBe(false);
    expect(estado.error).toBeTruthy();
    expect(cliente.from).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("renombrar y eliminar válidos refrescan /coleccion", async () => {
    sesion();

    expect(await renombrarCategoriaAccion(INICIAL, formulario({ id: "2", nombre: "Nuevo" }))).toEqual({ error: null, exito: true });
    expect(await eliminarCategoriaAccion(INICIAL, formulario({ id: "2" }))).toEqual({ error: null, exito: true });
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("con «marcar» asigna y sin él quita", async () => {
    const cliente = sesion();

    await alternarCategoriaAccion(INICIAL, formulario({ categoriaId: "2", inventarioId: "5", marcar: "1" }));
    await alternarCategoriaAccion(INICIAL, formulario({ categoriaId: "2", inventarioId: "5" }));

    expect(cliente.from).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });
});

describe("agregarCartaAccion", () => {
  it("agrega una carta válida", async () => {
    sesion();

    const estado = await agregarCartaAccion(
      INICIAL,
      formulario({ cartaId: "10", variante: "normal", cantidad: "1" }),
    );

    expect(estado).toEqual({ error: null, exito: true });
  });

  it.each([
    ["variante vacía", { cartaId: "10", variante: "   ", cantidad: "1" }],
    ["variante demasiado larga", { cartaId: "10", variante: "x".repeat(31), cantidad: "1" }],
    ["carta inexistente", { cartaId: "0", variante: "normal", cantidad: "1" }],
    ["cantidad cero", { cartaId: "10", variante: "normal", cantidad: "0" }],
  ])("rechaza %s sin tocar la base", async (_, campos) => {
    const cliente = sesion();

    const estado = await agregarCartaAccion(INICIAL, formulario(campos));

    expect(estado.exito).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
  });

  it("rechaza el formulario si falta la variante", async () => {
    const cliente = sesion();

    const estado = await agregarCartaAccion(INICIAL, formulario({ cartaId: "10", cantidad: "1" }));

    expect(estado.exito).toBe(false);
    expect(cliente.from).not.toHaveBeenCalled();
  });
});
