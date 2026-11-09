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
import ImagenConRespaldo from "@/components/ImagenConRespaldo";
import PanelColeccion from "@/components/PanelColeccion";
import { type Accion, decidirSoltar, type Destino, type Origen } from "@/lib/arrastre";
import type { CartaPanel } from "@/lib/panel-coleccion";
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

/** Carta del panel lateral: se arrastra a una casilla vacía del binder. */
function TarjetaPanel({ carta }: { carta: CartaPanel }) {
  const etiqueta = `${carta.nombre} · ${etiquetaVariante(carta.variante)}`;
  const datos: DatosArrastre = {
    origen: { tipo: "inventario", inventarioId: carta.inventarioId },
    etiqueta,
  };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `inventario-${carta.inventarioId}`,
    data: datos,
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Arrastrar ${etiqueta} a una casilla`}
      className={`flex w-full cursor-grab touch-none flex-col gap-1 rounded-xl border-2 border-tinta bg-white p-1.5 text-left hover:bg-amarillo focus-visible:bg-amarillo ${isDragging ? "opacity-40" : ""}`}
    >
      <span className="flex aspect-[5/7] w-full items-center justify-center overflow-hidden rounded-lg bg-[#e9e9ee]">
        <ImagenConRespaldo src={carta.imagenUrl} alt="" draggable={false} />
      </span>
      <span className="block truncate text-xs font-extrabold">{carta.nombre}</span>
      <span className="block truncate text-xs">
        {etiquetaVariante(carta.variante)} · ×{carta.cantidad}
      </span>
    </button>
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
          ? "border-rojo bg-[#fee4e2] text-tinta"
          : "border-tinta text-tinta/75"
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
  /** Categorías del usuario para filtrar el panel lateral. */
  categorias: Array<{ id: number; nombre: string }>;
  children: ReactNode;
};

export default function TableroBinder({ binderId, pagina, ocupadas, categorias, children }: Props) {
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

      {/* En pantallas anchas el panel va a la izquierda; en angostas, debajo del tablero. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside
          aria-label="Cartas de tu colección"
          className="order-2 flex flex-col gap-2 lg:order-1 lg:sticky lg:top-24 lg:w-80 lg:shrink-0"
        >
          <PanelColeccion categorias={categorias} renderCarta={(carta) => <TarjetaPanel carta={carta} />} />
          <p className="text-sm">Arrastra una carta a una casilla vacía, o usa el selector de cada casilla.</p>
        </aside>

        <div className="order-1 flex min-w-0 flex-1 flex-col gap-6 lg:order-2">
          {error && (
            <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-sm text-red-900">
              {error}
            </p>
          )}

          {children}

          <ZonaQuitar activa={arrastrando !== null} />
        </div>
      </div>

      <DragOverlay>
        {arrastrando && (
          <div className="rounded-xl border-[3px] border-tinta bg-white px-3 py-2 text-sm font-bold shadow-lg">
            {arrastrando}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
