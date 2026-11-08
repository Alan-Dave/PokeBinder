import Link from "next/link";
import { IconoCarpeta } from "@/components/CarpetaBinder";
import FormularioBinder from "@/components/FormularioBinder";
import { listarBinders, SIN_SESION } from "@/lib/binders";
import { CUADRICULAS, PAGINAS_MAX, PAGINAS_MIN } from "@/lib/validators/binders";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Mis binders · PokeBinder" };

export default async function BinderPage() {
  const resultado = await listarBinders();

  if (!resultado.ok) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-8">
        <h1 className="text-2xl font-semibold">Mis binders</h1>
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          {resultado.error === SIN_SESION ? "Inicia sesión para ver tus binders." : resultado.error}
        </p>
        {resultado.error === SIN_SESION && (
          <Link href="/login" className="text-sm underline">
            Ir a iniciar sesión
          </Link>
        )}
      </main>
    );
  }

  const binders = resultado.datos;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Mis binders</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Ordena las cartas de tu colección en páginas con la cuadrícula que prefieras.
        </p>
      </header>

      <FormularioBinder cuadriculas={CUADRICULAS} paginasMin={PAGINAS_MIN} paginasMax={PAGINAS_MAX} />

      {binders.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 p-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          Aún no tienes binders. Crea el primero arriba.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {binders.map((b) => (
            <li key={b.id}>
              <Link
                href={`/binder/${b.id}`}
                className="tarjeta flex items-center gap-4 p-4 hover:bg-amarillo focus-visible:bg-amarillo"
              >
                <IconoCarpeta id={b.id} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-lg font-extrabold">{b.nombre}</span>
                  <span className="text-sm font-bold">
                    {b.cuadricula.replace("x", " × ")} · {b.paginas === 1 ? "1 página" : `${b.paginas} páginas`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
