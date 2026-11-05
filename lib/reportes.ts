import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  cambiarEstadoReporteSchema,
  crearReporteSchema,
  listarReportesSchema,
  type EstadoReporte,
  type MotivoReporte,
} from "@/lib/validators/reportes";

/**
 * Reportes de errores del catálogo (PBI-31).
 *
 * La autorización real la hace RLS sobre public.reportes_catalogo: cada usuario
 * crea y ve solo los suyos, y solo administradores y superusuarios ven todos y
 * cambian el estado (solo esa columna). usuario_id sale de auth.uid() por
 * defecto: estas funciones nunca lo reciben. Aquí se valida la entrada y se
 * traducen los errores de la base.
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

export type Reporte = {
  id: number;
  motivo: MotivoReporte;
  detalle: string;
  estado: EstadoReporte;
  creado_en: string;
  cartas: { id: number; nombre: string; id_api: string } | null;
};

export const SIN_SESION = "Se requiere una sesión iniciada.";

const MENSAJES: Record<string, string> = {
  "23505": "Ya enviaste un reporte abierto de ese tipo para esta carta.",
  "23514": "No se pudo enviar: revisa los datos o espera, hay un máximo de 20 reportes por día.",
  "23503": "La carta no existe.",
  "42501": "No tienes permiso para realizar esta acción.",
};

function traducirError(codigo: string | undefined, origen: string, detalle: unknown): string {
  const mensaje = codigo ? MENSAJES[codigo] : undefined;
  if (mensaje) return mensaje;

  console.error(`[reportes] Error inesperado en ${origen}:`, detalle);
  return "No se pudo completar la operación.";
}

async function usuarioActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function crearReporte(entrada: unknown): Promise<Resultado<null>> {
  const validado = crearReporteSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  // usuario_id y estado toman su valor por defecto en la base.
  const { error } = await supabase.from("reportes_catalogo").insert({
    carta_id: validado.data.cartaId,
    motivo: validado.data.motivo,
    detalle: validado.data.detalle,
  });
  if (error) return { ok: false, error: traducirError(error.code, "crear", error) };
  return { ok: true, datos: null };
}

/** Si la persona puede revisar reportes. Solo para decidir qué pantalla mostrar: RLS decide de verdad. */
export async function puedeRevisarReportes(): Promise<boolean> {
  const { supabase, user } = await usuarioActual();
  if (!user) return false;

  const { data } = await supabase.from("perfiles").select("rol").eq("id", user.id).maybeSingle();
  return data?.rol === "administrador" || data?.rol === "superusuario";
}

export async function listarReportes(entrada: unknown = {}): Promise<Resultado<Reporte[]>> {
  const validado = listarReportesSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  // RLS: un administrador recibe los de todos; cualquier otro, solo los suyos.
  const { data, error } = await supabase
    .from("reportes_catalogo")
    .select("id, motivo, detalle, estado, creado_en, cartas(id, nombre, id_api)")
    .eq("estado", validado.data.estado)
    .order("creado_en", { ascending: false })
    .limit(100);
  if (error) return { ok: false, error: traducirError(error.code, "listar", error) };
  return { ok: true, datos: data as unknown as Reporte[] };
}

export async function cambiarEstadoReporte(entrada: unknown): Promise<Resultado<null>> {
  const validado = cambiarEstadoReporteSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const { supabase, user } = await usuarioActual();
  if (!user) return { ok: false, error: SIN_SESION };

  // Si no eres administrador, RLS oculta la fila y no se actualiza nada.
  const { data, error } = await supabase
    .from("reportes_catalogo")
    .update({ estado: validado.data.estado })
    .eq("id", validado.data.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: traducirError(error.code, "cambiar estado", error) };
  if (!data) return { ok: false, error: "El reporte no existe o no tienes permiso para cambiarlo." };
  return { ok: true, datos: null };
}
