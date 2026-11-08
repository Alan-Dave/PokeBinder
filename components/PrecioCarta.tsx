import { formatearUsd, precioDeCatalogo, type PreciosCarta } from "@/lib/precios";

type Props = {
  /** Consulta compartida de toda la página; se espera dentro de un <Suspense>. */
  precios: Promise<Map<string, PreciosCarta | null>>;
  idApi: string;
  variantes: readonly string[];
};

/** Marcador mientras llega el precio: la página no espera a TCGdex para dibujarse. */
export function PrecioCartaCargando() {
  return (
    <span role="status" className="text-base font-bold">
      <span aria-hidden="true" className="inline-block h-6 w-24 animate-pulse rounded-lg bg-[#e9e9ee] align-middle" />
      <span className="sr-only">Cargando precio</span>
    </span>
  );
}

/**
 * Precio de mercado de una carta del catálogo (TCGplayer, en dólares).
 * Una carta sin precio dice «Sin precio»: nunca se muestra 0 ni se estima.
 */
export default async function PrecioCarta({ precios, idApi, variantes }: Props) {
  const resumen = precioDeCatalogo((await precios).get(idApi), variantes);

  if (!resumen) return <span className="text-base font-bold">Sin precio</span>;
  return (
    <span className="font-titulo text-2xl font-extrabold text-precio">
      {resumen.desde && <span className="mr-1 font-sans text-sm font-bold">desde</span>}
      {formatearUsd(resumen.monto)}
    </span>
  );
}
