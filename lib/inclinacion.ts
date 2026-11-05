// Lógica del efecto 3D del visor de imágenes. Va aparte del componente para
// poder probarla sin navegador.

/** Inclinación máxima de la carta, en grados, hacia cada lado. */
export const INCLINACION_MAX = 14;

export type Inclinacion = {
  /** Giro sobre el eje X (grados). Positivo inclina el borde superior hacia atrás. */
  rotX: number;
  /** Giro sobre el eje Y (grados). Positivo inclina el borde derecho hacia atrás. */
  rotY: number;
  /** Posición del brillo, de 0 a 100 (% del ancho). */
  brilloX: number;
  /** Posición del brillo, de 0 a 100 (% del alto). */
  brilloY: number;
};

/** Carta quieta y brillo al centro: también es el valor ante cualquier entrada inválida. */
export const INCLINACION_NEUTRA: Inclinacion = { rotX: 0, rotY: 0, brilloX: 50, brilloY: 50 };

type Caja = { left: number; top: number; width: number; height: number };

function entre(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

/**
 * Inclinación para un puntero en (x, y), con la caja de la carta tal como la
 * entrega getBoundingClientRect(). El puntero en el centro deja la carta
 * quieta; en un borde la inclina al máximo hacia ese lado. Un puntero fuera
 * de la carta se trata como si estuviera en su borde más cercano.
 */
export function calcularInclinacion(x: number, y: number, caja: Caja): Inclinacion {
  const { left, top, width, height } = caja;
  if (![x, y, left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return INCLINACION_NEUTRA;
  }

  const relX = entre((x - left) / width, 0, 1);
  const relY = entre((y - top) / height, 0, 1);

  return {
    // Puntero arriba (relY bajo): el borde superior se aleja, rotX positivo.
    rotX: (0.5 - relY) * 2 * INCLINACION_MAX,
    // Puntero a la derecha (relX alto): el borde derecho se aleja, rotY positivo.
    rotY: (relX - 0.5) * 2 * INCLINACION_MAX,
    brilloX: relX * 100,
    brilloY: relY * 100,
  };
}
