/**
 * Geometría y reparto de las hojas de proxies (PBI-20). Funciones puras:
 * separadas de lib/proxies-pdf.ts (que importa "server-only" y lee imágenes)
 * para poder probarlas con Vitest.
 *
 * Las medidas son fijas (regla 8): cada carta mide exactamente 63 × 88 mm, el
 * tamaño de una carta real, sin escalar. Nunca vienen del usuario.
 */

const PT_POR_MM = 72 / 25.4;

export const mm = (valor: number): number => valor * PT_POR_MM;

export const CARTA_ANCHO_MM = 63;
export const CARTA_ALTO_MM = 88;

// A4 vertical.
export const PAGINA_ANCHO_MM = 210;
export const PAGINA_ALTO_MM = 297;

export const COLUMNAS = 3;
export const FILAS = 3;
export const CARTAS_POR_PAGINA = COLUMNAS * FILAS;

// Una hoja de 9 cartas ocupa 189 × 264 mm: sobran 21 y 33 mm que se reparten
// en márgenes iguales, lo que deja sitio para las marcas de corte.
export const MARGEN_X_MM = (PAGINA_ANCHO_MM - COLUMNAS * CARTA_ANCHO_MM) / 2;
export const MARGEN_Y_MM = (PAGINA_ALTO_MM - FILAS * CARTA_ALTO_MM) / 2;

/** Tope de cartas por PDF: 20 hojas. Un mazo legal tiene 60. */
export const PROXIES_MAX = 180;

export type Posicion = { x: number; y: number };

/**
 * Esquina inferior izquierda de cada carta, en puntos y con el origen abajo a
 * la izquierda (como en PDF). Se numeran por filas, de arriba a abajo.
 */
export function posicionesPagina(): Posicion[] {
  const posiciones: Posicion[] = [];
  for (let fila = 0; fila < FILAS; fila++) {
    for (let columna = 0; columna < COLUMNAS; columna++) {
      posiciones.push({
        x: mm(MARGEN_X_MM + columna * CARTA_ANCHO_MM),
        y: mm(PAGINA_ALTO_MM - MARGEN_Y_MM - (fila + 1) * CARTA_ALTO_MM),
      });
    }
  }
  return posiciones;
}

export type Marca = { x1: number; y1: number; x2: number; y2: number };

const LARGO_MARCA_MM = 4;

/**
 * Marcas de corte: una raya corta fuera de la hoja de cartas por cada borde
 * vertical y horizontal. Quedan en el margen, nunca sobre una carta.
 */
export function marcasDeCorte(): Marca[] {
  const marcas: Marca[] = [];
  const izquierda = MARGEN_X_MM;
  const derecha = PAGINA_ANCHO_MM - MARGEN_X_MM;
  const arriba = PAGINA_ALTO_MM - MARGEN_Y_MM;
  const abajo = MARGEN_Y_MM;

  for (let c = 0; c <= COLUMNAS; c++) {
    const x = izquierda + c * CARTA_ANCHO_MM;
    marcas.push({ x1: mm(x), y1: mm(arriba), x2: mm(x), y2: mm(arriba + LARGO_MARCA_MM) });
    marcas.push({ x1: mm(x), y1: mm(abajo), x2: mm(x), y2: mm(abajo - LARGO_MARCA_MM) });
  }
  for (let f = 0; f <= FILAS; f++) {
    const y = arriba - f * CARTA_ALTO_MM;
    marcas.push({ x1: mm(izquierda), y1: mm(y), x2: mm(izquierda - LARGO_MARCA_MM), y2: mm(y) });
    marcas.push({ x1: mm(derecha), y1: mm(y), x2: mm(derecha + LARGO_MARCA_MM), y2: mm(y) });
  }
  return marcas;
}

export type LineaProxy = { cartaId: number; nombre: string; nombreEn?: string | null; cantidad: number };
export type CartaProxy = { cartaId: number; nombre: string; nombreEn?: string | null };

/** Una carta por copia: tres copias de una carta ocupan tres casillas. */
export function expandirCopias(lineas: readonly LineaProxy[]): CartaProxy[] {
  return lineas.flatMap((l) => Array.from({ length: l.cantidad }, () => ({ cartaId: l.cartaId, nombre: l.nombre, nombreEn: l.nombreEn })));
}

export function paginar<T>(items: readonly T[], porPagina: number = CARTAS_POR_PAGINA): T[][] {
  const paginas: T[][] = [];
  for (let i = 0; i < items.length; i += porPagina) paginas.push(items.slice(i, i + porPagina));
  return paginas;
}

/**
 * Los tipos de letra estándar de PDF solo codifican Latin-1: un nombre con
 * kana o hanzi haría fallar el dibujo. Se quitan acentos y todo lo que no sea
 * ASCII imprimible; si no queda nada, se usa un texto genérico.
 */
export function textoSeguro(nombre: string): string {
  const limpio = nombre
    .normalize("NFD")
    .replace(/[^\x20-\x7E]/g, "")
    .trim();
  return limpio === "" ? "Carta" : limpio;
}

const TIENE_LETRAS = /[A-Za-z0-9]/;

/**
 * Nombre que se escribe en un proxy sin imagen. Si el propio no tiene ni una
 * letra o cifra imprimible (por ejemplo «<>» o puro kana), no identifica la
 * carta: se usa el de su edición en inglés, si lo hay.
 */
export function nombreParaProxy(nombre: string, nombreEn?: string | null): string {
  const propio = textoSeguro(nombre);
  if (nombre !== "" && TIENE_LETRAS.test(propio) && propio !== "Carta") return nombre;
  if (nombreEn && TIENE_LETRAS.test(textoSeguro(nombreEn)) && textoSeguro(nombreEn) !== "Carta") return nombreEn;
  return nombre;
}
