"use client";

import { useActionState } from "react";
import { cambiarEstadoReporteAccion } from "@/app/admin/reportes/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";

const INICIAL: EstadoAccion = { error: null, exito: false };

const BOTON =
  "boton boton-neutro !rounded-xl !px-3 !py-1 text-sm disabled:opacity-50";

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
        <p role="alert" className="text-sm font-bold text-[#b42318]">
          {estado.error}
        </p>
      )}
    </form>
  );
}
