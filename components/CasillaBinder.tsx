"use client";

import { useActionState } from "react";
import { colocarCartaAccion, quitarCartaAccion } from "@/app/binder/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import ImagenCarta from "@/components/ImagenCarta";
import { useCartaArrastrable, useCasillaSoltable } from "@/components/TableroBinder";
import { etiquetaVariante } from "@/lib/variantes";

const INICIAL: EstadoAccion = { error: null, exito: false };

const BOTON =
  "rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

type Carta = {
  id: number;
  nombre: string;
  idApi: string;
  variante: string;
  imagenUrl: string | null;
};
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
  const { setNodeRef: soltable, isOver } = useCasillaSoltable(posicion);
  const {
    attributes,
    listeners,
    setNodeRef: arrastrable,
    isDragging,
  } = useCartaArrastrable(
    posicion,
    carta ? `${carta.nombre} · ${etiquetaVariante(carta.variante)}` : "",
    carta !== null,
  );

  return (
    <li
      ref={soltable}
      className={`flex aspect-[5/7] flex-col gap-2 overflow-hidden rounded-lg border p-2 text-sm ${
        isOver ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-zinc-200 dark:border-zinc-800"
      }`}
    >
      {carta ? (
        <>
          {/* Solo la imagen se arrastra: los botones de la casilla siguen siendo clicables. */}
          <div
            ref={arrastrable}
            {...attributes}
            {...listeners}
            aria-label={`Arrastrar ${carta.nombre} a otra casilla`}
            className={`flex min-h-0 flex-1 cursor-grab touch-none items-center justify-center overflow-hidden rounded bg-zinc-100 dark:bg-zinc-900 ${
              isDragging ? "opacity-40" : ""
            }`}
          >
            {/* Bucket primero; si la carta no está ahí, la miniatura de TCGdex (igual que el catálogo). */}
            <ImagenCarta
              url={carta.imagenUrl}
              urlRespaldo={`/api/cartas/${carta.id}/imagen-hd?tam=min`}
              alt={carta.nombre}
            />
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
