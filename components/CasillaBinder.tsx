"use client";

import { useActionState } from "react";
import { colocarCartaAccion, quitarCartaAccion } from "@/app/binder/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import { etiquetaVariante } from "@/lib/variantes";

const INICIAL: EstadoAccion = { error: null, exito: false };

const BOTON =
  "rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

type Carta = { nombre: string; idApi: string; variante: string; imagenUrl: string | null };
type Opcion = { id: number; variante: string; nombre: string; idApi: string };

type Props = {
  binderId: number;
  pagina: number;
  posicion: number;
  carta: Carta | null;
  opciones: Opcion[];
};

export default function CasillaBinder({ binderId, pagina, posicion, carta, opciones }: Props) {
  const [estadoColocar, colocar, colocando] = useActionState(colocarCartaAccion, INICIAL);
  const [estadoQuitar, quitar, quitando] = useActionState(quitarCartaAccion, INICIAL);
  const error = estadoColocar.error ?? estadoQuitar.error;
  const idSelect = `casilla-${pagina}-${posicion}`;

  return (
    <li className="flex aspect-[5/7] flex-col gap-2 overflow-hidden rounded-lg border border-zinc-200 p-2 text-sm dark:border-zinc-800">
      {carta ? (
        <>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900">
            {carta.imagenUrl ? (
              // La URL está firmada y caduca: next/image la cachearía vencida.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={carta.imagenUrl} alt={carta.nombre} className="h-full w-full object-contain" />
            ) : (
              <span className="px-1 text-center text-xs text-zinc-500">Sin imagen</span>
            )}
          </div>
          <div>
            <p className="truncate font-medium">{carta.nombre}</p>
            <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">
              {carta.idApi} · {etiquetaVariante(carta.variante)}
            </p>
          </div>
          <form action={quitar}>
            <input type="hidden" name="binderId" value={binderId} />
            <input type="hidden" name="pagina" value={pagina} />
            <input type="hidden" name="posicion" value={posicion} />
            <button type="submit" disabled={quitando} className={BOTON}>
              {quitando ? "Quitando…" : "Quitar"}
            </button>
          </form>
        </>
      ) : opciones.length === 0 ? (
        <p className="m-auto text-center text-xs text-zinc-500">Tu inventario está vacío.</p>
      ) : (
        <form action={colocar} className="m-auto flex w-full flex-col gap-2">
          <input type="hidden" name="binderId" value={binderId} />
          <input type="hidden" name="pagina" value={pagina} />
          <input type="hidden" name="posicion" value={posicion} />
          <label htmlFor={idSelect} className="sr-only">
            Carta para la casilla {posicion + 1}
          </label>
          <select
            id={idSelect}
            name="inventarioId"
            defaultValue=""
            required
            className="w-full rounded-md border border-zinc-300 bg-transparent px-1 py-1 text-xs dark:border-zinc-700"
          >
            <option value="" disabled>
              Elegir carta…
            </option>
            {opciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre} · {o.idApi} · {etiquetaVariante(o.variante)}
              </option>
            ))}
          </select>
          <button type="submit" disabled={colocando} className={BOTON}>
            {colocando ? "Guardando…" : "Colocar"}
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="rounded bg-red-100 px-2 py-1 text-xs text-red-900">
          {error}
        </p>
      )}
    </li>
  );
}
