"use client";

import { useActionState } from "react";
import { reportarErrorAccion } from "@/app/admin/reportes/acciones";
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
          className="rounded-xl border-[3px] border-tinta bg-white px-2 py-1.5 text-base text-tinta"
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
          className="rounded-xl border-[3px] border-tinta bg-white px-2 py-1.5 text-base text-tinta"
        />
        <button
          type="submit"
          disabled={enviando}
          className="boton boton-neutro self-start !rounded-xl !px-3 !py-1 text-sm disabled:opacity-50"
        >
          {enviando ? "Enviando…" : "Enviar reporte"}
        </button>
        {estado.error && (
          <p role="alert" className="font-bold text-[#b42318]">
            {estado.error}
          </p>
        )}
        {estado.exito && !estado.error && (
          <p role="status" className="font-bold text-verde">
            Gracias: un administrador revisará tu reporte.
          </p>
        )}
      </form>
    </details>
  );
}
