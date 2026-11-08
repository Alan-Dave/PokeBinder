"use server";

import { revalidatePath } from "next/cache";
import {
  asignarACategoria,
  crearCategoria,
  eliminarCategoria,
  quitarDeCategoria,
  renombrarCategoria,
} from "@/lib/categorias";
import { cambiarCantidad, eliminarDelInventario } from "@/lib/inventario";
import type { EstadoAccion } from "./tipos";

/**
 * Acciones de servidor de /coleccion.
 *
 * Una Server Action es un endpoint público: cualquiera puede invocarla con
 * datos arbitrarios, no solo la interfaz. Por eso no hacen nada propio: toda
 * la validación, la comprobación de sesión y el aislamiento por usuario viven
 * en lib/inventario.ts y en RLS. Aquí solo se leen los campos del formulario.
 */

export async function guardarCantidadAccion(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const resultado = await cambiarCantidad({
    id: Number(formData.get("id")),
    cantidad: Number(formData.get("cantidad")),
  });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath("/coleccion");
  return { error: null, exito: true };
}

export async function eliminarAccion(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const resultado = await eliminarDelInventario({ id: Number(formData.get("id")) });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath("/coleccion");
  return { error: null, exito: true };
}

// Categorías de la colección (PBI-X7). Mismo criterio: aquí solo se leen los
// campos; validan lib/categorias.ts y RLS.

export async function crearCategoriaAccion(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const resultado = await crearCategoria({ nombre: formData.get("nombre") });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath("/coleccion");
  return { error: null, exito: true };
}

export async function renombrarCategoriaAccion(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const resultado = await renombrarCategoria({
    id: Number(formData.get("id")),
    nombre: formData.get("nombre"),
  });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath("/coleccion");
  return { error: null, exito: true };
}

export async function eliminarCategoriaAccion(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const resultado = await eliminarCategoria({ id: Number(formData.get("id")) });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath("/coleccion");
  return { error: null, exito: true };
}

/** Marca o desmarca una carta en una categoría (campo «marcar»: "1" asigna). */
export async function alternarCategoriaAccion(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const datos = {
    categoriaId: Number(formData.get("categoriaId")),
    inventarioId: Number(formData.get("inventarioId")),
  };
  const resultado =
    formData.get("marcar") === "1" ? await asignarACategoria(datos) : await quitarDeCategoria(datos);
  if (!resultado.ok) return { error: resultado.error, exito: false };

  revalidatePath("/coleccion");
  return { error: null, exito: true };
}
