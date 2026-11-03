import Link from "next/link";
import FormularioMazo from "@/components/FormularioMazo";
import { listarMazos, SIN_SESION } from "@/lib/mazos";
import { TAMANO_MAZO } from "@/lib/reglas-mazo";
import { NOMBRE_MAZO_MAX } from "@/lib/validators/mazos";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Mis mazos · PokeBinder" };

export default async function MazosPage() {
  const resultado = await listarMazos();

  if (!resultado.ok) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-8">
        <h1 className="text-2xl font-semibold">Mis mazos</h1>
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          {resultado.error === SIN_SESION ? "Inicia sesión para ver tus mazos." : resultado.error}
        </p>
        {resultado.error === SIN_SESION && (
          <Link href="/login" className="text-sm underline">
            Ir a iniciar sesión
          </Link>
        )}
      </main>
    );
  }

  const mazos = resultado.datos;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Mis mazos</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Arma mazos de {TAMANO_MAZO} cartas y comprueba que cumplan las reglas.
        </p>
      </header>

      <FormularioMazo nombreMax={NOMBRE_MAZO_MAX} />

      {mazos.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 p-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          Aún no tienes mazos. Crea el primero arriba.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {mazos.map((m) => (
            <li key={m.id}>
              <Link
                href={`/mazos/${m.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <span className="font-medium">{m.nombre}</span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {m.totalCartas} de {TAMANO_MAZO} cartas
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
