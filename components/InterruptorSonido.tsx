"use client";

import { fijarSonido, sonar, useSonidoActivo } from "@/components/sonido-navegador";

/** Interruptor del sonido de la aplicación. Apagado por defecto. */
export default function InterruptorSonido() {
  const activo = useSonidoActivo();

  return (
    <button
      type="button"
      aria-pressed={activo}
      aria-label="Sonidos de la aplicación"
      onClick={() => {
        fijarSonido(!activo);
        // Al encender, un clic de confirmación: es el gesto que habilita el audio.
        if (!activo) sonar("clic");
      }}
      className="rounded-xl border-[3px] border-tinta px-3 py-1.5 text-sm font-extrabold hover:bg-amarillo focus-visible:bg-amarillo aria-pressed:bg-amarillo"
    >
      Sonido: {activo ? "sí" : "no"}
    </button>
  );
}
