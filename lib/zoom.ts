// Lógica del zoom del visor de imágenes. Va aparte del componente para poder
// probarla sin navegador.

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;
const PASO_RUEDA = 0.25;

/** Deja el zoom dentro de [ZOOM_MIN, ZOOM_MAX]; un valor no numérico vuelve al mínimo. */
export function limitarZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return ZOOM_MIN;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}

/** Zoom tras un giro de rueda: deltaY negativo (hacia arriba) acerca. */
export function zoomPorRueda(zoom: number, deltaY: number): number {
  if (deltaY === 0 || Number.isNaN(deltaY)) return limitarZoom(zoom);
  return limitarZoom(zoom + (deltaY < 0 ? PASO_RUEDA : -PASO_RUEDA));
}

/** Zoom tras un clic: acerca en pasos de 1x y, al llegar al máximo, vuelve al mínimo. */
export function zoomPorClic(zoom: number): number {
  return zoom >= ZOOM_MAX ? ZOOM_MIN : limitarZoom(Math.floor(zoom) + 1);
}
