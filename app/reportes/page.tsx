import Link from "next/link";
import { obtenerFaltantes, obtenerResumenInventario, SIN_SESION } from "@/lib/reportes";
import { IDIOMAS } from "@/lib/validators/catalogo";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Reportes · PokeBinder" };

const CAMPO = "rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700";

const NOMBRES_IDIOMA: Record<(typeof IDIOMAS)[number], string> = {
  en: "Inglés",
  es: "Español",
  fr: "Francés",
  pt: "Portugués",
  ja: "Japonés",
  zh: "Chino",
};

function primero(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? "";
}

const dinero = new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD" });

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
  const setId = primero(parametros.setId);
  const idioma = primero(parametros.idioma);

  const resumen = await obtenerResumenInventario();

  if (!resumen.ok) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-8">
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          {resumen.error === SIN_SESION ? "Inicia sesión para ver tus reportes." : resumen.error}
        </p>
        {resumen.error === SIN_SESION && (
          <Link href="/login" className="text-sm underline">
            Ir a iniciar sesión
          </Link>
        )}
      </main>
    );
  }

  const datos = resumen.datos;
  // La validación real la hace obtenerFaltantes; el resultado trae el mensaje.
  const faltantes = setId === "" && idioma === "" ? null : await obtenerFaltantes({ setId, idioma });
  const consulta = (s: string, i: string) => `?setId=${encodeURIComponent(s)}&idioma=${encodeURIComponent(i)}`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Resumen de tu inventario y cartas que te faltan por set.</p>
      </header>

      <section aria-labelledby="titulo-resumen" className="flex flex-col gap-3">
        <h2 id="titulo-resumen" className="font-medium">
          Resumen del inventario
        </h2>
        {datos.copias === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            Tu inventario está vacío: aún no hay nada que reportar.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <dt className="text-zinc-600 dark:text-zinc-400">Copias</dt>
                <dd className="text-xl font-semibold">{datos.copias}</dd>
              </div>
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <dt className="text-zinc-600 dark:text-zinc-400">Cartas distintas</dt>
                <dd className="text-xl font-semibold">{datos.distintas}</dd>
              </div>
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <dt className="text-zinc-600 dark:text-zinc-400">Valor estimado</dt>
                <dd className="text-xl font-semibold">{dinero.format(datos.valorEstimado)}</dd>
              </div>
            </dl>
            {datos.sinPrecio > 0 && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {datos.sinPrecio === 1 ? "1 carta no tiene precio" : `${datos.sinPrecio} cartas no tienen precio`} y no suman al valor.
              </p>
            )}

            <h3 className="mt-2 text-sm font-medium">Por idioma</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {datos.porIdioma.map((i) => (
                <li key={i.idioma} className="flex justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                  <span>{NOMBRES_IDIOMA[i.idioma as keyof typeof NOMBRES_IDIOMA] ?? i.idioma}</span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {i.copias} copias · {i.distintas} distintas
                  </span>
                </li>
              ))}
            </ul>

            <h3 className="mt-2 text-sm font-medium">Por set</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {datos.porSet.map((s) => (
                <li key={`${s.setId}|${s.idioma}`}>
                  <Link
                    href={consulta(s.setId, s.idioma)}
                    className="flex justify-between rounded-md border border-zinc-200 px-3 py-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <span>
                      {datos.nombresSet[`${s.setId}|${s.idioma}`] ?? s.setId} · {s.idioma}
                    </span>
                    <span className="text-zinc-600 dark:text-zinc-400">
                      {s.copias} copias · {s.distintas} distintas · ver faltantes
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="titulo-faltantes" className="flex flex-col gap-3">
        <h2 id="titulo-faltantes" className="font-medium">
          Cartas faltantes de un set
        </h2>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Id del set (por ejemplo sv1)
            <input name="setId" defaultValue={setId} maxLength={30} className={CAMPO} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Idioma
            <select name="idioma" defaultValue={idioma} className={CAMPO}>
              <option value="">Elige uno</option>
              {IDIOMAS.map((i) => (
                <option key={i} value={i}>
                  {NOMBRES_IDIOMA[i]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Ver faltantes
          </button>
        </form>

        {faltantes && !faltantes.ok && (
          <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-sm text-red-900">
            {faltantes.error}
          </p>
        )}
        {faltantes?.ok && (
          <>
            <p className="text-sm">
              {faltantes.datos.nombreSet ?? faltantes.datos.setId} · {faltantes.datos.idioma}: tienes {faltantes.datos.tengo} de{" "}
              {faltantes.datos.total} ({faltantes.datos.porcentaje} %).
            </p>
            {faltantes.datos.faltan.length === 0 ? (
              <p role="status" className="rounded-md bg-green-100 px-4 py-2 text-sm text-green-900">
                Set completo: no te falta ninguna carta.
              </p>
            ) : (
              <>
                <p className="flex gap-4 text-sm">
                  <a href={`/reportes/exportar${consulta(faltantes.datos.setId, faltantes.datos.idioma)}&formato=csv`} download className="underline">
                    Descargar CSV
                  </a>
                  <a href={`/reportes/exportar${consulta(faltantes.datos.setId, faltantes.datos.idioma)}&formato=xlsx`} download className="underline">
                    Descargar Excel
                  </a>
                </p>
                <ul className="flex flex-col gap-1 text-sm">
                  {faltantes.datos.faltan.map((c) => (
                    <li key={c.id} className="flex justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                      <span>
                        {c.number} · {c.nombre}
                      </span>
                      <span className="text-zinc-600 dark:text-zinc-400">{c.rarity ?? ""}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
