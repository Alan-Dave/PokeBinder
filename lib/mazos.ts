import "server-only";

import { createClient } from "@/lib/supabase/server";
import { calcularCobertura, type CoberturaCarta } from "@/lib/cobertura";
import { validarMazo, type ResultadoReglas } from "@/lib/reglas-mazo";
import {
  agregarCartaAlMazoSchema,
  CANTIDAD_MAZO_MAX,
  crearMazoSchema,
  cruzarMazoSchema,
  eliminarMazoSchema,
  fijarCantidadEnMazoSchema,
  obtenerMazoSchema,
  quitarDelMazoSchema,
} from "@/lib/validators/mazos";

/**
 * Cruce de un mazo contra el inventario real del usuario (PBI-17).
 *
 * Es una consulta de solo lectura: no modifica ni el mazo ni el inventario.
 * RLS ya impide leer mazo_cartas de un mazo ajeno, pero igual se verifica acá
 * el dueño del mazo de forma explícita: si en algún momento se agrega un
 * camino de lectura distinto (una vista, una función con más privilegios),
 * este chequeo no depende de que RLS siga cubriendo ese camino nuevo.
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

export async function obtenerCoberturaMazo(entrada: unknown): Promise<Resultado<CoberturaCarta[]>> {
  const validado = cruzarMazoSchema.safeParse(entrada);
  if (!validado.success) {
    return { ok: false, error: validado.error.issues[0].message };
  }
  const { mazoId } = validado.data;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Se requiere una sesión iniciada." };
  }

  const { data: mazo, error: errorMazo } = await supabase
    .from("mazos")
    .select("id, usuario_id")
    .eq("id", mazoId)
    .maybeSingle();

  if (errorMazo) {
    console.error("[mazos] Error al leer el mazo:", errorMazo);
    return { ok: false, error: "No se pudo obtener el mazo." };
  }
  // maybeSingle no distingue "no existe" de "existe pero es de otro usuario"
  // (RLS ya filtra esa segunda opción): el mensaje es el mismo a propósito,
  // para no confirmarle a nadie que un id de mazo ajeno existe.
  if (!mazo || mazo.usuario_id !== user.id) {
    return { ok: false, error: "El mazo no existe o no te pertenece." };
  }

  const { data: mazoCartas, error: errorMazoCartas } = await supabase
    .from("mazo_cartas")
    .select("carta_id, cantidad")
    .eq("mazo_id", mazoId);

  if (errorMazoCartas) {
    console.error("[mazos] Error al leer mazo_cartas:", errorMazoCartas);
    return { ok: false, error: "No se pudo obtener el mazo." };
  }
  if (!mazoCartas || mazoCartas.length === 0) {
    return { ok: true, datos: [] };
  }

  const cartaIds = [...new Set(mazoCartas.map((c) => c.carta_id))];
  const { data: filasInventario, error: errorInventario } = await supabase
    .from("inventario")
    .select("carta_id, cantidad")
    .eq("usuario_id", user.id)
    .in("carta_id", cartaIds);

  if (errorInventario) {
    console.error("[mazos] Error al leer el inventario:", errorInventario);
    return { ok: false, error: "No se pudo obtener el inventario." };
  }

  // Una carta puede tener varias filas de inventario (una por variante:
  // normal, reverse, holo...); a la cobertura le importa el total, no qué
  // variante es cada copia.
  const inventarioPorCarta = new Map<number, number>();
  for (const fila of filasInventario ?? []) {
    inventarioPorCarta.set(fila.carta_id, (inventarioPorCarta.get(fila.carta_id) ?? 0) + fila.cantidad);
  }
  const inventarioSumado = [...inventarioPorCarta.entries()].map(([carta_id, cantidad]) => ({
    carta_id,
    cantidad,
  }));

  return { ok: true, datos: calcularCobertura(mazoCartas, inventarioSumado) };
}


// ---------------------------------------------------------------------------
// Constructor de mazos (PBI-16)
// ---------------------------------------------------------------------------
//
// El aislamiento entre usuarios lo garantiza RLS sobre mazos y mazo_cartas
// (using y with check por dueño); usuario_id toma su valor de auth.uid() por
// defecto, así que estas funciones nunca lo reciben ni lo envían.

export const SIN_SESION = "Se requiere una sesión iniciada.";
// Mismo mensaje si el mazo no existe o es de otro usuario (RLS lo oculta).
const MAZO_NO_ENCONTRADO = "El mazo no existe o no te pertenece.";

const MENSAJES: Record<string, string> = {
  "23503": "El mazo o la carta no existe.",
  "23514": `La cantidad de una carta debe estar entre 1 y ${CANTIDAD_MAZO_MAX}.`,
  "42501": "No tienes permiso para realizar esta acción.",
};

function traducirError(codigo: string | undefined, origen: string, detalle: unknown): string {
  const mensaje = codigo ? MENSAJES[codigo] : undefined;
  if (mensaje) return mensaje;

  console.error(`[mazos] Error inesperado en ${origen}:`, detalle);
  return "No se pudo completar la operación.";
}

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export type ResumenMazo = { id: number; nombre: string; totalCartas: number };

export type LineaMazo = {
  cartaId: number;
  cantidad: number;
  nombre: string;
  idApi: string;
  idioma: string;
  /** Etapa propia o, si falta, la de la edición en inglés. */
  stage: string | null;
};

