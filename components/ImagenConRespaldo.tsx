"use client";

import { useState } from "react";
import { useImagenFallida } from "@/components/useImagenFallida";

/** Ilustración que se muestra cuando una carta no tiene imagen o no carga (PBI-X15). */
export const IMAGEN_NO_DISPONIBLE = "/imagen-no-disponible.webp";

/**
 * La ilustración de «Imagen no disponible», ya en el formato vertical de las
 * cartas (63 × 88 mm). Es un archivo propio de la aplicación, no una URL externa.
 */
export function ImagenNoDisponible({ alt = "Imagen no disponible", className = "h-full w-full object-cover" }: { alt?: string; className?: string }) {
  // Archivo local fijo y pequeño: next/image no aporta nada aquí.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={IMAGEN_NO_DISPONIBLE} alt={alt} draggable={false} className={className} />;
}

type Props = {
  // URL firmada del bucket; null si la carta no tiene imagen.
  src: string | null;
  alt: string;
  draggable?: boolean;
};

/**
 * Imagen de una carta con reemplazo: si no hay URL o el navegador no logra
 * cargarla (404, URL firmada vencida, error de red), se muestra la ilustración
 * de «Imagen no disponible» en lugar de un icono roto.
 */
export default function ImagenConRespaldo({ src, alt, draggable = true }: Props) {
  // Se recuerda cuál URL falló, de modo que una URL nueva se intente de nuevo.
  const [fallida, setFallida] = useState<string | null>(null);

  const refImagen = useImagenFallida(() => setFallida(src));

  if (!src || fallida === src) {
    return <ImagenNoDisponible alt={alt ? `${alt} (imagen no disponible)` : ""} />;
  }

  return (
    // La URL está firmada y caduca: next/image la cachearía vencida.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      draggable={draggable}
      loading="lazy"
      ref={refImagen}
      onError={() => setFallida(src)}
      className="h-full w-full object-contain"
    />
  );
}
