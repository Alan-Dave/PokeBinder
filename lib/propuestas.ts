import "server-only";

import { randomUUID } from "node:crypto";
import { avisoPropuesta } from "@/lib/avisos";
import { enviarCorreo } from "@/lib/correo";
import { recodificarAWebp } from "@/lib/imagen-propuesta";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  aprobarPropuestaSchema,
  crearPropuestaSchema,
  rechazarPropuestaSchema,
} from "@/lib/validators/propuestas";

/**
 * Propuestas de imagen, descripción y detalles para el catálogo.
 *
 * La autorización vive en las funciones SQL (ver
 * supabase/migrations/20261104120000_propuestas_carta.sql), con la sesión de
 * quien llama. La clave secreta solo mueve archivos en buckets privados y
 * busca la dirección para avisar, y siempre después de que la base aceptó la
 * acción (o, al subir, después de comprobar la sesión).
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

export type PropuestaPendiente = {
  id: number;
  carta_id: number;
  carta_nombre: string;
  carta_idioma: string;
  nombre_visible: string;
  descripcion: string;
  detalles: string;
  creada_en: string;
  url: string | null;
};

export type MiPropuesta = {
  id: number;
  estado: "pendiente" | "aprobada" | "rechazada";
  creada_en: string;
  motivo_rechazo: string | null;
};

const BUCKET_PROPUESTAS = "Propuestas";
const BUCKET_IMAGENES = "Images";
// La bandeja se revisa en el momento: la URL no necesita durar más.
const VIGENCIA_VISTA_PREVIA_SEGUNDOS = 10 * 60;

const NO_SE_PUDO = "No se pudo completar la operación. Inténtalo de nuevo.";

const MENSAJES: Record<string, string> = {
  "42501": "No tienes permiso para realizar esta acción.",
  P0002: "La propuesta ya no está pendiente o la carta no existe.",
  "22023": "El motivo no es válido.",
  PB001: "La carta ya tiene imagen.",
  PB002: "Ya tienes 5 propuestas pendientes. Espera a que se revisen.",
};

function traducirError(codigo: string | undefined, origen: string, detalle: unknown): string {
  const mensaje = codigo ? MENSAJES[codigo] : undefined;
  if (mensaje) return mensaje;

  console.error(`[propuestas] Error inesperado en ${origen}:`, detalle);
  return NO_SE_PUDO;
}

// --------------------------------------------------------------------------
// Usuario
// --------------------------------------------------------------------------

export async function crearPropuesta(entrada: unknown): Promise<Resultado<null>> {
  const validado = crearPropuestaSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };
  const { cartaId, descripcion, detalles, archivo } = validado.data;

  // La subida usa la clave secreta: nadie sin sesión llega a ella. La base
  // vuelve a comprobar la sesión y que la cuenta esté habilitada.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Se requiere una sesión iniciada." };

  const imagen = await recodificarAWebp(new Uint8Array(await archivo.arrayBuffer()));
  if (!imagen.ok) return { ok: false, error: imagen.error };

  const ruta = `${randomUUID()}.webp`;
  const admin = createAdminClient();
  const { error: errorSubida } = await admin.storage
    .from(BUCKET_PROPUESTAS)
    .upload(ruta, imagen.webp, { contentType: "image/webp", upsert: false });
  if (errorSubida) {
    console.error("[propuestas] No se pudo subir la imagen:", errorSubida.message);
    return { ok: false, error: NO_SE_PUDO };
  }

  const { error } = await supabase.rpc("crear_propuesta", {
    p_carta_id: cartaId,
    p_imagen_path: ruta,
    p_descripcion: descripcion,
    p_detalles: detalles,
  });
  if (error) {
    // La base no aceptó la propuesta: el archivo no debe quedar huérfano.
    await borrarArchivos(BUCKET_PROPUESTAS, [ruta]);
    return { ok: false, error: traducirError(error.code, "crear_propuesta", error) };
  }

  return { ok: true, datos: null };
}

/** Propuestas del usuario actual para una carta (RLS filtra por usuario). */
export async function misPropuestas(cartaId: number): Promise<MiPropuesta[]> {
  if (!Number.isSafeInteger(cartaId) || cartaId < 1) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("propuestas_carta")
    .select("id, estado, creada_en, motivo_rechazo")
    .eq("carta_id", cartaId)
    .order("creada_en", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[propuestas] Error al leer mis propuestas:", error);
    return [];
  }
  return data as MiPropuesta[];
}

// --------------------------------------------------------------------------
// Administración
// --------------------------------------------------------------------------

