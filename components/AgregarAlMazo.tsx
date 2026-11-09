"use client";

import { useActionState } from "react";
import { agregarCartaAlMazoAccion } from "@/app/mazos/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";

const INICIAL: EstadoAccion = { error: null, exito: false };

type Props = { mazoId: number; cartaId: number };

export default function AgregarAlMazo({ mazoId, cartaId }: Props) {
  const [estado, agregar, agregando] = useActionState(agregarCartaAlMazoAccion, INICIAL);

  return (
    <form action={agregar} className="flex flex-col items-end gap-1">
      <input type="hidden" name="mazoId" value={mazoId} />
      <input type="hidden" name="cartaId" value={cartaId} />
      <button
        type="submit"
        disabled={agregando}
        className="boton boton-neutro !rounded-xl !px-3 !py-1 text-sm disabled:opacity-50"
      >
        {agregando ? "Agregando…" : "Agregar 1"}
      </button>
      {estado.error && (
        <p role="alert" className="text-sm font-bold text-[#b42318]">
          {estado.error}
        </p>
      )}
    </form>
  );
}
