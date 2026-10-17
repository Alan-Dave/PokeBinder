"use client";

import { useRef, useState, type MouseEvent, type WheelEvent } from "react";
import { ZOOM_MIN, zoomPorClic, zoomPorRueda } from "@/lib/zoom";

type Props = {
  url: string;
  alt: string;
};

// <dialog> con showModal() da gratis el foco atrapado, el cierre con Esc y el
// role de diálogo; no hace falta una librería de modales.
export default function VisorImagen({ url, alt }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(ZOOM_MIN);

  function abrir() {
    setZoom(ZOOM_MIN);
    dialogo.current?.showModal();
  }

  function cerrar() {
    dialogo.current?.close();
  }

  // Un clic sobre el fondo (el propio <dialog>, no su contenido) cierra el visor.
  function alHacerClicEnFondo(evento: MouseEvent<HTMLDialogElement>) {
    if (evento.target === evento.currentTarget) cerrar();
  }

  function alGirarRueda(evento: WheelEvent<HTMLDivElement>) {
    setZoom((actual) => zoomPorRueda(actual, evento.deltaY));
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label={`Ampliar la imagen de ${alt}`}
        className="h-full w-full cursor-zoom-in"
      >
        {/* La URL está firmada y caduca: next/image la cachearía vencida. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} className="h-full w-full object-contain" />
      </button>

      <dialog
        ref={dialogo}
        aria-label={`Imagen ampliada de ${alt}`}
        onClick={alHacerClicEnFondo}
        className="m-auto h-[90vh] w-[90vw] max-w-3xl rounded-lg bg-zinc-100 p-0 backdrop:bg-black/70 dark:bg-zinc-900"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-300 p-2 dark:border-zinc-700">
            <span className="text-sm" aria-live="polite">
              Zoom {Math.round(zoom * 100)} %
            </span>
            <button
              type="button"
              onClick={cerrar}
              className="rounded-md border border-zinc-400 px-3 py-1 text-sm"
            >
              Cerrar
            </button>
          </div>
          <div onWheel={alGirarRueda} className="flex-1 overflow-auto">
            <button
              type="button"
              onClick={() => setZoom(zoomPorClic)}
              aria-label="Cambiar el zoom"
              className="block cursor-zoom-in"
              style={{ width: `${zoom * 100}%` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={alt} className="block h-auto w-full" />
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
