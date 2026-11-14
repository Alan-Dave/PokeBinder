import Link from "next/link";
import FilaColeccion from "@/components/FilaColeccion";
import PanelCategorias from "@/components/PanelCategorias";
import { categoriasDeCartas, listarCategorias } from "@/lib/categorias";
import { urlsImagenesOpcionales } from "@/lib/catalogo";
import { listarInventario, SIN_SESION, TAMANO_PAGINA } from "@/lib/inventario";
import { registrarPrecios } from "@/lib/historial-precios";
import { formatearUsd, precioDeVariante, valorDeColeccion } from "@/lib/precios";
import { obtenerPreciosCartas } from "@/lib/precios-carta";
import { NOMBRE_CATEGORIA_MAX } from "@/lib/validators/categorias";
import { CANTIDAD_MAX, CANTIDAD_MIN } from "@/lib/validators/inventario";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Mi colección · PokeBinder" };

export default async function ColeccionPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string | string[]; categoria?: string | string[] }>;
}) {
  const { pagina: paginaBruta, categoria: categoriaBruta } = await searchParams;
  const paginaTexto = Array.isArray(paginaBruta) ? paginaBruta[0] : paginaBruta;
  const pagina = paginaTexto === undefined ? 1 : Number(paginaTexto);
  const categoriaTexto = Array.isArray(categoriaBruta) ? categoriaBruta[0] : categoriaBruta;
  const categoriaId = categoriaTexto === undefined || categoriaTexto === "" ? undefined : Number(categoriaTexto);

  // La validación real la hace listarInventario; el resultado trae el mensaje.
  const resultado = await listarInventario({ pagina, categoriaId });

  if (!resultado.ok) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-8">
        <h1 className="text-2xl font-semibold">Mi colección</h1>
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          {resultado.error === SIN_SESION ? "Inicia sesión para ver tu colección." : resultado.error}
        </p>
        {resultado.error === SIN_SESION ? (
          <Link href="/login" className="text-sm underline">
            Ir a iniciar sesión
          </Link>
        ) : (
          <Link href="/coleccion" className="text-sm underline">
            Volver a la primera página
          </Link>
        )}
      </main>
    );
  }

  const { filas, total } = resultado.datos;
  // Las categorías son un extra: si fallan, la colección se ve igual sin ellas.
  const [listaCategorias, pertenencia] = await Promise.all([
    listarCategorias(),
    categoriasDeCartas(filas.map((f) => f.id)),
  ]);
  const categorias = listaCategorias.ok ? listaCategorias.datos : [];
  const categoriasPorFila = pertenencia.ok ? pertenencia.datos : new Map<number, number[]>();
  const enlacePagina = (n: number) =>
    categoriaId ? `/coleccion?categoria=${categoriaId}&pagina=${n}` : `/coleccion?pagina=${n}`;
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));

  // Precios solo de las cartas de esta página (una página tiene como mucho 30).
  const cartasDePagina = filas.flatMap((f) => (f.cartas ? [{ idApi: f.cartas.id_api, idioma: f.cartas.idioma }] : []));
  const precios = await obtenerPreciosCartas(cartasDePagina);
  // Un precio por carta y día para el gráfico de evolución (PBI-30).
  await registrarPrecios(
    filas.flatMap((f) => {
      const p = f.cartas ? precios.get(f.cartas.id_api) : null;
      return p ? [{ cartaId: f.carta_id, acabados: p.acabados.map((a) => ({ acabado: a.acabado, mercado: a.mercado })) }] : [];
    }),
  );
  // Miniaturas: bucket, luego TCGdex y, si ninguna carga, la ilustración de «Imagen no disponible».
  const imagenes = await urlsImagenesOpcionales(filas.map((f) => f.carta_id));
  const preciosDeFila = filas.map((f) => (f.cartas ? precioDeVariante(precios.get(f.cartas.id_api), f.variante) : null));
  const textosPrecio = preciosDeFila.map((p) => (p === null ? null : formatearUsd(p)));
  const valor = valorDeColeccion(filas.map((f, i) => ({ precio: preciosDeFila[i], cantidad: f.cantidad })));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Mi colección</h1>
        <p className="text-sm font-bold text-tinta/75">
          {total === 1 ? "1 registro" : `${total} registros`} en tu inventario
        </p>
        {valor.conPrecio > 0 && (
          <p className="text-sm">
            Valor estimado de esta página: <strong>{formatearUsd(valor.total)}</strong>
            {valor.sinPrecio > 0 && ` (sin contar ${valor.sinPrecio} sin precio)`}. Referencia de TCGplayer en
            dólares, no una oferta.{" "}
            <Link href="/coleccion/evolucion" className="font-bold text-azul underline">
              Ver evolución del valor
            </Link>
          </p>
        )}
        {total > 0 && (
          // Es una descarga, no una ruta de la aplicación: un <a> evita la precarga de next/link.
          <p className="flex flex-wrap gap-3 text-sm">
            <a href="/coleccion/exportar?formato=csv" download className="boton boton-neutro !rounded-xl !px-3 !py-1 text-sm">
              Descargar CSV
            </a>
            <a href="/coleccion/exportar?formato=xlsx" download className="boton boton-neutro !rounded-xl !px-3 !py-1 text-sm">
              Descargar Excel
            </a>
          </p>
        )}
      </header>

      {listaCategorias.ok && (
        <PanelCategorias categorias={categorias} activa={categoriaId ?? null} nombreMax={NOMBRE_CATEGORIA_MAX} />
      )}

      {filas.length === 0 ? (
        <p className="rounded-2xl border-[3px] border-dashed border-tinta bg-white p-6 text-tinta">
          {categoriaId
            ? "Esta categoría no tiene cartas todavía. Ábrelas desde «Todas» y márcalas en «Categorías»."
            : "Tu inventario está vacío. Podrás agregar cartas desde el catálogo cuando esté disponible."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {filas.map((fila, i) => (
            <FilaColeccion
              key={fila.id}
              fila={fila}
              min={CANTIDAD_MIN}
              max={CANTIDAD_MAX}
              precio={textosPrecio[i]}
              imagenUrl={imagenes[fila.carta_id] ?? null}
              categorias={categorias}
              categoriasDeLaFila={categoriasPorFila.get(fila.id) ?? []}
            />
          ))}
        </ul>
      )}

      {totalPaginas > 1 && (
        <nav aria-label="Paginación" className="flex items-center justify-between text-sm font-bold">
          {pagina > 1 ? (
            <Link href={enlacePagina(pagina - 1)} className="boton boton-neutro !rounded-xl !px-3 !py-1 text-sm">
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span>
            Página {pagina} de {totalPaginas}
          </span>
          {pagina < totalPaginas ? (
            <Link href={enlacePagina(pagina + 1)} className="boton boton-neutro !rounded-xl !px-3 !py-1 text-sm">
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