export type MazoDetalle = {
  mazo: { id: number; nombre: string };
  lineas: LineaMazo[];
  reglas: ResultadoReglas;
};

export async function crearMazo(entrada: unknown): Promise<Resultado<{ id: number }>> {
  const validado = crearMazoSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { data, error } = await supabase.from("mazos").insert({ nombre: validado.data.nombre }).select("id").single();

  if (error) return { ok: false, error: traducirError(error.code, "crear", error) };
  return { ok: true, datos: { id: data.id } };
}

export async function listarMazos(): Promise<Resultado<ResumenMazo[]>> {
  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { data, error } = await supabase
    .from("mazos")
    .select("id, nombre, mazo_cartas(cantidad)")
    .order("creado_en", { ascending: false });

  if (error) return { ok: false, error: traducirError(error.code, "listar", error) };

  const filas = data as unknown as { id: number; nombre: string; mazo_cartas: { cantidad: number }[] }[];
  return {
    ok: true,
    datos: filas.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      totalCartas: f.mazo_cartas.reduce((suma, c) => suma + c.cantidad, 0),
    })),
  };
}

type FilaMazoCarta = {
  carta_id: number;
  cantidad: number;
  cartas: { id_api: string; idioma: string; nombre: string; stage: string | null; subtipos: string[] } | null;
};

