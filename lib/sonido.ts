/**
 * Sonidos de interacción opcionales (PBI-X12).
 *
 * Todo lo que no depende del navegador vive aquí para poder probarse: qué
 * tonos hay, cómo se guarda la preferencia y qué clics hacen sonar. Los tonos
 * se generan con Web Audio (sin archivos de audio). La preferencia es solo del
 * navegador: no sale al servidor. Por defecto está apagado.
 */

export const CLAVE_SONIDO = "pokebinder-sonido";
export const EVENTO_SONIDO = "pokebinder:sonido";

export type Tono = "clic" | "error";

type DefinicionTono = {
  /** Una nota por frecuencia, una detrás de otra. */
  frecuencias: readonly number[];
  /** Duración total en segundos. */
  duracion: number;
  tipo: OscillatorType;
  /** Ganancia máxima (0 a 1): baja a propósito, es un detalle y no un aviso. */
  volumen: number;
};

export const TONOS: Record<Tono, DefinicionTono> = {
  clic: { frecuencias: [660], duracion: 0.07, tipo: "sine", volumen: 0.06 },
  // Dos notas que bajan: se distingue del clic sin ser estridente.
  error: { frecuencias: [330, 247], duracion: 0.2, tipo: "triangle", volumen: 0.07 },
};

// --- Preferencia -----------------------------------------------------------

export type Almacen = Pick<Storage, "getItem" | "setItem">;

/** Lee si el sonido está activo. Sin almacenamiento o con error, está apagado. */
export function leerSonido(almacen: Almacen | null): boolean {
  try {
    return almacen?.getItem(CLAVE_SONIDO) === "1";
  } catch {
    return false;
  }
}

/** Guarda la preferencia. Devuelve false si el navegador no dejó guardarla. */
export function guardarSonido(almacen: Almacen | null, activo: boolean): boolean {
  try {
    if (!almacen) return false;
    almacen.setItem(CLAVE_SONIDO, activo ? "1" : "0");
    return true;
  } catch {
    return false;
  }
}

// --- Qué clics hacen sonar -------------------------------------------------

export type ControlClick = {
  getAttribute(nombre: string): string | null;
  hasAttribute(nombre: string): boolean;
};
export type ObjetivoClick = { closest(selector: string): ControlClick | null };

const SELECTOR_CONTROL = [
  "button",
  "a[href]",
  "summary",
  "[role='tab']",
  "[role='button']",
  "input[type='checkbox']",
  "input[type='radio']",
  "input[type='submit']",
].join(", ");

/** El tono de un clic, o null si no cayó en un control o el control está deshabilitado. */
export function tonoDeClick(objetivo: ObjetivoClick | null): Tono | null {
  const control = objetivo?.closest(SELECTOR_CONTROL) ?? null;
  if (!control) return null;
  if (control.hasAttribute("disabled") || control.getAttribute("aria-disabled") === "true") return null;
  return "clic";
}

// --- Reproducción ----------------------------------------------------------

/** Toca un tono en el contexto de audio dado. */
export function reproducirTono(contexto: AudioContext, tono: Tono): void {
  const { frecuencias, duracion, tipo, volumen } = TONOS[tono];
  const paso = duracion / frecuencias.length;

  frecuencias.forEach((frecuencia, i) => {
    const inicio = contexto.currentTime + i * paso;
    const oscilador = contexto.createOscillator();
    const ganancia = contexto.createGain();

    oscilador.type = tipo;
    oscilador.frequency.value = frecuencia;
    // Sube y baja suave: un corte brusco suena como un chasquido.
    ganancia.gain.setValueAtTime(0.0001, inicio);
    ganancia.gain.exponentialRampToValueAtTime(volumen, inicio + 0.01);
    ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + paso);

    oscilador.connect(ganancia);
    ganancia.connect(contexto.destination);
    oscilador.start(inicio);
    oscilador.stop(inicio + paso + 0.02);
  });
}
