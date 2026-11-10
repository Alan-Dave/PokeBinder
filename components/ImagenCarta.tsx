"use client";

import { useState } from "react";
import { ImagenNoDisponible } from "@/components/ImagenConRespaldo";

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
 * la ilustración de «Imagen no disponible». El respaldo existe porque solo ~22 % del catálogo
 * tiene imagen en el bucket.
 */
export default function ImagenCarta({ url, urlRespaldo, alt }: Props) {
  const [fuentes, setFuentes] = useState<string[]>(url ? [url, urlRespaldo] : [urlRespaldo]);

  if (fuentes.length === 0) {
    return <ImagenNoDisponible alt={`${alt} (imagen no disponible)`} />;
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
