import {
  etiquetaAcabado,
  formatearEur,
  formatearUsd,
  urlCardmarket,
  urlTcgplayer,
  type LineaCardmarket,
  type PreciosCarta,
} from "@/lib/precios";

const CELDA = "px-3 py-2 text-right";
const ENCABEZADO = "px-3 py-2 text-right font-bold";

const opcional = (monto: number | null | undefined, formato: (m: number) => string) =>
  monto === null || monto === undefined ? "—" : formato(monto);

function fecha(texto: string | null | undefined): string {
  return texto ? ` Actualizado el ${texto.slice(0, 10)}.` : "";
}

function EnlaceTienda({ href, tienda }: { href: string | null; tienda: string }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm font-bold underline">
      Ver en {tienda}
      <span className="sr-only"> (abre en una pestaña nueva)</span>
    </a>
  );
}

const VERSIONES_CARDMARKET: { clave: "normal" | "holo"; etiqueta: string }[] = [
  { clave: "normal", etiqueta: "Normal" },
  { clave: "holo", etiqueta: "Holo" },
];

const tieneDatos = (l: LineaCardmarket) => Object.values(l).some((v) => v !== null);

/**
 * Compara el precio de una carta en cada tienda. Cada una informa en su moneda
 * (TCGplayer en dólares, Cardmarket en euros) y no se convierten: mezclar
 * monedas con un tipo de cambio inventado daría una comparación falsa.
 * Una tienda sin datos lo dice; nunca se muestra 0.
 */
export default function ComparadorPrecios({ precios }: { precios: PreciosCarta | null }) {
  const cardmarket = precios?.cardmarket ?? null;
  const hayTcgplayer = (precios?.acabados.length ?? 0) > 0;

  if (!precios || (!hayTcgplayer && !cardmarket)) {
    return <p className="text-sm font-bold">Sin precio disponible para esta carta.</p>;
  }

  const idTcgplayer = precios.acabados.find((a) => a.productoId)?.productoId ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-bold">TCGplayer · dólares</h3>
        {hayTcgplayer ? (
          <>
            <div className="tarjeta overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-[3px] border-tinta">
                    <th scope="col" className="px-3 py-2 text-left font-bold">
                      Acabado
                    </th>
                    <th scope="col" className={ENCABEZADO}>
                      Mercado
                    </th>
                    <th scope="col" className={ENCABEZADO}>
                      Más bajo
                    </th>
                    <th scope="col" className={ENCABEZADO}>
                      Medio
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {precios.acabados.map((a) => (
                    <tr key={a.acabado} className="border-b border-tinta/20 last:border-0">
                      <th scope="row" className="px-3 py-2 text-left font-bold">
                        {etiquetaAcabado(a.acabado)}
                      </th>
                      <td className={`${CELDA} font-bold text-precio`}>{formatearUsd(a.mercado)}</td>
                      <td className={CELDA}>{opcional(a.bajo, formatearUsd)}</td>
                      <td className={CELDA}>{opcional(a.medio, formatearUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <EnlaceTienda href={urlTcgplayer(idTcgplayer)} tienda="TCGplayer" />
            <p className="text-xs">Referencia de mercado en dólares.{fecha(precios.actualizado)}</p>
          </>
        ) : (
          <p className="text-sm font-bold">Sin precio en TCGplayer.</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xl font-bold">Cardmarket · euros</h3>
        {cardmarket ? (
          <>
            <div className="tarjeta overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-[3px] border-tinta">
                    <th scope="col" className="px-3 py-2 text-left font-bold">
                      Versión
                    </th>
                    <th scope="col" className={ENCABEZADO}>
                      Tendencia
                    </th>
                    <th scope="col" className={ENCABEZADO}>
                      Más bajo
                    </th>
                    <th scope="col" className={ENCABEZADO}>
                      Prom. 7 días
                    </th>
                    <th scope="col" className={ENCABEZADO}>
                      Prom. 30 días
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {VERSIONES_CARDMARKET.filter((v) => tieneDatos(cardmarket[v.clave])).map((v) => {
                    const l = cardmarket[v.clave];
                    return (
                      <tr key={v.clave} className="border-b border-tinta/20 last:border-0">
                        <th scope="row" className="px-3 py-2 text-left font-bold">
                          {v.etiqueta}
                        </th>
                        <td className={`${CELDA} font-bold text-precio`}>{opcional(l.tendencia, formatearEur)}</td>
                        <td className={CELDA}>{opcional(l.minimo, formatearEur)}</td>
                        <td className={CELDA}>{opcional(l.promedio7, formatearEur)}</td>
                        <td className={CELDA}>{opcional(l.promedio30, formatearEur)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <EnlaceTienda href={urlCardmarket(cardmarket.productoId)} tienda="Cardmarket" />
            <p className="text-xs">Precios en euros.{fecha(cardmarket.actualizado)}</p>
          </>
        ) : (
          <p className="text-sm font-bold">Sin precio en Cardmarket.</p>
        )}
      </div>

      <p className="text-xs">
        Cada tienda informa en su moneda y no se convierten, así que no se declara cuál es más barata. Son valores
        orientativos, no ofertas.
      </p>
    </div>
  );
}
