import Link from "next/link";
import { notFound } from "next/navigation";
import AgregarAlInventario from "@/components/AgregarAlInventario";
import VisorImagen from "@/components/VisorImagen";
import { obtenerCarta, urlsImagenesOpcionales } from "@/lib/catalogo";
import { idDesdeRuta } from "@/lib/validators/catalogo";
import { CANTIDAD_MAX, CANTIDAD_MIN } from "@/lib/validators/inventario";

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
  const imagenes = await urlsImagenesOpcionales([carta.id]);
  const url = imagenes[carta.id];

  // Solo se listan los datos que la carta tiene: una fila vacía no informa nada.
  const datos: [string, string][] = [
    ["Set", carta.set_nombre ? `${carta.set_nombre} (${carta.set_id})` : carta.set_id],
    ["Número", carta.number],
    ["Idioma", NOMBRES_IDIOMA[carta.idioma] ?? carta.idioma],
    ...(carta.type ? [["Tipo", carta.type] as [string, string]] : []),
    ...(carta.stage ? [["Etapa", carta.stage] as [string, string]] : []),
    ...(carta.rarity ? [["Rareza", carta.rarity] as [string, string]] : []),
    ...(carta.subtipos.length > 0 ? [["Subtipos", carta.subtipos.join(", ")] as [string, string]] : []),
    ["Variantes", carta.variantes_disponibles.length > 0 ? carta.variantes_disponibles.join(", ") : "Ninguna"],
  ];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-8">
      <Link href="/catalogo" className="text-sm underline">
        ← Volver al catálogo
      </Link>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="flex aspect-[5/7] w-full max-w-md items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
          {url ? (
            <VisorImagen url={url} alt={carta.nombre} />
          ) : (
            <span className="text-sm text-zinc-500">Sin imagen</span>
          )}
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

          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">Agregar a mi colección</h2>
            <AgregarAlInventario
              cartaId={carta.id}
              variantes={carta.variantes_disponibles}
              min={CANTIDAD_MIN}
              max={CANTIDAD_MAX}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
