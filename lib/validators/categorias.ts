import { z } from "zod";

// Mismo largo que el check de public.categorias_coleccion.nombre.
export const NOMBRE_CATEGORIA_MAX = 60;

// Los ids son bigint generated always as identity: llegan como number.
const idCategoria = z.number().int().positive({ error: "El identificador de la categoría no es válido." });
const idInventario = z.number().int().positive({ error: "El identificador de la carta no es válido." });

const nombre = z
  .string({ error: "El nombre debe ser texto." })
  .trim()
  .min(1, { error: "Escribe un nombre para la categoría." })
  .max(NOMBRE_CATEGORIA_MAX, { error: `El nombre admite hasta ${NOMBRE_CATEGORIA_MAX} caracteres.` });

// Categoría opcional al agregar desde el catálogo: sin elegir (undefined) no hay categoría.
export const categoriaOpcionalSchema = idCategoria.optional();

export const crearCategoriaSchema = z.object({ nombre });

export const renombrarCategoriaSchema = z.object({ id: idCategoria, nombre });

export const eliminarCategoriaSchema = z.object({ id: idCategoria });

// Asignar y quitar usan la misma forma: una carta del inventario y una categoría.
export const pertenenciaSchema = z.object({ categoriaId: idCategoria, inventarioId: idInventario });

// Cartas de la página que se muestran: el tope es el de una página de colección.
export const CARTAS_POR_CONSULTA_MAX = 30;
export const categoriasDeCartasSchema = z
  .array(idInventario, { error: "La lista de cartas no es válida." })
  .max(CARTAS_POR_CONSULTA_MAX, { error: `Se pueden consultar hasta ${CARTAS_POR_CONSULTA_MAX} cartas a la vez.` });

export type PertenenciaInput = z.infer<typeof pertenenciaSchema>;
