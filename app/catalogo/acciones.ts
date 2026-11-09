"use server";

import { asignarACategoria } from "@/lib/categorias";
import { agregarAlInventario } from "@/lib/inventario";
import { categoriaOpcionalSchema } from "@/lib/validators/categorias";
import type { EstadoAccion } from "@/app/coleccion/tipos";

/**
 * Agregar una carta del catálogo al inventario del usuario.
 *
 * Una Server Action es un endpoint público: la validación, la comprobación de
 * sesión y el aislamiento por usuario viven en lib/inventario.ts y en RLS.
 * Aquí solo se leen los campos del formulario.
 *
 * Si el formulario trae una categoría (PBI-X8), la carta recién agregada se
 * asigna a ella. La categoría se valida ANTES de tocar el inventario, para no
 * dejar la carta agregada por una entrada que luego se rechaza. Que la
 * categoría sea del usuario lo decide RLS al asignar.
 */
export async function agregarCartaAccion(
  _previo: EstadoAccion,
  formData: FormData,
): Promise<EstadoAccion> {
  const categoriaBruta = formData.get("categoriaId");
  const categoria = categoriaOpcionalSchema.safeParse(
    categoriaBruta === null || categoriaBruta === "" ? undefined : Number(categoriaBruta),
  );
  if (!categoria.success) return { error: categoria.error.issues[0].message, exito: false };

  const resultado = await agregarAlInventario({
    cartaId: Number(formData.get("cartaId")),
    variante: formData.get("variante"),
    cantidad: Number(formData.get("cantidad")),
  });
  if (!resultado.ok) return { error: resultado.error, exito: false };

  if (categoria.data !== undefined) {
    const asignada = await asignarACategoria({ categoriaId: categoria.data, inventarioId: resultado.datos.id });
    // La carta ya está en la colección: se avisa de lo que falló sin deshacerla.
    if (!asignada.ok) {
      return { error: `Se agregó a tu colección, pero no a la categoría: ${asignada.error}`, exito: true };
    }
  }
  return { error: null, exito: true };
}
