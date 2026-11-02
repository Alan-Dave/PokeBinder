"use client";

import { useRef, useState, type MouseEvent, type PointerEvent, type WheelEvent } from "react";
import { INCLINACION_NEUTRA, calcularInclinacion, type Inclinacion } from "@/lib/inclinacion";
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
  // El visor abre en 3D; el zoom sigue disponible para leer el texto de la carta.
  const [modo, setModo] = useState<"3d" | "zoom">("3d");
  const carta3d = useRef<HTMLDivElement>(null);

  function abrir() {
    setZoom(ZOOM_MIN);
    setModo("3d");
    setAbierto(true);
    dialogo.current?.showModal();
  }

  // La inclinación se escribe como variables CSS directamente en el elemento:
  // pasarla por useState volvería a dibujar el visor en cada movimiento del puntero.
  function aplicarInclinacion({ rotX, rotY, brilloX, brilloY }: Inclinacion) {
    const estilo = carta3d.current?.style;
    if (!estilo) return;
    estilo.setProperty("--rot-x", `${rotX}deg`);
    estilo.setProperty("--rot-y", `${rotY}deg`);
    estilo.setProperty("--brillo-x", `${brilloX}%`);
    estilo.setProperty("--brillo-y", `${brilloY}%`);
  }

  function alMoverPuntero(evento: PointerEvent<HTMLDivElement>) {
    // Quien pidió menos movimiento al sistema no recibe la inclinación.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const caja = evento.currentTarget.getBoundingClientRect();
    aplicarInclinacion(calcularInclinacion(evento.clientX, evento.clientY, caja));
  }

  function alSalirPuntero() {
    aplicarInclinacion(INCLINACION_NEUTRA);
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
              {modo === "zoom" ? `Zoom ${Math.round(zoom * 100)} %` : "Vista 3D"}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModo(modo === "3d" ? "zoom" : "3d")}
                className="rounded-md border border-zinc-400 px-3 py-1 text-sm"
              >
                {modo === "3d" ? "Modo zoom" : "Modo 3D"}
              </button>
              <button
                type="button"
                onClick={cerrar}
                className="rounded-md border border-zinc-400 px-3 py-1 text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
          {modo === "3d" ? (
            <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
              {fuente ? (
                <div
                  ref={carta3d}
                  onPointerMove={alMoverPuntero}
                  onPointerLeave={alSalirPuntero}
                  className="group relative max-h-full max-w-full will-change-transform"
                  style={{
                    transform: "perspective(900px) rotateX(var(--rot-x, 0deg)) rotateY(var(--rot-y, 0deg))",
                    transition: "transform 120ms ease-out",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fuente}
                    alt={alt}
                    draggable={false}
                    onError={() => setHdFallo(true)}
                    className="block max-h-[70vh] w-auto max-w-full rounded-[4.5%]"
                  />
                  {/* Brillo: un foco que sigue al puntero y una banda de colores. Es solo
                      decoración, no recibe eventos ni se anuncia a lectores de pantalla. */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-[4.5%] opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:hidden"
                    style={{
                      mixBlendMode: "overlay",
                      background:
                        "radial-gradient(circle at var(--brillo-x, 50%) var(--brillo-y, 50%), rgba(255,255,255,0.6), transparent 45%)," +
                        "linear-gradient(115deg, transparent 20%, rgba(255,0,150,0.35) 35%, rgba(0,220,255,0.35) 50%, rgba(255,230,0,0.35) 65%, transparent 80%)",
                    }}
                  />
                </div>
              ) : (
                <p className="p-4 text-sm text-zinc-500">No hay imagen disponible para esta carta.</p>
              )}
            </div>
          ) : (
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
          )}
        </div>
      </dialog>
    </>
  );
}
