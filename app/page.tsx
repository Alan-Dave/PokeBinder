import Link from "next/link";
import { cerrarSesionAccion } from "@/app/auth/acciones";
import { obtenerPerfilActual } from "@/lib/auth";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

export default async function Home() {
  const perfil = await obtenerPerfilActual();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">PokeBinder</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Gestión de colecciones físicas de Pokémon TCG
      </p>

      <nav aria-label="Principal" className="flex gap-4 text-sm">
        <Link href="/catalogo" className="underline">
          Catálogo
        </Link>
        {perfil && (
          <Link href="/coleccion" className="underline">
            Mi colección
          </Link>
        )}
      </nav>

      {perfil ? (
        <div className="flex flex-col items-center gap-3">
          <p>Sesión iniciada como {perfil.nombreVisible ?? perfil.correo ?? "usuario"}.</p>
          <form action={cerrarSesionAccion}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : (
        <div className="flex gap-4 text-sm">
          <Link href="/login" className="underline">
            Iniciar sesión
          </Link>
          <Link href="/registro" className="underline">
            Crear cuenta
          </Link>
        </div>
      )}
    </main>
  );
}
