"use client";

import { useActionState, useState } from "react";
import { cambiarPaginasAccion, eliminarBinderAccion } from "@/app/binder/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";

const INICIAL: EstadoAccion = { error: null, exito: false };

const BOTON =
  "boton boton-neutro !rounded-xl !px-3 !py-1 text-sm disabled:opacity-50";

type Props = {
  binderId: number;
  paginas: number;
  paginasMin: number;
  paginasMax: number;
};

export default function ControlesBinder({ binderId, paginas, paginasMin, paginasMax }: Props) {
  const [estadoPaginas, cambiar, cambiando] = useActionState(cambiarPaginasAccion, INICIAL);
  const [estadoEliminar, eliminar, eliminando] = useActionState(eliminarBinderAccion, INICIAL);
  const [confirmando, setConfirmando] = useState(false);
  const error = estadoPaginas.error ?? estadoEliminar.error;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <form action={cambiar} className="flex items-center gap-2">
          <input type="hidden" name="binderId" value={binderId} />
          <label htmlFor="paginas-binder" className="text-sm">
            Páginas
          </label>
          <input
            id="paginas-binder"
            name="paginas"
            type="number"
            defaultValue={paginas}
            min={paginasMin}
            max={paginasMax}
            required
            className="w-20 rounded-xl border-[3px] border-tinta bg-white px-2 py-1.5 text-sm text-tinta"
          />
          <button type="submit" disabled={cambiando} className={BOTON}>
            {cambiando ? "Guardando…" : "Guardar"}
          </button>
        </form>

        {confirmando ? (
          <form action={eliminar} className="flex items-center gap-2">
            <input type="hidden" name="binderId" value={binderId} />
            <span className="text-sm">¿Eliminar este binder? Tus cartas siguen en la colección.</span>
            <button type="submit" disabled={eliminando} className={`${BOTON} border-red-400 text-red-800`}>
              {eliminando ? "Eliminando…" : "Sí, eliminar"}
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className={BOTON}>
              Cancelar
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setConfirmando(true)} className={BOTON}>
            Eliminar binder
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      )}
    </div>
  );
}
