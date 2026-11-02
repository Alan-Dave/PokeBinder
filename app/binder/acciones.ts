"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import {
  cambiarPaginas,
  colocarCarta,
  crearBinder,
  eliminarBinder,
  quitarCarta,
} from "@/lib/binders";

/**
 * Acciones de servidor de /binder.
 *
 * Una Server Action es un endpoint público: cualquiera puede invocarla con
 * datos arbitrarios, no solo la interfaz. Por eso no hacen nada propio: la
 * validación, la sesión y el aislamiento por usuario viven en lib/binders.ts y
 * en RLS. Aquí solo se leen los campos del formulario.
 */

export async function crearBinderAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const resultado = await crearBinder({
    nombre: formData.get("nombre"),
    cuadricula: formData.get("cuadricula"),
    paginas: Number(formData.get("paginas") ?? 1),
  });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  // redirect lanza una excepción: va fuera de cualquier try/catch.
  redirect(`/binder/${resultado.datos.id}`);
}

export async function colocarCartaAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const binderId = Number(formData.get("binderId"));
  const resultado = await colocarCarta({
    binderId,
    pagina: Number(formData.get("pagina")),
    posicion: Number(formData.get("posicion")),
    inventarioId: Number(formData.get("inventarioId")),
  });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath(`/binder/${binderId}`);
  return { error: null, exito: true };
}

export async function quitarCartaAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const binderId = Number(formData.get("binderId"));
  const resultado = await quitarCarta({
    binderId,
    pagina: Number(formData.get("pagina")),
    posicion: Number(formData.get("posicion")),
  });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath(`/binder/${binderId}`);
  return { error: null, exito: true };
}

export async function cambiarPaginasAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const binderId = Number(formData.get("binderId"));
  const resultado = await cambiarPaginas({ binderId, paginas: Number(formData.get("paginas")) });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath(`/binder/${binderId}`);
  return { error: null, exito: true };
}

export async function eliminarBinderAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const resultado = await eliminarBinder({ binderId: Number(formData.get("binderId")) });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  redirect("/binder");
}
