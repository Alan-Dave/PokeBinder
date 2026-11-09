import Link from "next/link";
import AgregarAlMazo from "@/components/AgregarAlMazo";
import AgregarCartasAlMazo from "@/components/AgregarCartasAlMazo";
import EliminarMazo from "@/components/EliminarMazo";
import FilaMazo from "@/components/FilaMazo";
import ImagenCarta from "@/components/ImagenCarta";
import { buscarCartas, urlsImagenesOpcionales } from "@/lib/catalogo";
import { listarCategorias } from "@/lib/categorias";
import { obtenerLegalidadMazo } from "@/lib/legalidad-mazo";
import { obtenerMazo, SIN_SESION } from "@/lib/mazos";
import { COPIAS_MAX, TAMANO_MAZO } from "@/lib/reglas-mazo";
import { CANTIDAD_MAZO_MAX, CANTIDAD_MAZO_MIN } from "@/lib/validators/mazos";
import { IDIOMAS } from "@/lib/validators/catalogo";
import { FORMATOS_LEGALIDAD, NOMBRES_FORMATO } from "@/lib/validators/legalidad";

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

const CAMPO = "rounded-xl border-[3px] border-tinta bg-white px-2 py-1.5 text-sm text-tinta";

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
  const formato = primero(parametros.formato);

  // La validación real la hace obtenerMazo; el resultado trae el mensaje.
  const resultado = await obtenerMazo({ mazoId: entero(id) });

  if (!resultado.ok) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-8">
        <h1 className="text-2xl font-semibold">Mazo</h1>
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          {resultado.error === SIN_SESION ? "Inicia sesión para ver tu mazo." : resultado.error}
        </p>
        <Link href={resultado.error === SIN_SESION ? "/login" : "/mazos"} className="text-sm font-bold text-azul underline">
          {resultado.error === SIN_SESION ? "Ir a iniciar sesión" : "Volver a mis mazos"}
        </Link>
      </main>
    );
  }

  const { mazo, lineas, reglas } = resultado.datos;

  // Solo se consulta a TCGdex cuando el usuario elige un formato.
  const legalidad = formato === "" ? null : await obtenerLegalidadMazo({ mazoId: mazo.id, formato });

  // Sin texto no se consulta el catálogo: son 95.000 cartas.
  const busqueda = texto === "" ? null : await buscarCartas({ texto, idioma, pagina: 1 });
  // Miniaturas del catálogo: son un extra, sin ellas la lista se ve igual con un marcador.
  const imagenes = busqueda?.ok ? await urlsImagenesOpcionales(busqueda.datos.filas.map((f) => f.id)) : {};

  // Para el panel de «Mi colección»: cuántas copias hay ya en el mazo y qué categorías hay.
  const enMazo = Object.fromEntries(lineas.map((l) => [l.cartaId, l.cantidad]));
  const listaCategorias = await listarCategorias();
  const categorias = listaCategorias.ok ? listaCategorias.datos.map((c) => ({ id: c.id, nombre: c.nombre })) : [];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <Link href="/mazos" className="text-sm font-bold text-azul underline">
          ← Mis mazos
        </Link>
        <h1 className="text-2xl font-semibold">{mazo.nombre}</h1>
        <p className="text-sm text-tinta/75">
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

      <section aria-labelledby="titulo-legalidad" className="flex flex-col gap-2">
        <h2 id="titulo-legalidad" className="font-medium">
          Legalidad por formato
        </h2>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Formato
            <select name="formato" defaultValue={formato} className={CAMPO}>
              <option value="" disabled>
                Elige un formato
              </option>
              {FORMATOS_LEGALIDAD.map((f) => (
                <option key={f} value={f}>
                  {NOMBRES_FORMATO[f]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="boton boton-neutro !rounded-xl !px-3 !py-1 text-sm"
          >
            Comprobar
          </button>
        </form>
        {legalidad && !legalidad.ok && (
          <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-sm text-red-900">
            {legalidad.error}
          </p>
        )}
        {legalidad?.ok && (
          <>
            {legalidad.datos.veredicto === "legal" && (
              <p role="status" className="rounded-md bg-green-100 px-4 py-2 text-sm text-green-900">
                Legal en {NOMBRES_FORMATO[legalidad.datos.formato]}: todas las cartas están permitidas.
              </p>
            )}
            {legalidad.datos.veredicto === "no-legal" && (
              <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-sm text-red-900">
                No es legal en {NOMBRES_FORMATO[legalidad.datos.formato]}: {legalidad.datos.noLegales}{" "}
                {legalidad.datos.noLegales === 1 ? "carta no está permitida" : "cartas no están permitidas"}.
              </p>
            )}
            {legalidad.datos.veredicto === "no-verificable" && (
              <p role="status" className="rounded-md bg-amber-100 px-4 py-2 text-sm text-amber-900">
                No se pudo verificar en {NOMBRES_FORMATO[legalidad.datos.formato]}: {legalidad.datos.noVerificables}{" "}
                {legalidad.datos.noVerificables === 1 ? "carta" : "cartas"} sin información de legalidad. No lo
                tomes como legal.
              </p>
            )}
            {legalidad.datos.veredicto !== "legal" && (
              <ul className="flex list-disc flex-col gap-1 pl-8 text-sm">
                {legalidad.datos.cartas
                  .filter((c) => c.estado !== "legal")
                  .map((c) => (
                    <li key={c.cartaId}>
                      {c.nombre} — {c.estado === "no-legal" ? "no permitida" : "sin información"}
                    </li>
                  ))}
              </ul>
            )}
            <p className="text-xs text-tinta/75">
              Datos de TCGdex. Los formatos rotan: la comprobación se actualiza cada 24 horas.
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="titulo-cartas" className="flex flex-col gap-3">
        <h2 id="titulo-cartas" className="font-medium">
          Cartas del mazo
        </h2>
        {lineas.length === 0 ? (
          <p className="rounded-2xl border-[3px] border-dashed border-tinta bg-white p-6 text-tinta">
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

      {lineas.length > 0 && (
        <p className="text-sm">
          {/* Es una descarga, no una ruta de la aplicación: un <a> evita la precarga de next/link. */}
          <a href={`/mazos/${mazo.id}/proxies`} download className="font-bold text-azul underline">
            Descargar proxies (PDF, 63 × 88 mm)
          </a>
        </p>
      )}

      <section aria-labelledby="titulo-buscar" className="flex flex-col gap-3">
        <h2 id="titulo-buscar" className="font-medium">
          Agregar cartas
        </h2>
        <AgregarCartasAlMazo
          mazoId={mazo.id}
          enMazo={enMazo}
          categorias={categorias}
          // Si se acaba de buscar en el catálogo, se vuelve a esa pestaña.
          pestanaInicial={texto === "" ? "coleccion" : "catalogo"}
          catalogo={
            <div className="flex flex-col gap-3">
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
                  className="boton boton-neutro !rounded-xl !px-3 !py-1 text-sm"
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
                  <p className="text-sm text-tinta/75">No hay cartas que coincidan con la búsqueda.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {busqueda.datos.filas.map((carta) => (
                      <li
                        key={carta.id}
                        className="flex items-center justify-between gap-3 tarjeta p-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex aspect-[5/7] w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#e9e9ee]">
                            <ImagenCarta
                              url={imagenes[carta.id] ?? null}
                              urlRespaldo={`/api/cartas/${carta.id}/imagen-hd?tam=min`}
                              alt={carta.nombre}
                            />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{carta.nombre}</p>
                            <p className="text-sm text-tinta/75">
                              {carta.set_id} · {carta.number} · {carta.idioma}
                            </p>
                          </div>
                        </div>
                        <AgregarAlMazo mazoId={mazo.id} cartaId={carta.id} />
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          }
        />
      </section>

      <section aria-label="Eliminar mazo">
        <EliminarMazo mazoId={mazo.id} />
      </section>
    </main>
  );
}
