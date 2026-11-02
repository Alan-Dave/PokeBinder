import Link from "next/link";
import AgregarAlInventario from "@/components/AgregarAlInventario";
import {
  buscarCartas,
  obtenerFiltros,
  TAMANO_PAGINA_CATALOGO,
  urlsImagenesOpcionales,
} from "@/lib/catalogo";
import { IDIOMAS } from "@/lib/validators/catalogo";
import { CANTIDAD_MAX, CANTIDAD_MIN } from "@/lib/validators/inventario";

// Las URLs firmadas de las imágenes caducan: nunca se sirve desde caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Catálogo · PokeBinder" };

const NOMBRES_IDIOMA: Record<(typeof IDIOMAS)[number], string> = {
  en: "Inglés",
  es: "Español",
  fr: "Francés",
  pt: "Portugués",
  ja: "Japonés",
  zh: "Chino",
};

type Parametros = Promise<Record<string, string | string[] | undefined>>;

function primero(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? "";
}

const CAMPO =
  "rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700";

export default async function CatalogoPage({ searchParams }: { searchParams: Parametros }) {
  const parametros = await searchParams;
  const texto = primero(parametros.texto);
  const idioma = primero(parametros.idioma);
  const tipo = primero(parametros.tipo);
  const rareza = primero(parametros.rareza);
  const paginaTexto = primero(parametros.pagina);
  const pagina = paginaTexto === "" ? 1 : Number(paginaTexto);

  // La validación real la hace buscarCartas; el resultado trae el mensaje.
  const [resultado, filtros] = await Promise.all([
    buscarCartas({ texto, idioma, tipo, rareza, pagina }),
    obtenerFiltros(),
  ]);
  const tipos = filtros.ok ? filtros.datos.tipos : [];
  const rarezas = filtros.ok ? filtros.datos.rarezas : [];

  // Los filtros activos se conservan al cambiar de página.
  const consulta = new URLSearchParams();
  for (const [clave, valor] of Object.entries({ texto, idioma, tipo, rareza })) {
    if (valor) consulta.set(clave, valor);
  }
  const enlacePagina = (n: number) => `/catalogo?${new URLSearchParams([...consulta, ["pagina", String(n)]])}`;

  let contenido: React.ReactNode;
  if (!resultado.ok) {
    contenido = (
      <div className="flex flex-col gap-2">
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          {resultado.error}
        </p>
        <Link href="/catalogo" className="text-sm underline">
          Quitar filtros y volver a la primera página
        </Link>
      </div>
    );
  } else {
    const { filas, total } = resultado.datos;
    const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_CATALOGO));

    // Las imágenes son un extra: sin ellas la página se muestra con un marcador.
    const imagenes = await urlsImagenesOpcionales(filas.map((f) => f.id));

    contenido =
      filas.length === 0 ? (
        <p className="rounded-md border border-dashed border-zinc-300 p-6 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          No hay cartas que coincidan con la búsqueda.
        </p>
      ) : (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {total === 1 ? "1 carta" : `${total.toLocaleString("es-CL")} cartas`}
          </p>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filas.map((carta) => {
              const url = imagenes[carta.id];
              return (
                <li
                  key={carta.id}
                  className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex aspect-[5/7] items-center justify-center overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
                    {url ? (
                      // La URL está firmada y caduca: el optimizador de next/image
                      // no aporta nada y cachearía una URL vencida.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={carta.nombre}
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <span className="text-sm text-zinc-500">Sin imagen</span>
                    )}
                  </div>
                  <div>
                    <Link href={`/catalogo/${carta.id}`} className="font-medium underline-offset-2 hover:underline">
                      {carta.nombre}
                    </Link>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {carta.set_id} · {carta.number} · {carta.idioma}
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {[carta.type, carta.rarity].filter(Boolean).join(" · ") || "Sin clasificar"}
                    </p>
                  </div>
                  <AgregarAlInventario
                    cartaId={carta.id}
                    variantes={carta.variantes_disponibles}
                    min={CANTIDAD_MIN}
                    max={CANTIDAD_MAX}
                  />
                </li>
              );
            })}
          </ul>

          {totalPaginas > 1 && (
            <nav aria-label="Paginación" className="flex items-center justify-between text-sm">
              {pagina > 1 ? (
                <Link href={enlacePagina(pagina - 1)} className="underline">
                  ← Anterior
                </Link>
              ) : (
                <span />
              )}
              <span>
                Página {pagina} de {totalPaginas}
              </span>
              {pagina < totalPaginas ? (
                <Link href={enlacePagina(pagina + 1)} className="underline">
                  Siguiente →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Catálogo</h1>

      {/* Formulario GET: funciona sin JavaScript y deja la búsqueda en la URL. */}
      <form method="get" action="/catalogo" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="texto" className="text-sm">
            Nombre
          </label>
          <input
            id="texto"
            name="texto"
            type="search"
            maxLength={50}
            defaultValue={texto}
            placeholder="Empieza por…"
            className={CAMPO}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="idioma" className="text-sm">
            Idioma
          </label>
          <select id="idioma" name="idioma" defaultValue={idioma} className={CAMPO}>
            <option value="">Todos</option>
            {IDIOMAS.map((codigo) => (
              <option key={codigo} value={codigo}>
                {NOMBRES_IDIOMA[codigo]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="tipo" className="text-sm">
            Tipo
          </label>
          <select id="tipo" name="tipo" defaultValue={tipo} className={CAMPO}>
            <option value="">Todos</option>
            {tipos.map((valor) => (
              <option key={valor} value={valor}>
                {valor}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="rareza" className="text-sm">
            Rareza
          </label>
          <select id="rareza" name="rareza" defaultValue={rareza} className={CAMPO}>
            <option value="">Todas</option>
            {rarezas.map((valor) => (
              <option key={valor} value={valor}>
                {valor}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Buscar
        </button>
      </form>

      {contenido}
    </main>
  );
}
