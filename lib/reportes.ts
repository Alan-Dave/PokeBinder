import "server-only";

import { type Archivo, construirArchivo } from "@/lib/archivo";
import { consultarInventario } from "@/lib/inventario-filtrado";
import { calcularFaltantes, type CartaSet, type Faltantes, type FilaResumen, resumirInventario, type ResumenInventario } from "@/lib/resumen";
import { createClient } from "@/lib/supabase/server";
import { patronPrefijo } from "@/lib/validators/catalogo";
import { filtrosInventarioSchema } from "@/lib/validators/filtros";
import { exportarFaltantesSchema, faltantesSchema } from "@/lib/validators/reportes";

/**
 * Reportes de inventario y de cartas faltantes (PBI-21).
 *
 * Solo lectura. El aislamiento entre usuarios lo garantiza RLS sobre
 * public.inventario (usuario_id = auth.uid()); el catálogo es público. Los
 * parámetros del usuario (set e idioma) se validan con zod y viajan como
 * parámetros de la consulta, nunca concatenados.
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

export const SIN_SESION = "Se requiere una sesión iniciada.";

const BLOQUE = 1000;
// Tope de seguridad: un reporte no puede crecer sin límite en memoria.
export const FILAS_MAX = 50_000;

// PostgREST responde como mucho 1.000 filas por consulta; un set tiene menos.
const CARTAS_SET_MAX = 1000;

const FALLO = "No se pudo generar el reporte.";

export type ResumenConNombres = ResumenInventario & {
  /** Nombre del set por «id|idioma»; falta si el catálogo no lo trae. */
  nombresSet: Record<string, string>;
};

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function obtenerResumenInventario(entrada: unknown = {}): Promise<Resultado<ResumenConNombres>> {
  const validado = filtrosInventarioSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const filas: (FilaResumen & { carta_id: number })[] = [];
  for (let desde = 0; desde < FILAS_MAX; desde += BLOQUE) {
    const { data, error } = await consultarInventario(
      supabase,
      "carta_id, cantidad, cartas!inner(set_id, idioma, price)",
      validado.data,
    ).range(desde, desde + BLOQUE - 1);

    if (error) {
      console.error("[reportes] Error inesperado al leer el inventario:", error);
      return { ok: false, error: FALLO };
    }
    const bloque = data as unknown as (FilaResumen & { carta_id: number })[];
    filas.push(...bloque);
    if (bloque.length < BLOQUE) break;
  }

  const resumen = resumirInventario(filas);

  const nombresSet: Record<string, string> = {};
  const ids = [...new Set(resumen.porSet.map((s) => s.setId))];
  if (ids.length > 0) {
    const { data, error } = await supabase.from("sets").select("id, idioma, nombre").in("id", ids);
    if (error) {
      console.error("[reportes] Error inesperado al leer los sets:", error);
      return { ok: false, error: FALLO };
    }
    for (const s of data ?? []) if (s.nombre) nombresSet[`${s.id}|${s.idioma}`] = s.nombre;
  }

  return { ok: true, datos: { ...resumen, nombresSet } };
}

export type ReporteFaltantes = Faltantes & { setId: string; idioma: string; nombreSet: string | null };

function cartasDelSet(
  supabase: Awaited<ReturnType<typeof createClient>>,
  setId: string,
  idioma: string,
  rareza: string | undefined,
) {
  let consulta = supabase.from("cartas").select("id, nombre, number, rarity").eq("set_id", setId).eq("idioma", idioma);
  if (rareza) consulta = consulta.ilike("rarity", patronPrefijo(rareza));
  return consulta.limit(CARTAS_SET_MAX);
}

async function faltantesDe(
  entrada: { setId: string; idioma: string; rareza?: string },
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Resultado<ReporteFaltantes>> {
  const { setId, idioma, rareza } = entrada;

  const [cartas, poseidas, set] = await Promise.all([
    cartasDelSet(supabase, setId, idioma, rareza),
    supabase
      .from("inventario")
      .select("carta_id, cartas!inner(set_id, idioma)")
      .eq("cartas.set_id", setId)
      .eq("cartas.idioma", idioma)
      .limit(CARTAS_SET_MAX),
    supabase.from("sets").select("nombre").eq("id", setId).eq("idioma", idioma).maybeSingle(),
  ]);

  const fallo = cartas.error ?? poseidas.error ?? set.error;
  if (fallo) {
    console.error("[reportes] Error inesperado al calcular los faltantes:", fallo);
    return { ok: false, error: FALLO };
  }
  if (!cartas.data || cartas.data.length === 0) {
    return { ok: false, error: rareza ? "No hay cartas de ese set con esa rareza." : "No existe ese set en ese idioma." };
  }

  const ids = new Set((poseidas.data as unknown as { carta_id: number }[]).map((f) => f.carta_id));
  const faltantes = calcularFaltantes(cartas.data as CartaSet[], ids);
  return { ok: true, datos: { ...faltantes, setId, idioma, nombreSet: set.data?.nombre ?? null } };
}

export async function obtenerFaltantes(entrada: unknown): Promise<Resultado<ReporteFaltantes>> {
  const validado = faltantesSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  return faltantesDe(validado.data, supabase);
}

const ENCABEZADOS_FALTANTES = ["Número", "Nombre", "Rareza"] as const;

export async function exportarFaltantes(entrada: unknown): Promise<Resultado<Archivo>> {
  // La sesión se comprueba ANTES de validar: un visitante sin sesión recibe 401
  // aunque sus parámetros estén incompletos, y no se le explica qué faltó.
  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  const validado = exportarFaltantesSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const resultado = await faltantesDe(validado.data, supabase);
  if (!resultado.ok) return resultado;

  const { formato, setId, idioma } = validado.data;
  const filas = resultado.datos.faltan.map((c) => [c.number, c.nombre, c.rarity]);
  // setId e idioma ya pasaron la validación (solo letras, dígitos y . _ -): el
  // nombre del archivo no puede traer separadores de ruta ni comillas.
  const archivo = await construirArchivo(formato, `faltantes-${setId}-${idioma}`, "Faltantes", ENCABEZADOS_FALTANTES, filas);
  return { ok: true, datos: archivo };
}
