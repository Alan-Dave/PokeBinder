import Link from "next/link";
import { cerrarSesionAccion } from "@/app/auth/acciones";
import { obtenerPerfilActual } from "@/lib/auth";
import { enlacesDeNavegacion } from "@/lib/navegacion";

const ENLACE = "rounded-xl px-3 py-2 font-bold hover:bg-amarillo focus-visible:bg-amarillo";

/**
 * Barra de navegación común. Se dibuja en el servidor con la sesión actual y,
 * en pantallas angostas, se pliega en un menú <details> que funciona sin
 * JavaScript. Los enlaces son comodidad visual: cada ruta protegida verifica
 * la sesión y el rol por su cuenta (regla 6).
 */
export default async function BarraNavegacion() {
  const perfil = await obtenerPerfilActual();
  const enlaces = enlacesDeNavegacion(perfil !== null, perfil?.rol ?? null);

  const sesion = perfil ? (
    <form action={cerrarSesionAccion}>
      <button type="submit" className="boton boton-neutro !py-1.5 text-base">
        Cerrar sesión
      </button>
    </form>
  ) : (
    <div className="flex items-center gap-2">
      <Link href="/login" className={ENLACE}>
        Iniciar sesión
      </Link>
      <Link href="/registro" className="boton boton-rojo !py-1.5 text-base">
        Crear cuenta
      </Link>
    </div>
  );

  return (
    <header className="sticky top-0 z-40 border-b-4 border-tinta bg-crema">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-titulo text-2xl font-extrabold">
          <span
            aria-hidden="true"
            className="inline-block h-7 w-5 -rotate-6 rounded-md border-[3px] border-tinta bg-rojo shadow-[2px_2px_0_var(--tinta)]"
          />
          PokeBinder
        </Link>

        {/* Pantallas anchas */}
        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          {enlaces.map((e) => (
            <Link key={e.href} href={e.href} className={ENLACE}>
              {e.texto}
            </Link>
          ))}
        </nav>
        <div className="hidden md:block">{sesion}</div>

        {/* Pantallas angostas */}
        <details className="relative md:hidden">
          <summary className="boton boton-amarillo list-none !py-1.5 text-base">Menú</summary>
          <div className="tarjeta absolute right-0 mt-3 flex w-64 flex-col gap-1 p-3">
            <nav aria-label="Principal (móvil)" className="flex flex-col gap-1">
              {enlaces.map((e) => (
                <Link key={e.href} href={e.href} className={ENLACE}>
                  {e.texto}
                </Link>
              ))}
            </nav>
            <div className="mt-2 border-t-2 border-tinta pt-3">{sesion}</div>
          </div>
        </details>
      </div>
    </header>
  );
}
