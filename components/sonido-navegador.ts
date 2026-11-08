"use client";

import { useSyncExternalStore } from "react";
import { EVENTO_SONIDO, guardarSonido, leerSonido, reproducirTono, type Almacen, type Tono } from "@/lib/sonido";

/**
 * Pegamento con el navegador para los sonidos (PBI-X12): almacenamiento, evento
 * entre componentes y contexto de audio. La lógica que se puede probar está en
 * lib/sonido.ts. Todo está protegido: si el navegador no ofrece Web Audio o
 * bloquea el almacenamiento, la aplicación sigue funcionando en silencio.
 */

function almacenLocal(): Almacen | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// Respaldo para esta sesión si el navegador no deja guardar la preferencia.
let enMemoria = false;

function sonidoActivo(): boolean {
  return leerSonido(almacenLocal()) || enMemoria;
}

function suscribir(avisar: () => void): () => void {
  window.addEventListener("storage", avisar);
  window.addEventListener(EVENTO_SONIDO, avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener(EVENTO_SONIDO, avisar);
  };
}

/** true si el usuario activó el sonido; en el servidor siempre false (apagado). */
export function useSonidoActivo(): boolean {
  return useSyncExternalStore(suscribir, sonidoActivo, () => false);
}

/** Cambia la preferencia y avisa a los demás componentes. */
export function fijarSonido(activo: boolean): void {
  enMemoria = activo;
  guardarSonido(almacenLocal(), activo);
  window.dispatchEvent(new Event(EVENTO_SONIDO));
}

let contexto: AudioContext | null = null;

/** Toca un tono. Se llama siempre dentro de un gesto del usuario (clic), como exige el navegador. */
export function sonar(tono: Tono): void {
  try {
    contexto ??= new window.AudioContext();
    if (contexto.state === "suspended") void contexto.resume();
    reproducirTono(contexto, tono);
  } catch {
    // Sin Web Audio no hay sonido; nada más que hacer.
  }
}
