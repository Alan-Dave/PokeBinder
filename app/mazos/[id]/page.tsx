import Link from "next/link";
import AgregarAlMazo from "@/components/AgregarAlMazo";
import EliminarMazo from "@/components/EliminarMazo";
import FilaMazo from "@/components/FilaMazo";
import { buscarCartas } from "@/lib/catalogo";
import { obtenerMazo, SIN_SESION } from "@/lib/mazos";
import { COPIAS_MAX, TAMANO_MAZO } from "@/lib/reglas-mazo";
import { CANTIDAD_MAZO_MAX, CANTIDAD_MAZO_MIN } from "@/lib/validators/mazos";
import { IDIOMAS } from "@/lib/validators/catalogo";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Mazo · PokeBinder" };

const NOMBRES_IDIOMA: Record<(typeof IDIOMAS)[number], string> = {
  en: "Inglés",
  es: "Español",
  fr: "Francés",
  pt: "Portugués",
  ja: "Japonés",
  zh: "Chino",
};

const CAMPO = "rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700";

// La ruta llega como texto: solo dígitos, de 1 a 15, sin ceros a la izquierda.
function entero(texto: string | undefined): number {
  return texto !== undefined && /^[1-9]\d{0,14}$/.test(texto) ? Number(texto) : Number.NaN;
}

function primero(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? "";
}

export default async function MazoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const parametros = await searchParams;
  const texto = primero(parametros.texto);
  const idioma = primero(parametros.idioma);

  // La validación real la hace obtenerMazo; el resultado trae el mensaje.
  const resultado = await obtenerMazo({ mazoId: entero(id) });

  if (!resultado.ok) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-8">
        <h1 className="text-2xl font-semibold">Mazo</h1>
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          {resultado.error === SIN_SESION ? "Inicia sesión para ver tu mazo." : resultado.error}
        </p>
        <Link href={resultado.error === SIN_SESION ? "/login" : "/mazos"} className="text-sm underline">
          {resultado.error === SIN_SESION ? "Ir a iniciar sesión" : "Volver a mis mazos"}
        </Link>
      </main>
    );
  }

  const { mazo, lineas, reglas } = resultado.datos;

  // Sin texto no se consulta el catálogo: son 95.000 cartas.
  const busqueda = texto === "" ? null : await buscarCartas({ texto, idioma, pagina: 1 });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <Link href="/mazos" className="text-sm underline">
          ← Mis mazos
        </Link>
        <h1 className="text-2xl font-semibold">{mazo.nombre}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {reglas.total} de {TAMANO_MAZO} cartas · máximo {COPIAS_MAX} copias por nombre
        </p>
      </header>

      <section aria-labelledby="titulo-reglas" className="flex flex-col gap-2">
        <h2 id="titulo-reglas" className="font-medium">
          Reglas
        </h2>
        {reglas.cumple ? (
          <p role="status" className="rounded-md bg-green-100 px-4 py-2 text-sm text-green-900">
            Cumple las reglas que se pueden comprobar.
          </p>
        ) : (
          <ul role="alert" className="flex list-disc flex-col gap-1 rounded-md bg-red-100 py-2 pl-8 pr-4 text-sm text-red-900">
            {reglas.errores.map((e) => (
              <li key={`${e.regla}-${e.mensaje}`}>{e.mensaje}</li>
            ))}
          </ul>
        )}
        {reglas.advertencias.length > 0 && (
          <ul className="flex list-disc flex-col gap-1 rounded-md bg-amber-100 py-2 pl-8 pr-4 text-sm text-amber-900">
            {reglas.advertencias.map((a) => (
              <li key={`${a.regla}-${a.mensaje}`}>{a.mensaje}</li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-cartas" className="flex flex-col gap-3">
        <h2 id="titulo-cartas" className="font-medium">
          Cartas del mazo
        </h2>
        {lineas.length === 0 ? (
          <p className="rounded-md border border-dashed border-zinc-300 p-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            El mazo está vacío. Busca cartas abajo para agregarlas.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {lineas.map((linea) => (
              <FilaMazo
                key={linea.cartaId}
                mazoId={mazo.id}
                linea={linea}
                min={CANTIDAD_MAZO_MIN}
                max={CANTIDAD_MAZO_MAX}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-buscar" className="flex flex-col gap-3">
        <h2 id="titulo-buscar" className="font-medium">
          Agregar cartas
        </h2>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Nombre de la carta
            <input name="texto" defaultValue={texto} maxLength={50} className={CAMPO} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Idioma
            <select name="idioma" defaultValue={idioma} className={CAMPO}>
              <option value="">Todos</option>
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
            Buscar
          </button>
        </form>

        {busqueda && !busqueda.ok && (
          <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-sm text-red-900">
            {busqueda.error}
          </p>
        )}
        {busqueda?.ok &&
          (busqueda.datos.filas.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">No hay cartas que coincidan con la búsqueda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {busqueda.datos.filas.map((carta) => (
                <li
                  key={carta.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div>
                    <p className="font-medium">{carta.nombre}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {carta.set_id} · {carta.number} · {carta.idioma}
                    </p>
                  </div>
                  <AgregarAlMazo mazoId={mazo.id} cartaId={carta.id} />
                </li>
              ))}
            </ul>
          ))}
      </section>

      <section aria-label="Eliminar mazo">
        <EliminarMazo mazoId={mazo.id} />
      </section>
    </main>
  );
}
