import {
  formatearEur,
  formatearUsd,
  precioCardmarketCatalogo,
  precioDeCatalogo,
  type PreciosCarta,
} from "@/lib/precios";

type Props = {
  /** Consulta compartida de toda la página; se espera dentro de un <Suspense>. */
  precios: Promise<Map<string, PreciosCarta | null>>;
  idApi: string;
  variantes: readonly string[];
};

/** Marcador mientras llegan los precios: la página no espera a TCGdex para dibujarse. */
export function PrecioCartaCargando() {
  return (
    <span role="status" className="flex flex-col gap-1.5">
      <span aria-hidden="true" className="h-6 w-28 animate-pulse rounded-lg bg-[#e9e9ee]" />
      <span aria-hidden="true" className="h-6 w-24 animate-pulse rounded-lg bg-[#e9e9ee]" />
      <span className="sr-only">Cargando precios</span>
    </span>
  );
}

function Fila({ tienda, texto, desde }: { tienda: string; texto: string | null; desde: boolean }) {
  return (
    <span className="flex items-baseline justify-between gap-3">
      <span className="text-sm font-bold">{tienda}</span>
      {texto === null ? (
        <span className="text-sm font-bold">Sin precio</span>
      ) : (
        <span className="font-titulo text-xl font-extrabold text-precio">
          {desde && <span className="mr-1 font-sans text-xs font-bold">desde</span>}
          {texto}
        </span>
      )}
    </span>
  );
}

/**
 * Precio de una carta del catálogo en cada tienda: TCGplayer (dólares) y
 * Cardmarket (euros). No se convierten monedas ni se declara cuál es «más
 * barata»: eso exigiría un tipo de cambio. Una tienda sin precio dice
 * «Sin precio»; nunca se muestra 0 ni se estima.
 */
export default async function PrecioCarta({ precios, idApi, variantes }: Props) {
  const de = (await precios).get(idApi);
  const tcgplayer = precioDeCatalogo(de, variantes);
  const cardmarket = precioCardmarketCatalogo(de?.cardmarket);

  return (
    <span className="flex w-full flex-col gap-1">
      <Fila
        tienda="TCGplayer"
        texto={tcgplayer ? formatearUsd(tcgplayer.monto) : null}
        desde={tcgplayer?.desde ?? false}
      />
      <Fila
        tienda="Cardmarket"
        texto={cardmarket ? formatearEur(cardmarket.monto) : null}
        desde={cardmarket?.desde ?? false}
      />
    </span>
  );
}
