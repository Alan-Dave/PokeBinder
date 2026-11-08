/**
 * Colores de las cartas del catálogo según su tipo (PBI-X3).
 *
 * Los datos traen el tipo en inglés ("Grass"), pero el filtro puede ofrecerlo
 * en español, así que se aceptan ambos. Un tipo desconocido o vacío usa el
 * estilo neutro: nunca falla la página por un valor inesperado.
 * Cada par de texto y fondo cumple contraste AA (4,5 a 1).
 *
 * Las clases van escritas completas: Tailwind solo genera las que ve en el código.
 */
export type EstiloCarta = {
  /** Etiqueta del tipo. */
  chip: string;
  /** Fondo del recuadro cuando la carta no tiene imagen. */
  panel: string;
};

const NEUTRO: EstiloCarta = { chip: "bg-[#e9e9ee] text-tinta", panel: "bg-[#e9e9ee]" };

const ESTILOS: Record<string, EstiloCarta> = {
  grass: { chip: "bg-verde text-white", panel: "bg-[#b8f0d6]" },
  fire: { chip: "bg-rojo text-white", panel: "bg-[#ffd9d4]" },
  water: { chip: "bg-azul text-white", panel: "bg-[#bfd3ff]" },
  lightning: { chip: "bg-amarillo text-tinta", panel: "bg-[#fff0bf]" },
  psychic: { chip: "bg-[#7a3fd1] text-white", panel: "bg-[#e5d6fa]" },
  fighting: { chip: "bg-[#8a4b1f] text-white", panel: "bg-[#f1dccb]" },
  darkness: { chip: "bg-tinta text-white", panel: "bg-[#cfd2e6]" },
  metal: { chip: "bg-[#5b6577] text-white", panel: "bg-[#dde1e8]" },
  dragon: { chip: "bg-[#b45309] text-white", panel: "bg-[#fbdcb8]" },
  fairy: { chip: "bg-[#ffb3d1] text-tinta", panel: "bg-[#ffe3ef]" },
  colorless: NEUTRO,
};

// Nombres en español que puede traer el filtro, hacia la clave en inglés.
const SINONIMOS: Record<string, string> = {
  planta: "grass",
  fuego: "fire",
  agua: "water",
  rayo: "lightning",
  electrico: "lightning",
  psiquico: "psychic",
  lucha: "fighting",
  oscuridad: "darkness",
  metalico: "metal",
  metal: "metal",
  dragon: "dragon",
  hada: "fairy",
  incoloro: "colorless",
};

function normalizar(tipo: string): string {
  return tipo
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function estiloDeTipo(tipo: string | null | undefined): EstiloCarta {
  if (!tipo) return NEUTRO;
  const clave = normalizar(tipo);
  // hasOwn: un valor como "constructor" no debe resolver a algo heredado de Object.
  const canonica = Object.hasOwn(SINONIMOS, clave) ? SINONIMOS[clave] : clave;
  return Object.hasOwn(ESTILOS, canonica) ? ESTILOS[canonica] : NEUTRO;
}
