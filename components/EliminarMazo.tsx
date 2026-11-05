"use client";

import { useActionState, useState } from "react";
import { eliminarMazoAccion } from "@/app/mazos/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";

const INICIAL: EstadoAccion = { error: null, exito: false };

const BOTON =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

export default function EliminarMazo({ mazoId }: { mazoId: number }) {
  const [estado, eliminar, eliminando] = useActionState(eliminarMazoAccion, INICIAL);
  const [confirmando, setConfirmando] = useState(false);

  return (
    <div className="flex flex-col items-start gap-2">
      {confirmando ? (
        <form action={eliminar} className="flex items-center gap-2">
          <input type="hidden" name="mazoId" value={mazoId} />
          <button
            type="submit"
            disabled={eliminando}
            className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
          >
            {eliminando ? "Eliminando…" : "Sí, eliminar el mazo"}
          </button>
          <button type="button" onClick={() => setConfirmando(false)} className={BOTON}>
            Cancelar
          </button>
        </form>
      ) : (
        <button type="button" onClick={() => setConfirmando(true)} className={BOTON}>
          Eliminar mazo
        </button>
      )}
      {estado.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {estado.error}
        </p>
      )}
    </div>
  );
}
