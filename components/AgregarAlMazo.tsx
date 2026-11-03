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
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {agregando ? "Agregando…" : "Agregar 1"}
      </button>
      {estado.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {estado.error}
        </p>
      )}
    </form>
  );
}
