import Link from "next/link";
import FilaColeccion from "@/components/FilaColeccion";
import { listarInventario, SIN_SESION, TAMANO_PAGINA } from "@/lib/inventario";
import { CANTIDAD_MAX, CANTIDAD_MIN } from "@/lib/validators/inventario";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Mi colección · PokeBinder" };

export default async function ColeccionPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string | string[] }>;
}) {
  const { pagina: paginaBruta } = await searchParams;
  const paginaTexto = Array.isArray(paginaBruta) ? paginaBruta[0] : paginaBruta;
  const pagina = paginaTexto === undefined ? 1 : Number(paginaTexto);

  // La validación real la hace listarInventario; el resultado trae el mensaje.
  const resultado = await listarInventario({ pagina });

  if (!resultado.ok) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-8">
        <h1 className="text-2xl font-semibold">Mi colección</h1>
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          {resultado.error === SIN_SESION ? "Inicia sesión para ver tu colección." : resultado.error}
        </p>
        {resultado.error !== SIN_SESION && (
          <Link href="/coleccion" className="text-sm underline">
            Volver a la primera página
          </Link>
        )}
      </main>
    );
  }

  const { filas, total } = resultado.datos;
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Mi colección</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {total === 1 ? "1 registro" : `${total} registros`} en tu inventario
        </p>
      </header>

      {filas.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 p-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          Tu inventario está vacío. Podrás agregar cartas desde el catálogo cuando esté disponible.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filas.map((fila) => (
            <FilaColeccion key={fila.id} fila={fila} min={CANTIDAD_MIN} max={CANTIDAD_MAX} />
          ))}
        </ul>
      )}

      {totalPaginas > 1 && (
        <nav aria-label="Paginación" className="flex items-center justify-between text-sm">
          {pagina > 1 ? (
            <Link href={`/coleccion?pagina=${pagina - 1}`} className="underline">
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span>
            Página {pagina} de {totalPaginas}
          </span>
          {pagina < totalPaginas ? (
            <Link href={`/coleccion?pagina=${pagina + 1}`} className="underline">
              Siguiente →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
