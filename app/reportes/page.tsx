import Link from "next/link";
import { obtenerFaltantes, obtenerResumenInventario, SIN_SESION } from "@/lib/reportes";
import { IDIOMAS } from "@/lib/validators/catalogo";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Reportes · PokeBinder" };

const CAMPO = "rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700";
const BOTON =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

const NOMBRES_IDIOMA: Record<(typeof IDIOMAS)[number], string> = {
  en: "Inglés",
  es: "Español",
  fr: "Francés",
  pt: "Portugués",
  ja: "Japonés",
  zh: "Chino",
};

// Los dos reportes comparten la URL: cada uno conserva los parámetros del otro.
// Los del resumen llevan prefijo «filtro» para no chocar con los de faltantes.
const PARAMETROS = ["filtroIdioma", "filtroSet", "filtroRareza", "setId", "idioma", "rareza"] as const;
type Parametro = (typeof PARAMETROS)[number];

function primero(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? "";
}

const dinero = new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD" });

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const crudos = await searchParams;
  const p = Object.fromEntries(PARAMETROS.map((k) => [k, primero(crudos[k])])) as Record<Parametro, string>;

  // La validación real la hacen las funciones de lib/; el resultado trae el mensaje.
  const resumen = await obtenerResumenInventario({ idioma: p.filtroIdioma, setId: p.filtroSet, rareza: p.filtroRareza });

  if (!resumen.ok && resumen.error === SIN_SESION) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-8">
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          Inicia sesión para ver tus reportes.
        </p>
        <Link href="/login" className="text-sm underline">
          Ir a iniciar sesión
        </Link>
      </main>
    );
  }

  const faltantes =
    p.setId === "" && p.idioma === "" ? null : await obtenerFaltantes({ setId: p.setId, idioma: p.idioma, rareza: p.rareza });

  /** Enlace a esta página con los parámetros actuales, cambiando los indicados. */
  const enlace = (cambios: Partial<Record<Parametro, string>>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...p, ...cambios })) if (v !== "") q.set(k, v);
    return `?${q}`;
  };
  const urlExportarInventario = (formato: string) => {
    const q = new URLSearchParams({ formato });
    if (p.filtroIdioma) q.set("idioma", p.filtroIdioma);
    if (p.filtroSet) q.set("setId", p.filtroSet);
    if (p.filtroRareza) q.set("rareza", p.filtroRareza);
    return `/coleccion/exportar?${q}`;
  };
  const urlExportarFaltantes = (formato: string) => {
    const q = new URLSearchParams({ setId: p.setId, idioma: p.idioma, formato });
    if (p.rareza) q.set("rareza", p.rareza);
    return `/reportes/exportar?${q}`;
  };
  const hayFiltros = p.filtroIdioma !== "" || p.filtroSet !== "" || p.filtroRareza !== "";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Resumen de tu inventario y cartas que te faltan por set. Los filtros quedan en la dirección: puedes guardarla.
        </p>
      </header>

      <section aria-labelledby="titulo-resumen" className="flex flex-col gap-3">
        <h2 id="titulo-resumen" className="font-medium">
          Resumen del inventario
        </h2>

        <form method="get" className="flex flex-wrap items-end gap-3">
          {(["setId", "idioma", "rareza"] as const).map((k) => (
            <input key={k} type="hidden" name={k} value={p[k]} />
          ))}
          <label className="flex flex-col gap-1 text-sm">
            Idioma
            <select name="filtroIdioma" defaultValue={p.filtroIdioma} className={CAMPO}>
              <option value="">Todos</option>
              {IDIOMAS.map((i) => (
                <option key={i} value={i}>
                  {NOMBRES_IDIOMA[i]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Id del set
            <input name="filtroSet" defaultValue={p.filtroSet} maxLength={30} className={CAMPO} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Rareza (empieza con)
            <input name="filtroRareza" defaultValue={p.filtroRareza} maxLength={60} className={CAMPO} />
          </label>
          <button type="submit" className={BOTON}>
            Filtrar
          </button>
          {hayFiltros && (
            <Link href={enlace({ filtroIdioma: "", filtroSet: "", filtroRareza: "" })} className="py-1.5 text-sm underline">
              Quitar filtros
            </Link>
          )}
        </form>

        {!resumen.ok ? (
          <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-sm text-red-900">
            {resumen.error}
          </p>
        ) : resumen.datos.copias === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            {hayFiltros ? "Ninguna carta de tu inventario coincide con los filtros." : "Tu inventario está vacío: aún no hay nada que reportar."}
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <dt className="text-zinc-600 dark:text-zinc-400">Copias</dt>
                <dd className="text-xl font-semibold">{resumen.datos.copias}</dd>
              </div>
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <dt className="text-zinc-600 dark:text-zinc-400">Cartas distintas</dt>
                <dd className="text-xl font-semibold">{resumen.datos.distintas}</dd>
              </div>
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <dt className="text-zinc-600 dark:text-zinc-400">Valor estimado</dt>
                <dd className="text-xl font-semibold">{dinero.format(resumen.datos.valorEstimado)}</dd>
              </div>
            </dl>
            {resumen.datos.sinPrecio > 0 && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {resumen.datos.sinPrecio === 1 ? "1 carta no tiene precio" : `${resumen.datos.sinPrecio} cartas no tienen precio`} y no suman al
                valor.
              </p>
            )}
            <p className="flex gap-4 text-sm">
              <a href={urlExportarInventario("csv")} download className="underline">
                Descargar CSV{hayFiltros ? " (con filtros)" : ""}
              </a>
              <a href={urlExportarInventario("xlsx")} download className="underline">
                Descargar Excel{hayFiltros ? " (con filtros)" : ""}
              </a>
            </p>

            <h3 className="mt-2 text-sm font-medium">Por idioma</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {resumen.datos.porIdioma.map((i) => (
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
              {resumen.datos.porSet.map((s) => (
                <li key={`${s.setId}|${s.idioma}`}>
                  <Link
                    href={enlace({ setId: s.setId, idioma: s.idioma })}
                    className="flex justify-between rounded-md border border-zinc-200 px-3 py-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                  >
                    <span>
                      {resumen.datos.nombresSet[`${s.setId}|${s.idioma}`] ?? s.setId} · {s.idioma}
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
          {(["filtroIdioma", "filtroSet", "filtroRareza"] as const).map((k) => (
            <input key={k} type="hidden" name={k} value={p[k]} />
          ))}
          <label className="flex flex-col gap-1 text-sm">
            Id del set (por ejemplo sv1)
            <input name="setId" defaultValue={p.setId} maxLength={30} className={CAMPO} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Idioma
            <select name="idioma" defaultValue={p.idioma} className={CAMPO}>
              <option value="">Elige uno</option>
              {IDIOMAS.map((i) => (
                <option key={i} value={i}>
                  {NOMBRES_IDIOMA[i]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Rareza (empieza con)
            <input name="rareza" defaultValue={p.rareza} maxLength={60} className={CAMPO} />
          </label>
          <button type="submit" className={BOTON}>
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
              {faltantes.datos.nombreSet ?? faltantes.datos.setId} · {faltantes.datos.idioma}
              {p.rareza !== "" && ` · rareza «${p.rareza}»`}: tienes {faltantes.datos.tengo} de {faltantes.datos.total} (
              {faltantes.datos.porcentaje} %).
            </p>
            {faltantes.datos.faltan.length === 0 ? (
              <p role="status" className="rounded-md bg-green-100 px-4 py-2 text-sm text-green-900">
                No te falta ninguna carta{p.rareza !== "" ? " con esa rareza" : ": set completo"}.
              </p>
            ) : (
              <>
                <p className="flex gap-4 text-sm">
                  <a href={urlExportarFaltantes("csv")} download className="underline">
                    Descargar CSV
                  </a>
                  <a href={urlExportarFaltantes("xlsx")} download className="underline">
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
