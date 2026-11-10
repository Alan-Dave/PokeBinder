import Image from "next/image";

/**
 * El logo de PokeBinder en grande, para la portada y las pantallas de acceso.
 *
 * Es decorativo (alt vacío): la barra de navegación ya anuncia «PokeBinder» como
 * enlace a la portada, y repetirlo en cada pantalla lo haría sonar dos veces a
 * quien usa un lector de pantalla.
 */
export default function LogoMarca({ className = "h-24 w-auto", sizes = "240px", priority = false }: { className?: string; sizes?: string; priority?: boolean }) {
  return <Image src="/logo.png" alt="" width={960} height={426} sizes={sizes} priority={priority} className={className} />;
}
