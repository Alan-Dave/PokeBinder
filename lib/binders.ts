import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  cambiarPaginasSchema,
  colocarCartaSchema,
  crearBinderSchema,
  cuadriculaDe,
  dimensionesDe,
  eliminarBinderSchema,
  moverCartaSchema,
  obtenerBinderSchema,
  quitarCartaSchema,
  type Cuadricula,
} from "@/lib/validators/binders";

/**
 * Binder virtual del usuario (PBI-14).
 *
 * Igual que el inventario: el aislamiento entre usuarios lo garantiza RLS
 * (using y with check en binders y binder_casillas) y usuario_id toma su valor
 * de auth.uid() por defecto, así que aquí nunca se recibe ni se envía. Que la
 * carta de una casilla sea del inventario del propio usuario y que la casilla
 * quepa en la cuadrícula también lo decide la base (política y trigger).
 * Aquí se valida la entrada y se traducen los errores.
 *
 * El binder pagina por páginas del propio binder (2x2 a 4x4), no de 30 en 30
 * como el catálogo: son paginaciones distintas y no comparten nada.
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

export type Binder = {
  id: number;
  nombre: string;
  cuadricula: Cuadricula;
  filas: number;
  columnas: number;
  paginas: number;
};

export type CasillaBinder = {
  posicion: number;
  inventarioId: number;
  cartaId: number;
  variante: string;
  nombre: string;
  idApi: string;
  idioma: string;
};

export type BinderConPagina = {
  binder: Binder;
  pagina: number;
  casillas: CasillaBinder[];
};

export const SIN_SESION = "Se requiere una sesión iniciada.";
// Mismo mensaje si el binder no existe o es de otro usuario (RLS lo oculta).
const NO_ENCONTRADO = "El binder no existe o no te pertenece.";

const CASILLA_OCUPADA = "Esa casilla ya está ocupada. Quita su carta o elige una casilla vacía.";

const MENSAJES: Record<string, string> = {
  "23505": "Ya tienes un binder con ese nombre.",
  "23514": "Esa casilla no existe en el binder, o el tamaño no es válido.",
  "23503": "El binder o la carta no existe.",
  // Código propio de la migración binders_copias: la carta ya ocupa tantas casillas como copias tienes.
  PB001: "Ya pusiste todas tus copias de esa carta en el binder. Quita una de otra casilla para usarla aquí.",
  "42501": "No tienes permiso para realizar esta acción.",
};

function traducirError(codigo: string | undefined, origen: string, detalle: unknown): string {
  const mensaje = codigo ? MENSAJES[codigo] : undefined;
  if (mensaje) return mensaje;

  console.error(`[binders] Error inesperado en ${origen}:`, detalle);
  return "No se pudo completar la operación.";
}

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

type FilaBinder = { id: number; nombre: string; filas: number; columnas: number; paginas: number };

function aBinder(fila: FilaBinder): Binder | null {
  // Si la base trajera una cuadrícula fuera de la lista, no se muestra.
  const cuadricula = cuadriculaDe(fila.filas, fila.columnas);
  if (!cuadricula) return null;
  return { ...fila, cuadricula };
}

export async function crearBinder(entrada: unknown): Promise<Resultado<{ id: number }>> {
  const validado = crearBinderSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { nombre, cuadricula, paginas } = validado.data;
  const { filas, columnas } = dimensionesDe(cuadricula);
  const { data, error } = await supabase
    .from("binders")
    .insert({ nombre, filas, columnas, paginas })
    .select("id")
    .single();

  if (error) return { ok: false, error: traducirError(error.code, "crear", error) };
  return { ok: true, datos: { id: data.id } };
}

export async function listarBinders(): Promise<Resultado<Binder[]>> {
  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { data, error } = await supabase
    .from("binders")
    .select("id, nombre, filas, columnas, paginas")
    .order("id");

  if (error) return { ok: false, error: traducirError(error.code, "listar", error) };
  const binders = (data as FilaBinder[]).map(aBinder).filter((b): b is Binder => b !== null);
  return { ok: true, datos: binders };
}

type FilaCasilla = {
  posicion: number;
  inventario: {
    id: number;
    carta_id: number;
    variante: string;
    cartas: { id_api: string; nombre: string; idioma: string } | null;
  } | null;
};

export async function obtenerBinder(entrada: unknown): Promise<Resultado<BinderConPagina>> {
  const validado = obtenerBinderSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { binderId, pagina } = validado.data;
  const { data: fila, error: errorBinder } = await supabase
    .from("binders")
    .select("id, nombre, filas, columnas, paginas")
    .eq("id", binderId)
    .maybeSingle();

  if (errorBinder) return { ok: false, error: traducirError(errorBinder.code, "obtener", errorBinder) };
  const binder = fila ? aBinder(fila as FilaBinder) : null;
  if (!binder) return { ok: false, error: NO_ENCONTRADO };
  if (pagina > binder.paginas) {
    return { ok: false, error: `El binder tiene ${binder.paginas} páginas.` };
  }

  const { data, error } = await supabase
    .from("binder_casillas")
    .select("posicion, inventario(id, carta_id, variante, cartas(id_api, nombre, idioma))")
    .eq("binder_id", binderId)
    .eq("pagina", pagina)
    .order("posicion");

  if (error) return { ok: false, error: traducirError(error.code, "obtener", error) };

  const casillas = (data as unknown as FilaCasilla[]).flatMap((c) =>
    c.inventario && c.inventario.cartas
      ? [
          {
            posicion: c.posicion,
            inventarioId: c.inventario.id,
            cartaId: c.inventario.carta_id,
            variante: c.inventario.variante,
            nombre: c.inventario.cartas.nombre,
            idApi: c.inventario.cartas.id_api,
            idioma: c.inventario.cartas.idioma,
          },
        ]
      : [],
  );
  return { ok: true, datos: { binder, pagina, casillas } };
}

export async function colocarCarta(entrada: unknown): Promise<Resultado<null>> {
  const validado = colocarCartaSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { binderId, pagina, posicion, inventarioId } = validado.data;
  // upsert: poner una carta en una casilla ocupada la reemplaza.
  const { error } = await supabase
    .from("binder_casillas")
    .upsert(
      { binder_id: binderId, pagina, posicion, inventario_id: inventarioId },
      { onConflict: "binder_id,pagina,posicion" },
    );

  if (error) return { ok: false, error: traducirError(error.code, "colocar", error) };
  return { ok: true, datos: null };
}

export async function moverCarta(entrada: unknown): Promise<Resultado<null>> {
  const validado = moverCartaSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { binderId, pagina, desde, hasta } = validado.data;
  // Cambiar solo la posición no toca inventario_id: no cambia cuántas copias
  // están en uso. Si el destino está ocupado, la clave primaria (23505) lo
  // rechaza: mover nunca reemplaza ni borra otra carta.
  const { data, error } = await supabase
    .from("binder_casillas")
    .update({ posicion: hasta })
    .eq("binder_id", binderId)
    .eq("pagina", pagina)
    .eq("posicion", desde)
    .select("posicion")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? CASILLA_OCUPADA : traducirError(error.code, "mover", error),
    };
  }
  if (!data) return { ok: false, error: "La casilla de origen está vacía." };
  return { ok: true, datos: null };
}

export async function quitarCarta(entrada: unknown): Promise<Resultado<null>> {
  const validado = quitarCartaSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { binderId, pagina, posicion } = validado.data;
  const { error } = await supabase
    .from("binder_casillas")
    .delete()
    .eq("binder_id", binderId)
    .eq("pagina", pagina)
    .eq("posicion", posicion);

  if (error) return { ok: false, error: traducirError(error.code, "quitar", error) };
  return { ok: true, datos: null };
}

export async function cambiarPaginas(entrada: unknown): Promise<Resultado<null>> {
  const validado = cambiarPaginasSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { binderId, paginas } = validado.data;
  const { data, error } = await supabase
    .from("binders")
    .update({ paginas })
    .eq("id", binderId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: traducirError(error.code, "cambiarPaginas", error) };
  if (!data) return { ok: false, error: NO_ENCONTRADO };
  return { ok: true, datos: null };
}

export async function eliminarBinder(entrada: unknown): Promise<Resultado<null>> {
  const validado = eliminarBinderSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { data, error } = await supabase
    .from("binders")
    .delete()
    .eq("id", validado.data.binderId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: traducirError(error.code, "eliminar", error) };
  if (!data) return { ok: false, error: NO_ENCONTRADO };
  return { ok: true, datos: null };
}

export type OpcionInventario = { id: number; variante: string; nombre: string; idApi: string };

// Tope de la lista desplegable de la casilla: un <select> con miles de
// opciones no se puede usar. Ordenado por nombre para encontrar cartas.
export const OPCIONES_INVENTARIO_MAX = 300;

/** Cartas del inventario del usuario para elegir en una casilla. */
export async function listarOpcionesInventario(): Promise<Resultado<OpcionInventario[]>> {
  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { data, error } = await supabase
    .from("inventario")
    .select("id, variante, cartas(id_api, nombre)")
    .order("id")
    .limit(OPCIONES_INVENTARIO_MAX);

  if (error) return { ok: false, error: traducirError(error.code, "opciones", error) };

  const filas = data as unknown as Array<{
    id: number;
    variante: string;
    cartas: { id_api: string; nombre: string } | null;
  }>;
  const opciones = filas
    .flatMap((f) =>
      f.cartas ? [{ id: f.id, variante: f.variante, nombre: f.cartas.nombre, idApi: f.cartas.id_api }] : [],
    )
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  return { ok: true, datos: opciones };
}
