import "server-only";

import { urlsImagenesOpcionales } from "@/lib/catalogo";
import { createClient } from "@/lib/supabase/server";
import { patronContiene } from "@/lib/validators/catalogo";
import { panelColeccionSchema, TAMANO_PANEL } from "@/lib/validators/panel-coleccion";

/**
 * Cartas de Mi colección para el panel lateral (PBI-X9).
 *
 * Solo lee el inventario del propio usuario: el aislamiento lo garantiza RLS y
 * aquí nunca se recibe ni se envía un id de usuario. El texto de búsqueda
 * viaja como parámetro (con los comodines de LIKE escapados) y la categoría se
 * valida como entero; una categoría ajena queda oculta por RLS y da un
 * resultado vacío, igual que una inexistente.
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

export type CartaPanel = {
  inventarioId: number;
  cartaId: number;
  nombre: string;
  idApi: string;
  idioma: string;
  variante: string;
  cantidad: number;
  /** URL firmada y con vencimiento: no se guarda, se pide cada vez. */
  imagenUrl: string | null;
};

export const SIN_SESION = "Se requiere una sesión iniciada.";

type FilaPanel = {
  id: number;
  carta_id: number;
  variante: string;
  cantidad: number;
  cartas: { id_api: string; nombre: string; idioma: string } | null;
};

export async function listarPanelColeccion(
  entrada: unknown,
): Promise<Resultado<{ cartas: CartaPanel[]; hayMas: boolean }>> {
  const validado = panelColeccionSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: SIN_SESION };

  const { texto, categoriaId, pagina } = validado.data;
  const desde = (pagina - 1) * TAMANO_PANEL;

  // !inner en las uniones: el filtro por nombre o categoría deja fuera las filas
  // que no coinciden, en vez de devolverlas con la unión vacía.
  const columnas = "id, carta_id, variante, cantidad, cartas!inner(id_api, nombre, idioma)";
  let consulta = supabase
    .from("inventario")
    .select(categoriaId ? `${columnas}, categoria_cartas!inner(categoria_id)` : columnas);
  if (texto) consulta = consulta.ilike("cartas.nombre", patronContiene(texto));
  if (categoriaId) consulta = consulta.eq("categoria_cartas.categoria_id", categoriaId);

  // Se piden TAMANO_PANEL + 1 filas: la de sobra solo indica que hay otra página.
  const { data, error } = await consulta.order("id").range(desde, desde + TAMANO_PANEL);
  if (error) {
    console.error("[panel-coleccion] Error inesperado al listar:", error);
    return { ok: false, error: "No se pudo completar la operación." };
  }

  const filas = data as unknown as FilaPanel[];
  const filasPagina = filas.slice(0, TAMANO_PANEL);
  const imagenes = await urlsImagenesOpcionales([...new Set(filasPagina.map((f) => f.carta_id))]);

  const cartas = filasPagina.flatMap((f) =>
    f.cartas
      ? [
          {
            inventarioId: f.id,
            cartaId: f.carta_id,
            nombre: f.cartas.nombre,
            idApi: f.cartas.id_api,
            idioma: f.cartas.idioma,
            variante: f.variante,
            cantidad: f.cantidad,
            imagenUrl: imagenes[f.carta_id] ?? null,
          },
        ]
      : [],
  );
  return { ok: true, datos: { cartas, hayMas: filas.length > TAMANO_PANEL } };
}