export async function listarPendientes(): Promise<Resultado<PropuestaPendiente[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("listar_propuestas_pendientes");
  if (error) return { ok: false, error: traducirError(error.code, "listar_propuestas_pendientes", error) };

  const filas = (data ?? []) as (Omit<PropuestaPendiente, "url"> & { imagen_path: string })[];
  if (filas.length === 0) return { ok: true, datos: [] };

  // Recién acá, con la base ya habiendo aceptado al administrador, se firman
  // las vistas previas del bucket privado.
  const { data: firmadas, error: errorFirma } = await createAdminClient()
    .storage.from(BUCKET_PROPUESTAS)
    .createSignedUrls(
      filas.map((f) => f.imagen_path),
      VIGENCIA_VISTA_PREVIA_SEGUNDOS,
    );
  if (errorFirma) console.error("[propuestas] No se pudieron firmar las vistas previas:", errorFirma.message);

  return {
    ok: true,
    // La ruta interna del bucket no sale del servidor: solo la URL firmada.
    datos: filas.map((fila, i) => ({
      id: fila.id,
      carta_id: fila.carta_id,
      carta_nombre: fila.carta_nombre,
      carta_idioma: fila.carta_idioma,
      nombre_visible: fila.nombre_visible,
      descripcion: fila.descripcion,
      detalles: fila.detalles,
      creada_en: fila.creada_en,
      url: firmadas?.[i]?.signedUrl ?? null,
    })),
  };
}

export async function aprobarPropuesta(entrada: unknown): Promise<Resultado<null>> {
  const validado = aprobarPropuestaSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };
  const { propuestaId } = validado.data;

  const supabase = await createClient();

  // 1. La base autoriza y dice qué copiar y adónde. No cambia nada todavía.
  const { data: plan, error: errorPlan } = await supabase.rpc("preparar_aprobacion", {
    p_propuesta_id: propuestaId,
  });
  if (errorPlan) return { ok: false, error: traducirError(errorPlan.code, "preparar_aprobacion", errorPlan) };
  const { origen, destino } = (plan as { origen: string; destino: string }[])[0];

  // 2. Copia al bucket del catálogo. Images también es privado: la ficha de
  //    la carta firma la URL al mostrarla, igual que las demás imágenes.
  const admin = createAdminClient();
  const { error: errorCopia } = await admin.storage
    .from(BUCKET_PROPUESTAS)
    .copy(origen, destino, { destinationBucket: BUCKET_IMAGENES });
  if (errorCopia) {
    console.error("[propuestas] No se pudo copiar la imagen al catálogo:", errorCopia.message);
    return { ok: false, error: NO_SE_PUDO };
  }

  // 3. Publica. La base vuelve a verificar todo con bloqueo.
  const { data: avisos, error } = await supabase.rpc("aprobar_propuesta", { p_propuesta_id: propuestaId });
  if (error) {
    await borrarArchivos(BUCKET_IMAGENES, [destino]);
    return { ok: false, error: traducirError(error.code, "aprobar_propuesta", error) };
  }

  const filas = (avisos ?? []) as { usuario_id: string; aprobada: boolean; imagen_path: string }[];
  // El archivo aprobado ya está en Images; los de las demás propuestas de la
  // misma carta (rechazadas solas) tampoco se van a usar.
  await borrarArchivos(BUCKET_PROPUESTAS, filas.map((f) => f.imagen_path));
  for (const fila of filas) {
    await avisar(fila.usuario_id, avisoPropuesta({
      aprobada: fila.aprobada,
      motivo: fila.aprobada ? null : "La carta ya tiene imagen.",
    }));
  }

  return { ok: true, datos: null };
}

export async function rechazarPropuesta(entrada: unknown): Promise<Resultado<null>> {
  const validado = rechazarPropuestaSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };
  const { propuestaId, motivo } = validado.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rechazar_propuesta", {
    p_propuesta_id: propuestaId,
    p_motivo: motivo,
  });
  if (error) return { ok: false, error: traducirError(error.code, "rechazar_propuesta", error) };

  const [fila] = (data ?? []) as { usuario_id: string; imagen_path: string }[];
  if (fila) {
    await borrarArchivos(BUCKET_PROPUESTAS, [fila.imagen_path]);
    await avisar(fila.usuario_id, avisoPropuesta({ aprobada: false, motivo }));
  }

  return { ok: true, datos: null };
}

// --------------------------------------------------------------------------
// Auxiliares
// --------------------------------------------------------------------------

// Un archivo que no se pudo borrar ocupa espacio en un bucket privado, nada
// más: se registra y la acción sigue.
async function borrarArchivos(bucket: string, rutas: string[]): Promise<void> {
  if (rutas.length === 0) return;
  const { error } = await createAdminClient().storage.from(bucket).remove(rutas);
  if (error) console.error(`[propuestas] No se pudieron borrar archivos de ${bucket}:`, error.message);
}

// El aviso es un extra: si no sale, la revisión ya quedó hecha.
async function avisar(usuarioId: string, aviso: { asunto: string; texto: string; html: string }): Promise<void> {
  const { data, error } = await createAdminClient().auth.admin.getUserById(usuarioId);
  const correo = data?.user?.email;
  if (error || !correo) {
    console.error(`[propuestas] Sin dirección para avisar (código: ${error?.code ?? "sin correo"}).`);
    return;
  }
  await enviarCorreo({ para: correo, ...aviso });
}
