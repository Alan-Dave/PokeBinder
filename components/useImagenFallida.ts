"use client";

import { useCallback } from "react";

/**
 * Ref para una <img> dibujada en el servidor. Si la imagen falla (404, red)
 * antes de que React termine de cargar en el navegador, el evento `error` ya
 * pasó y onError nunca se ejecuta: queda el icono roto. Al montar se revisa si
 * la imagen ya terminó de cargar sin contenido y, en ese caso, se avisa igual.
 */
export function useImagenFallida(alFallar: () => void) {
  return useCallback(
    (img: HTMLImageElement | null) => {
      if (img && img.complete && img.naturalWidth === 0) alFallar();
    },
    // alFallar cambia en cada render; basta con revisarla cuando la imagen se monta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}
