import "server-only";

import { createClient } from "@/lib/supabase/server";
import { AUDITORIA_POR_PAGINA, listarAuditoriaSchema } from "@/lib/validators/auditoria";

/**
 * Lectura de la bitácora de auditoría del lado del servidor.
 *
 * La autorización real la hace la función SQL listar_auditoria con la sesión
 * del usuario: solo un superusuario puede leer, aunque alguien llame a la Data
 * API directamente. Aquí se valida la entrada y se traducen los errores.
 * Este módulo solo lee: la bitácora es de solo inserción y la escriben los
 * triggers de la base, no la aplicación.
 */

export type RegistroAuditoria = {
  id: number;
  ocurrido_en: string;
  usuario_id: string | null;
  nombre_visible: string | null;
  accion: string;
  tabla: string;
  registro_id: string | null;
  detalle: Record<string, unknown> | null;
};

export type PaginaAuditoria = {
  registros: RegistroAuditoria[];
  total: number;
  pagina: number;
  porPagina: number;
};

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

export async function listarAuditoria(entrada: unknown): Promise<Resultado<PaginaAuditoria>> {
  const validado = listarAuditoriaSchema.safeParse(entrada);
  if (!validado.success) {
    return { ok: false, error: validado.error.issues[0].message };
  }
  const { pagina, accion } = validado.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_auditoria", {
    p_pagina: pagina,
    p_tamano: AUDITORIA_POR_PAGINA,
    p_accion: accion ?? null,
  });

  if (error) {
    if (error.code === "42501") return { ok: false, error: "No tienes permiso para ver la bitácora." };
    console.error("[auditoria] Error inesperado en listar_auditoria:", error);
    return { ok: false, error: "No se pudo cargar la bitácora." };
  }

  const filas = (data ?? []) as (RegistroAuditoria & { total: number | string })[];
  // count(*) es bigint: se normaliza por si llega como texto.
  const total = filas.length > 0 ? Number(filas[0].total) : 0;
  const registros: RegistroAuditoria[] = filas.map((fila) => ({
    id: fila.id,
    ocurrido_en: fila.ocurrido_en,
    usuario_id: fila.usuario_id,
    nombre_visible: fila.nombre_visible,
    accion: fila.accion,
    tabla: fila.tabla,
    registro_id: fila.registro_id,
    detalle: fila.detalle,
  }));

  return { ok: true, datos: { registros, total, pagina, porPagina: AUDITORIA_POR_PAGINA } };
}
