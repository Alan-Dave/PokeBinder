"use client";

import { useActionState, useState } from "react";
import { eliminarAccion, guardarCantidadAccion } from "@/app/coleccion/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import SelectorCategorias from "@/components/SelectorCategorias";
import type { Categoria } from "@/lib/categorias";
import type { FilaInventario } from "@/lib/inventario";
import { etiquetaVariante } from "@/lib/variantes";

const INICIAL: EstadoAccion = { error: null, exito: false };

const BOTON = "boton boton-neutro !rounded-xl !px-3 !py-1 text-sm disabled:opacity-50";
const CAMPO = "w-24 rounded-xl border-[3px] border-tinta bg-white px-2 py-1 text-base text-tinta";

type Props = {
  fila: FilaInventario;
  // Los límites vienen de la página (servidor) para no cargar zod en el navegador.
  min: number;
  max: number;
  // Precio unitario ya formateado, calculado en el servidor; null si no hay.
  precio?: string | null;
  // Categorías del usuario y las ids donde ya está esta fila (PBI-X7).
  categorias?: Categoria[];
  categoriasDeLaFila?: number[];
};

export default function FilaColeccion({ fila, min, max, precio, categorias = [], categoriasDeLaFila = [] }: Props) {
  const [estadoGuardar, guardar, guardando] = useActionState(guardarCantidadAccion, INICIAL);
  const [estadoEliminar, eliminar, eliminando] = useActionState(eliminarAccion, INICIAL);
  const [confirmando, setConfirmando] = useState(false);

  const error = estadoGuardar.error ?? estadoEliminar.error;
  const idCantidad = `cantidad-${fila.id}`;

  return (
    <li className="tarjeta flex flex-col gap-2 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-extrabold">{fila.cartas?.nombre ?? "Carta desconocida"}</p>
          <p className="text-sm font-bold text-tinta/75">
            {fila.cartas ? `${fila.cartas.id_api} · ${fila.cartas.idioma} · ` : ""}
            {etiquetaVariante(fila.variante)}
          </p>
          <p className="text-sm font-bold text-tinta/75">
            {precio ? `Precio de mercado: ${precio} c/u` : "Sin precio disponible"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form action={guardar} className="flex items-center gap-2">
            <input type="hidden" name="id" value={fila.id} />
            <label htmlFor={idCantidad} className="sr-only">
              Cantidad
            </label>
            <input
              id={idCantidad}
              name="cantidad"
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              step={1}
              defaultValue={fila.cantidad}
              required
              className={CAMPO}
            />
            <button type="submit" disabled={guardando} className={BOTON}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </form>

          {confirmando ? (
            <form action={eliminar} className="flex items-center gap-2">
              <input type="hidden" name="id" value={fila.id} />
              <button
                type="submit"
                disabled={eliminando}
                className="boton boton-rojo !rounded-xl !px-3 !py-1 text-sm disabled:opacity-50"
              >
                {eliminando ? "Eliminando…" : "Confirmar"}
              </button>
              <button type="button" onClick={() => setConfirmando(false)} className={BOTON}>
                Cancelar
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setConfirmando(true)} className={BOTON}>
              Eliminar
            </button>
          )}
        </div>
      </div>

      <SelectorCategorias inventarioId={fila.id} categorias={categorias} marcadas={categoriasDeLaFila} />

      {error && (
        <p role="alert" className="text-sm font-bold text-[#b42318]">
          {error}
        </p>
      )}
      {estadoGuardar.exito && !error && (
        <p role="status" className="text-sm font-bold text-verde">
          Cantidad guardada.
        </p>
      )}
    </li>
  );
}
