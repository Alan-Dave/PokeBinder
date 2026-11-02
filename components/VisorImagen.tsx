"use client";

import { useRef, useState, type MouseEvent, type WheelEvent } from "react";
import { ZOOM_MIN, zoomPorClic, zoomPorRueda } from "@/lib/zoom";

type Props = {
  // Imagen del bucket (~15 KB, URL firmada). Puede faltar: solo ~22% de las cartas la tiene.
  url: string | null;
  // Imagen en alta definición de /api/cartas/{id}/imagen-hd (PBI-x2).
  urlHd: string;
  alt: string;
};

// <dialog> con showModal() da gratis el foco atrapado, el cierre con Esc y el
// role de diálogo; no hace falta una librería de modales.
export default function VisorImagen({ url, urlHd, alt }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [zoom, setZoom] = useState(ZOOM_MIN);
  // La imagen grande se pide solo al abrir el visor: no se descarga de TCGdex
  // cada vez que alguien mira la ficha.
  const [abierto, setAbierto] = useState(false);
  const [hdFallo, setHdFallo] = useState(false);

  function abrir() {
    setZoom(ZOOM_MIN);
    setAbierto(true);
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

  // Si no hay imagen grande (404), se usa la del bucket.
  const fuente = abierto && !hdFallo ? urlHd : url;

  return (
    <>
      {url ? (
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
      ) : (
        <button
          type="button"
          onClick={abrir}
          className="h-full w-full text-sm text-zinc-500 underline"
        >
          Sin imagen · ver en alta definición
        </button>
      )}

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
            {fuente ? (
              <button
                type="button"
                onClick={() => setZoom(zoomPorClic)}
                aria-label="Cambiar el zoom"
                className="block cursor-zoom-in"
                style={{ width: `${zoom * 100}%` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fuente}
                  alt={alt}
                  onError={() => setHdFallo(true)}
                  className="block h-auto w-full"
                />
              </button>
            ) : (
              <p className="p-4 text-sm text-zinc-500">No hay imagen disponible para esta carta.</p>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
