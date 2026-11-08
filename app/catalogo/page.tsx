import Link from "next/link";
import { Suspense } from "react";
import AgregarAlInventario from "@/components/AgregarAlInventario";
import ImagenCarta from "@/components/ImagenCarta";
import PrecioCarta, { PrecioCartaCargando } from "@/components/PrecioCarta";
import { estiloDeTipo } from "@/lib/estilo-carta";
import { buscarCartas, obtenerFiltros, TAMANO_PAGINA_CATALOGO, urlsImagenesOpcionales } from "@/lib/catalogo";
import { obtenerPreciosCartas } from "@/lib/precios-carta";
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

const CAMPO = "rounded-xl border-[3px] border-tinta bg-white px-3 py-2 text-base text-tinta";
const ETIQUETA = "rounded-full border-2 border-tinta px-3 py-0.5 text-sm font-extrabold";

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
  for (const [clave, valor] of Object.entries({
    texto,
    idioma,
    tipo,
    rareza,
  })) {
    if (valor) consulta.set(clave, valor);
  }
  const enlacePagina = (n: number) => `/catalogo?${new URLSearchParams([...consulta, ["pagina", String(n)]])}`;

  let contenido: React.ReactNode;
  if (!resultado.ok) {
    contenido = (
      <div className="flex flex-col gap-2">
        <p role="alert" className="tarjeta bg-[#ffd9d4] px-4 py-3 font-bold">
          {resultado.error}
        </p>
        <Link href="/catalogo" className="font-bold underline">
          Quitar filtros y volver a la primera página
        </Link>
      </div>
    );
  } else {
    const { filas, total } = resultado.datos;
    const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA_CATALOGO));

    // Las imágenes son un extra: sin ellas la página se muestra con un marcador.
    const imagenes = await urlsImagenesOpcionales(filas.map((f) => f.id));
    // Los precios vienen de TCGdex y pueden tardar: la consulta arranca ya, pero
    // la página no la espera. Cada tarjeta muestra su precio cuando llega.
    const precios = obtenerPreciosCartas(filas.map((f) => ({ idApi: f.id_api, idioma: f.idioma })));

    contenido =
      filas.length === 0 ? (
        <p className="rounded-[1.25rem] border-[3px] border-dashed border-tinta bg-white p-6 font-bold">
          No hay cartas que coincidan con la búsqueda.
        </p>
      ) : (
        <>
          <p className="font-bold">{total === 1 ? "1 carta" : `${total.toLocaleString("es-CL")} cartas`}</p>
          <ul className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {filas.map((carta) => {
              const url = imagenes[carta.id];
              const estilo = estiloDeTipo(carta.type);
              return (
                <li key={carta.id} className="tarjeta flex flex-col gap-3 p-4">
                  <div
                    className={`flex aspect-[5/7] items-center justify-center overflow-hidden rounded-2xl border-[3px] border-tinta ${estilo.panel}`}
                  >
                    <ImagenCarta
                      url={url}
                      urlRespaldo={`/api/cartas/${carta.id}/imagen-hd?tam=min`}
                      alt={carta.nombre}
                    />
                  </div>
                  <div>
                    <h2 className="text-2xl leading-tight font-bold">
                      <Link href={`/catalogo/${carta.id}`} className="hover:underline">
                        {carta.nombre}
                      </Link>
                    </h2>
                    <p className="text-sm">
                      {carta.set_id} · {carta.number} · {carta.idioma}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {carta.type || carta.rarity ? (
                      <>
                        {carta.type && <span className={`${ETIQUETA} ${estilo.chip}`}>{carta.type}</span>}
                        {carta.rarity && <span className={`${ETIQUETA} bg-white`}>{carta.rarity}</span>}
                      </>
                    ) : (
                      <span className={`${ETIQUETA} bg-[#e9e9ee]`}>Sin clasificar</span>
                    )}
                  </div>
                  <p className="flex min-h-8 items-center">
                    <Suspense fallback={<PrecioCartaCargando />}>
                      <PrecioCarta precios={precios} idApi={carta.id_api} variantes={carta.variantes_disponibles} />
                    </Suspense>
                  </p>
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
            <nav aria-label="Paginación" className="flex flex-wrap items-center justify-center gap-4 font-extrabold">
              {pagina > 1 ? (
                <Link href={enlacePagina(pagina - 1)} className="boton boton-neutro">
                  ← Anterior
                </Link>
              ) : null}
              <span>
                Página {pagina} de {totalPaginas}
              </span>
              {pagina < totalPaginas ? (
                <Link href={enlacePagina(pagina + 1)} className="boton boton-rojo">
                  Siguiente →
                </Link>
              ) : null}
            </nav>
          )}
        </>
      );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10 sm:px-8">
      <div>
        <h1 className="text-5xl leading-tight font-extrabold">Catálogo</h1>
        <p className="text-lg">Explora cartas en seis idiomas y agrégalas a tu colección.</p>
      </div>

      {/* Formulario GET: funciona sin JavaScript y deja la búsqueda en la URL. */}
      <form method="get" action="/catalogo" className="tarjeta flex flex-wrap items-end gap-4 p-6">
        <div className="flex min-w-60 flex-[2] flex-col gap-1.5">
          <label htmlFor="texto" className="text-[15px] font-extrabold">
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
          <label htmlFor="idioma" className="text-[15px] font-extrabold">
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
          <label htmlFor="tipo" className="text-[15px] font-extrabold">
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
          <label htmlFor="rareza" className="text-[15px] font-extrabold">
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
        <button type="submit" className="boton boton-rojo text-lg">
          Buscar
        </button>
      </form>

      {contenido}
    </main>
  );
}
