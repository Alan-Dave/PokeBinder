"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState, useTransition, type ReactNode } from "react";
import { colocarCartaAccion, moverCartaAccion, quitarCartaAccion } from "@/app/binder/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import { type Accion, decidirSoltar, type Destino, type Origen } from "@/lib/arrastre";
import { etiquetaVariante } from "@/lib/variantes";

/**
 * Tablero del binder con arrastrar y soltar (PBI-15).
 *
 * Es una comodidad sobre los formularios de cada casilla, que siguen
 * funcionando: arrastrar no sustituye ninguna validación. Cada soltado termina
 * en la misma Server Action que usan los botones, y el servidor y la base
 * deciden si la operación es válida. La decisión del cliente (decidirSoltar)
 * solo evita peticiones inútiles.
 */

const INICIAL: EstadoAccion = { error: null, exito: false };

export type OpcionBandeja = {
  id: number;
  variante: string;
  nombre: string;
  idApi: string;
};

// Los datos que lleva cada elemento arrastrable: el tipo y lo necesario para decidir.
type DatosArrastre = { origen: Origen; etiqueta: string };

/** Zona soltable de una casilla; la usa CasillaBinder. */
export function useCasillaSoltable(posicion: number) {
  return useDroppable({
    id: `casilla-${posicion}`,
    data: { destino: { tipo: "casilla", posicion } satisfies Destino },
  });
}

/** Carta de una casilla que se puede arrastrar; la usa CasillaBinder. */
export function useCartaArrastrable(posicion: number, etiqueta: string, habilitado: boolean) {
  const datos: DatosArrastre = {
    origen: { tipo: "casilla", posicion },
    etiqueta,
  };
  return useDraggable({
    id: `carta-${posicion}`,
    data: datos,
    disabled: !habilitado,
  });
}

function ChipInventario({ opcion }: { opcion: OpcionBandeja }) {
  const etiqueta = `${opcion.nombre} · ${etiquetaVariante(opcion.variante)}`;
  const datos: DatosArrastre = {
    origen: { tipo: "inventario", inventarioId: opcion.id },
    etiqueta,
  };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `inventario-${opcion.id}`,
    data: datos,
  });

  return (
    <li>
      <button
        type="button"
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Arrastrar ${etiqueta} a una casilla`}
        className={`w-full cursor-grab touch-none rounded-md border border-zinc-200 px-2 py-1 text-left text-xs hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 ${isDragging ? "opacity-40" : ""}`}
      >
        <span className="block truncate font-medium">{opcion.nombre}</span>
        <span className="block truncate text-zinc-600 dark:text-zinc-400">
          {opcion.idApi} · {etiquetaVariante(opcion.variante)}
        </span>
      </button>
    </li>
  );
}

function ZonaQuitar({ activa }: { activa: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "quitar",
    data: { destino: { tipo: "quitar" } satisfies Destino },
  });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed p-3 text-center text-sm ${
        isOver
          ? "border-red-500 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100"
          : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
      } ${activa ? "" : "opacity-60"}`}
    >
      Suelta aquí una carta del binder para quitarla
    </div>
  );
}

type Props = {
  binderId: number;
  pagina: number;
  /** Casillas ocupadas de la página actual. */
  ocupadas: number[];
  opciones: OpcionBandeja[];
  children: ReactNode;
};

export default function TableroBinder({ binderId, pagina, ocupadas, opciones, children }: Props) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);

  // El teclado también arrastra: espacio levanta, flechas mueven, espacio suelta.
  const sensores = useSensors(
    // Con una distancia mínima, un clic en un botón de la casilla no inicia un arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function alIniciar(evento: DragStartEvent) {
    setError(null);
    setArrastrando((evento.active.data.current as DatosArrastre).etiqueta);
  }

  function ejecutar(accion: Accion) {
    const datos = new FormData();
    datos.set("binderId", String(binderId));
    datos.set("pagina", String(pagina));

    let enviar: Promise<EstadoAccion>;
    if (accion.tipo === "mover") {
      datos.set("desde", String(accion.desde));
      datos.set("hasta", String(accion.hasta));
      enviar = moverCartaAccion(INICIAL, datos);
    } else if (accion.tipo === "colocar") {
      datos.set("posicion", String(accion.posicion));
      datos.set("inventarioId", String(accion.inventarioId));
      enviar = colocarCartaAccion(INICIAL, datos);
    } else {
      datos.set("posicion", String(accion.posicion));
      enviar = quitarCartaAccion(INICIAL, datos);
    }

    iniciar(async () => {
      const resultado = await enviar;
      // Si salió bien, la propia acción revalida la ruta y la página se actualiza.
      if (resultado.error) setError(resultado.error);
    });
  }

  function alSoltar(evento: DragEndEvent) {
    setArrastrando(null);
    const origen = (evento.active.data.current as DatosArrastre).origen;
    const destino = (evento.over?.data.current?.destino as Destino | undefined) ?? null;

    const decision = decidirSoltar(origen, destino, new Set(ocupadas));
    if (!decision) return;
    if ("error" in decision) setError(decision.error);
    else ejecutar(decision.accion);
  }

  return (
    <DndContext
      sensors={sensores}
      onDragStart={alIniciar}
      onDragEnd={alSoltar}
      onDragCancel={() => setArrastrando(null)}
    >
      <p role="status" aria-live="polite" className="sr-only">
        {pendiente ? "Guardando el cambio…" : ""}
      </p>
      {error && (
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-sm text-red-900">
          {error}
        </p>
      )}

      {children}

      <ZonaQuitar activa={arrastrando !== null} />

      <section aria-labelledby="titulo-bandeja" className="flex flex-col gap-2">
        <h2 id="titulo-bandeja" className="font-medium">
          Tu inventario
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Arrastra una carta a una casilla vacía, o usa el selector de cada casilla.
        </p>
        {opciones.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Tu inventario está vacío.</p>
        ) : (
          <ul className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {opciones.map((o) => (
              <ChipInventario key={o.id} opcion={o} />
            ))}
          </ul>
        )}
      </section>

      <DragOverlay>
        {arrastrando && (
          <div className="rounded-md border border-zinc-400 bg-white px-3 py-2 text-sm shadow-lg dark:bg-zinc-900">
            {arrastrando}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
