"use client";

import { useState } from "react";

type Props = {
  // Imagen firmada del bucket; null si la carta no tiene.
  url: string | null;
  // Miniatura de /api/cartas/{id}/imagen-hd?tam=min, que la saca de TCGdex.
  urlRespaldo: string;
  alt: string;
};

/**
 * Imagen de una carta en el catálogo.
 *
 * Orden: la del bucket, después la miniatura de TCGdex y, si ninguna carga,
 * el texto "Sin imagen". El respaldo existe porque solo ~22 % del catálogo
 * tiene imagen en el bucket.
 */
export default function ImagenCarta({ url, urlRespaldo, alt }: Props) {
  const [fuentes, setFuentes] = useState<string[]>(url ? [url, urlRespaldo] : [urlRespaldo]);

  if (fuentes.length === 0) {
    return (
      <span className="flex flex-col items-center gap-2 text-center text-sm font-bold">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <circle cx="9" cy="10" r="2" />
          <path d="M21 16l-5-5-8 8" />
        </svg>
        Sin imagen
      </span>
    );
  }

  return (
    // La URL del bucket está firmada y caduca: el optimizador de next/image
    // no aporta nada y cachearía una URL vencida.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={fuentes[0]}
      src={fuentes[0]}
      alt={alt}
      loading="lazy"
      onError={() => setFuentes((actuales) => actuales.slice(1))}
      className="h-full w-full object-contain"
    />
  );
}
