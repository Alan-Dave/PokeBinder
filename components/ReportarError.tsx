"use client";

import { useActionState } from "react";
import { reportarErrorAccion } from "@/app/reportes/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";

const INICIAL: EstadoAccion = { error: null, exito: false };

type Props = {
  cartaId: number;
  // Las listas y límites vienen de la página (servidor) para no cargar zod en el navegador.
  motivos: { valor: string; etiqueta: string }[];
  detalleMin: number;
  detalleMax: number;
};

export default function ReportarError({ cartaId, motivos, detalleMin, detalleMax }: Props) {
  const [estado, reportar, enviando] = useActionState(reportarErrorAccion, INICIAL);
  const idMotivo = `motivo-${cartaId}`;
  const idDetalle = `detalle-${cartaId}`;

  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-medium">¿Hay un error en esta carta? Reportarlo</summary>
      <form action={reportar} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="cartaId" value={cartaId} />
        <label htmlFor={idMotivo} className="font-medium">
          Motivo
        </label>
        <select
          id={idMotivo}
          name="motivo"
          className="rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
        >
          {motivos.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.etiqueta}
            </option>
          ))}
        </select>
        <label htmlFor={idDetalle} className="font-medium">
          Qué está mal
        </label>
        <textarea
          id={idDetalle}
          name="detalle"
          required
          minLength={detalleMin}
          maxLength={detalleMax}
          rows={3}
          className="rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={enviando}
          className="self-start rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {enviando ? "Enviando…" : "Enviar reporte"}
        </button>
        {estado.error && (
          <p role="alert" className="text-red-700 dark:text-red-400">
            {estado.error}
          </p>
        )}
        {estado.exito && !estado.error && (
          <p role="status" className="text-green-800 dark:text-green-400">
            Gracias: un administrador revisará tu reporte.
          </p>
        )}
      </form>
    </details>
  );
}
