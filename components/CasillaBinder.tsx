"use client";

import { useActionState } from "react";
import { colocarCartaAccion, quitarCartaAccion } from "@/app/binder/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import ImagenCarta from "@/components/ImagenCarta";
import { useCartaArrastrable, useCasillaSoltable } from "@/components/TableroBinder";
import { etiquetaVariante } from "@/lib/variantes";

const INICIAL: EstadoAccion = { error: null, exito: false };

const BOTON =
  "boton boton-neutro !rounded-lg !px-2 !py-0.5 text-xs disabled:opacity-50";

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
      className={`flex aspect-[5/7] flex-col gap-2 overflow-hidden rounded-xl border-[3px] p-2 text-sm shadow-[inset_0_0_0_2px_rgba(255,255,255,0.8)] ${
        isOver ? "border-azul bg-[#dfe8ff]" : "border-tinta/40 bg-white/70"
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
            className={`flex min-h-0 flex-1 cursor-grab touch-none items-center justify-center overflow-hidden rounded bg-[#e9e9ee] ${
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
            <p className="truncate text-xs text-tinta/75">
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
        <p className="m-auto text-center text-xs font-bold text-tinta/75">Tu inventario está vacío.</p>
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
            className="w-full rounded-lg border-2 border-tinta bg-white px-1 py-1 text-xs text-tinta"
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
