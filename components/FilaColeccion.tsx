"use client";

import { useActionState, useState } from "react";
import { eliminarAccion, guardarCantidadAccion } from "@/app/coleccion/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import type { FilaInventario } from "@/lib/inventario";

const INICIAL: EstadoAccion = { error: null, exito: false };

const BOTON =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

type Props = {
  fila: FilaInventario;
  // Los límites vienen de la página (servidor) para no cargar zod en el navegador.
  min: number;
  max: number;
};

export default function FilaColeccion({ fila, min, max }: Props) {
  const [estadoGuardar, guardar, guardando] = useActionState(guardarCantidadAccion, INICIAL);
  const [estadoEliminar, eliminar, eliminando] = useActionState(eliminarAccion, INICIAL);
  const [confirmando, setConfirmando] = useState(false);

  const error = estadoGuardar.error ?? estadoEliminar.error;
  const idCantidad = `cantidad-${fila.id}`;

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">{fila.cartas?.nombre ?? "Carta desconocida"}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {fila.cartas ? `${fila.cartas.id_api} · ${fila.cartas.idioma} · ` : ""}
            {fila.variante}
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
              className="w-24 rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
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
                className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
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

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {estadoGuardar.exito && !error && (
        <p role="status" className="text-sm text-green-800 dark:text-green-400">
          Cantidad guardada.
        </p>
      )}
    </li>
  );
}
