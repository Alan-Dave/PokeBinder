import Link from "next/link";
import { notFound } from "next/navigation";
import AgregarAlInventario from "@/components/AgregarAlInventario";
import ComparadorPrecios from "@/components/ComparadorPrecios";
import ReportarError from "@/components/ReportarError";
import VisorImagen from "@/components/VisorImagen";
import { listarCategorias } from "@/lib/categorias";
import { obtenerCarta, urlsImagenesOpcionales } from "@/lib/catalogo";
import { registrarPrecios } from "@/lib/historial-precios";
import { obtenerPreciosCartas } from "@/lib/precios-carta";
import { describirVariantes } from "@/lib/variantes";
import { idDesdeRuta } from "@/lib/validators/catalogo";
import { CANTIDAD_MAX, CANTIDAD_MIN } from "@/lib/validators/inventario";
import { DETALLE_MAX, DETALLE_MIN, ETIQUETAS_MOTIVO, MOTIVOS_REPORTE } from "@/lib/validators/reportes-catalogo";

// Las URLs firmadas de las imágenes caducan: nunca se sirve desde caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Carta · PokeBinder" };

const NOMBRES_IDIOMA: Record<string, string> = {
  en: "Inglés",
  es: "Español",
  fr: "Francés",
  pt: "Portugués",
  ja: "Japonés",
  zh: "Chino",
};

export default async function FichaCartaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cartaId = idDesdeRuta(id);
  if (cartaId === null) notFound();

  const resultado = await obtenerCarta(cartaId);

  if (!resultado.ok) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-8">
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          {resultado.error}
        </p>
        <Link href="/catalogo" className="text-sm underline">
          ← Volver al catálogo
        </Link>
      </main>
    );
  }
  if (resultado.datos === null) notFound();

  const carta = resultado.datos;
  const listaCategorias = await listarCategorias();
  const categorias = listaCategorias.ok ? listaCategorias.datos.map((c) => ({ id: c.id, nombre: c.nombre })) : [];
  const imagenes = await urlsImagenesOpcionales([carta.id]);
  const url = imagenes[carta.id];
  const precios =
    (await obtenerPreciosCartas([{ idApi: carta.id_api, idioma: carta.idioma }])).get(carta.id_api) ?? null;
  // Un precio por carta y día para el gráfico de evolución (PBI-30).
  if (precios) await registrarPrecios([{ cartaId: carta.id, acabados: precios.acabados }]);

  // Solo se listan los datos que la carta tiene: una fila vacía no informa nada.
  const datos: [string, string][] = [
    ["Set", carta.set_nombre ? `${carta.set_nombre} (${carta.set_id})` : carta.set_id],
    ["Número", carta.number],
    ["Idioma", NOMBRES_IDIOMA[carta.idioma] ?? carta.idioma],
    ...(carta.type ? [["Tipo", carta.type] as [string, string]] : []),
    ...(carta.stage ? [["Etapa", carta.stage] as [string, string]] : []),
    ...(carta.rarity ? [["Rareza", carta.rarity] as [string, string]] : []),
    ...(carta.subtipos.length > 0 ? [["Subtipos", carta.subtipos.join(", ")] as [string, string]] : []),
    ["Variantes", describirVariantes(carta.variantes_disponibles)],
  ];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <Link href="/catalogo" className="text-sm underline">
        ← Volver al catálogo
      </Link>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="flex aspect-[5/7] w-full max-w-md items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
          <VisorImagen url={url ?? null} urlHd={`/api/cartas/${carta.id}/imagen-hd`} alt={carta.nombre} />
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-semibold">{carta.nombre}</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{carta.id_api}</p>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {datos.map(([etiqueta, valor]) => (
              <div key={etiqueta} className="contents">
                <dt className="font-medium">{etiqueta}</dt>
                <dd className="text-zinc-700 dark:text-zinc-300">{valor}</dd>
              </div>
            ))}
          </dl>

          <section aria-labelledby="precio-titulo" className="flex flex-col gap-3">
            <h2 id="precio-titulo" className="text-2xl font-bold">
              Comparador de precios
            </h2>
            <ComparadorPrecios precios={precios} />
          </section>

          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">Agregar a mi colección</h2>
            <AgregarAlInventario
              cartaId={carta.id}
              variantes={carta.variantes_disponibles}
              min={CANTIDAD_MIN}
              max={CANTIDAD_MAX}
              categorias={categorias}
            />
          </div>

          <ReportarError
            cartaId={carta.id}
            motivos={MOTIVOS_REPORTE.map((valor) => ({ valor, etiqueta: ETIQUETAS_MOTIVO[valor] }))}
            detalleMin={DETALLE_MIN}
            detalleMax={DETALLE_MAX}
          />
        </div>
      </div>
    </main>
  );
}
