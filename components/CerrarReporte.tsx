"use client";

import { useActionState } from "react";
import { cambiarEstadoReporteAccion } from "@/app/reportes/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";

const INICIAL: EstadoAccion = { error: null, exito: false };

const BOTON =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

export default function CerrarReporte({ id }: { id: number }) {
  const [estado, cambiar, cambiando] = useActionState(cambiarEstadoReporteAccion, INICIAL);

  return (
    <form action={cambiar} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button type="submit" name="estado" value="resuelto" disabled={cambiando} className={BOTON}>
        Marcar resuelto
      </button>
      <button type="submit" name="estado" value="descartado" disabled={cambiando} className={BOTON}>
        Descartar
      </button>
      {estado.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {estado.error}
        </p>
      )}
    </form>
  );
}