export async function obtenerMazo(entrada: unknown): Promise<Resultado<MazoDetalle>> {
  const validado = obtenerMazoSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { mazoId } = validado.data;
  const { data: mazo, error: errorMazo } = await supabase
    .from("mazos")
    .select("id, nombre")
    .eq("id", mazoId)
    .maybeSingle();

  if (errorMazo) return { ok: false, error: traducirError(errorMazo.code, "obtener", errorMazo) };
  if (!mazo) return { ok: false, error: MAZO_NO_ENCONTRADO };

  const { data, error } = await supabase
    .from("mazo_cartas")
    .select("carta_id, cantidad, cartas(id_api, idioma, nombre, stage, subtipos)")
    .eq("mazo_id", mazoId);

  if (error) return { ok: false, error: traducirError(error.code, "obtener", error) };

  const filas = (data as unknown as FilaMazoCarta[]).filter(
    (f): f is FilaMazoCarta & { cartas: NonNullable<FilaMazoCarta["cartas"]> } => f.cartas !== null,
  );

  // Solo las cartas en inglés traen etapa y subtipos, y el id_api es el mismo en
  // todos los idiomas: se completan los datos que falten con la edición en inglés.
  const edicionEn = new Map<string, { nombre: string; stage: string | null; subtipos: string[] }>();
  if (filas.length > 0) {
    const idsApi = [...new Set(filas.map((f) => f.cartas.id_api))];
    const { data: ingles, error: errorIngles } = await supabase
      .from("cartas")
      .select("id_api, nombre, stage, subtipos")
      .eq("idioma", "en")
      .in("id_api", idsApi);

    if (errorIngles) return { ok: false, error: traducirError(errorIngles.code, "obtener", errorIngles) };
    for (const c of ingles as { id_api: string; nombre: string; stage: string | null; subtipos: string[] }[]) {
      edicionEn.set(c.id_api, { nombre: c.nombre, stage: c.stage, subtipos: c.subtipos });
    }
  }

  const lineas: LineaMazo[] = [];
  const entradas = filas.map((f) => {
    const en = edicionEn.get(f.cartas.id_api);
    const stage = f.cartas.stage ?? en?.stage ?? null;
    lineas.push({
      cartaId: f.carta_id,
      cantidad: f.cantidad,
      nombre: f.cartas.nombre,
      idApi: f.cartas.id_api,
      idioma: f.cartas.idioma,
      stage,
    });
    return {
      cartaId: f.carta_id,
      cantidad: f.cantidad,
      nombre: f.cartas.nombre,
      nombreEn: en?.nombre ?? null,
      stage,
      subtipos: f.cartas.subtipos.length > 0 ? f.cartas.subtipos : (en?.subtipos ?? []),
    };
  });

  lineas.sort((a, b) => a.nombre.localeCompare(b.nombre));
  return { ok: true, datos: { mazo: { id: mazo.id, nombre: mazo.nombre }, lineas, reglas: validarMazo(entradas) } };
}

export async function fijarCantidadEnMazo(entrada: unknown): Promise<Resultado<null>> {
  const validado = fijarCantidadEnMazoSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { mazoId, cartaId, cantidad } = validado.data;
  const { error } = await supabase
    .from("mazo_cartas")
    .upsert({ mazo_id: mazoId, carta_id: cartaId, cantidad }, { onConflict: "mazo_id,carta_id" });

  if (error) return { ok: false, error: traducirError(error.code, "fijarCantidad", error) };
  return { ok: true, datos: null };
}

/** Suma una copia de la carta al mazo, sin pasar de lo que admite la base. */
export async function agregarCartaAlMazo(entrada: unknown): Promise<Resultado<null>> {
  const validado = agregarCartaAlMazoSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { mazoId, cartaId } = validado.data;
  const { data: actual, error: errorLectura } = await supabase
    .from("mazo_cartas")
    .select("cantidad")
    .eq("mazo_id", mazoId)
    .eq("carta_id", cartaId)
    .maybeSingle();

  if (errorLectura) return { ok: false, error: traducirError(errorLectura.code, "agregar", errorLectura) };

  const cantidad = Math.min((actual?.cantidad ?? 0) + 1, CANTIDAD_MAZO_MAX);
  const { error } = await supabase
    .from("mazo_cartas")
    .upsert({ mazo_id: mazoId, carta_id: cartaId, cantidad }, { onConflict: "mazo_id,carta_id" });

  if (error) return { ok: false, error: traducirError(error.code, "agregar", error) };
  return { ok: true, datos: null };
}

export async function quitarDelMazo(entrada: unknown): Promise<Resultado<null>> {
  const validado = quitarDelMazoSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { mazoId, cartaId } = validado.data;
  const { error } = await supabase.from("mazo_cartas").delete().eq("mazo_id", mazoId).eq("carta_id", cartaId);

  if (error) return { ok: false, error: traducirError(error.code, "quitar", error) };
  return { ok: true, datos: null };
}

export async function eliminarMazo(entrada: unknown): Promise<Resultado<null>> {
  const validado = eliminarMazoSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const { data, error } = await supabase
    .from("mazos")
    .delete()
    .eq("id", validado.data.mazoId)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: traducirError(error.code, "eliminar", error) };
  if (!data) return { ok: false, error: MAZO_NO_ENCONTRADO };
  return { ok: true, datos: null };
}
