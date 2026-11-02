"use client";

import { useActionState, useState } from "react";
import { aprobarAccion, rechazarAccion } from "@/app/admin/propuestas/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import type { PropuestaPendiente } from "@/lib/propuestas";

const INICIAL: EstadoAccion = { error: null, exito: false };

const BOTON =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

type Props = {
  propuesta: PropuestaPendiente;
  // Los límites vienen de la página (servidor) para no cargar zod en el navegador.
  motivoMin: number;
  motivoMax: number;
};

export default function FilaPropuesta({ propuesta, motivoMin, motivoMax }: Props) {
  const [estadoAprobar, aprobar, aprobando] = useActionState(aprobarAccion, INICIAL);
  const [estadoRechazar, rechazar, rechazando] = useActionState(rechazarAccion, INICIAL);
  const [rechazandoAbierto, setRechazandoAbierto] = useState(false);

  const error = estadoAprobar.error ?? estadoRechazar.error;
  const idMotivo = `motivo-${propuesta.id}`;

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 sm:flex-row dark:border-zinc-800">
      <div className="flex aspect-[5/7] w-40 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
        {propuesta.url ? (
          // URL firmada de un bucket privado, válida unos minutos.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={propuesta.url} alt={`Imagen propuesta para ${propuesta.carta_nombre}`} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs text-zinc-500">Sin vista previa</span>
        )}
      </div>

      {/* React escapa el texto: lo que escribió el usuario nunca se interpreta como HTML. */}
      <div className="flex flex-1 flex-col gap-2 text-sm">
        <p className="font-medium">
          {propuesta.carta_nombre} · {propuesta.carta_idioma}
        </p>
        <p className="text-zinc-600 dark:text-zinc-400">Propuesta de {propuesta.nombre_visible}</p>
        <p className="whitespace-pre-line">{propuesta.descripcion}</p>
        <p className="whitespace-pre-line text-zinc-700 dark:text-zinc-300">{propuesta.detalles}</p>

        <div className="flex flex-wrap gap-2">
          <form action={aprobar}>
            <input type="hidden" name="propuestaId" value={propuesta.id} />
            <button type="submit" disabled={aprobando || rechazando} className={BOTON}>
              {aprobando ? "Publicando…" : "Aprobar y publicar"}
            </button>
          </form>
          {!rechazandoAbierto && (
            <button type="button" onClick={() => setRechazandoAbierto(true)} className={BOTON}>
              Rechazar
            </button>
          )}
        </div>

        {rechazandoAbierto && (
          <form action={rechazar} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <input type="hidden" name="propuestaId" value={propuesta.id} />
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor={idMotivo}>Motivo del rechazo</label>
              <input
                id={idMotivo}
                name="motivo"
                type="text"
                minLength={motivoMin}
                maxLength={motivoMax}
                required
                className="rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-700"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={rechazando}
                className="rounded-md bg-red-700 px-3 py-1.5 font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {rechazando ? "Rechazando…" : "Confirmar rechazo"}
              </button>
              <button type="button" onClick={() => setRechazandoAbierto(false)} className={BOTON}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {error && (
          <p role="alert" className="text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}
