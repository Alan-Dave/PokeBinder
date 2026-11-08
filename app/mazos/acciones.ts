"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import {
  agregarCartaAlMazo,
  crearMazo,
  eliminarMazo,
  fijarCantidadEnMazo,
  quitarDelMazo,
} from "@/lib/mazos";

/**
 * Acciones de servidor de /mazos.
 *
 * Una Server Action es un endpoint público: cualquiera puede invocarla con
 * datos arbitrarios, no solo la interfaz. Por eso no hacen nada propio: la
 * validación, la sesión y el aislamiento por usuario viven en lib/mazos.ts y
 * en RLS. Aquí solo se leen los campos del formulario.
 */

// Number(null) y Number("") dan 0, y un 0 puede pasar por un campo válido: un
// campo ausente o vacío llega como NaN y el esquema lo rechaza con su mensaje.
function numero(valor: FormDataEntryValue | null): number {
  return valor === null || valor === "" ? Number.NaN : Number(valor);
}

export async function crearMazoAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const resultado = await crearMazo({ nombre: formData.get("nombre") });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  // redirect lanza una excepción: va fuera de cualquier try/catch.
  redirect(`/mazos/${resultado.datos.id}`);
}

export async function agregarCartaAlMazoAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const mazoId = numero(formData.get("mazoId"));
  const resultado = await agregarCartaAlMazo({ mazoId, cartaId: numero(formData.get("cartaId")) });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath(`/mazos/${mazoId}`);
  return { error: null, exito: true };
}

export async function fijarCantidadEnMazoAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const mazoId = numero(formData.get("mazoId"));
  const resultado = await fijarCantidadEnMazo({
    mazoId,
    cartaId: numero(formData.get("cartaId")),
    cantidad: numero(formData.get("cantidad")),
  });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath(`/mazos/${mazoId}`);
  return { error: null, exito: true };
}

export async function quitarDelMazoAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const mazoId = numero(formData.get("mazoId"));
  const resultado = await quitarDelMazo({ mazoId, cartaId: numero(formData.get("cartaId")) });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath(`/mazos/${mazoId}`);
  return { error: null, exito: true };
}

export async function eliminarMazoAccion(_previo: EstadoAccion, formData: FormData): Promise<EstadoAccion> {
  const resultado = await eliminarMazo({ mazoId: numero(formData.get("mazoId")) });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  redirect("/mazos");
}
