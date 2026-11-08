"use client";

import { useEffect } from "react";
import { sonar, useSonidoActivo } from "@/components/sonido-navegador";
import { tonoDeClick } from "@/lib/sonido";

/**
 * Hace sonar los clics en botones, enlaces y pestañas, y un aviso distinto
 * cuando aparece un mensaje de error (role="alert"). No dibuja nada y no hace
 * nada mientras el sonido esté apagado, que es el valor por defecto.
 */
export default function SonidoInteraccion() {
  const activo = useSonidoActivo();

  useEffect(() => {
    if (!activo) return;

    const alHacerClic = (evento: MouseEvent) => {
      const tono = tonoDeClick(evento.target instanceof Element ? evento.target : null);
      if (tono) sonar(tono);
    };

    // Solo los alertas que APARECEN suenan: los que ya estaban al cargar la página, no.
    const observador = new MutationObserver((cambios) => {
      for (const cambio of cambios) {
        for (const nodo of cambio.addedNodes) {
          if (nodo instanceof Element && (nodo.matches('[role="alert"]') || nodo.querySelector('[role="alert"]'))) {
            sonar("error");
            return;
          }
        }
      }
    });

    document.addEventListener("click", alHacerClic);
    observador.observe(document.body, { childList: true, subtree: true });
    return () => {
      document.removeEventListener("click", alHacerClic);
      observador.disconnect();
    };
  }, [activo]);

  return null;
}
