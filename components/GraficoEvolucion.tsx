import { formatearUsd } from "@/lib/precios";
import type { PuntoEvolucion } from "@/lib/evolucion";

/**
 * Línea de evolución del valor, dibujada con SVG: sin dependencias nuevas.
 * El dibujo es decorativo (aria-hidden); la tabla de debajo es la versión
 * accesible con los mismos datos.
 */

const ANCHO = 600;
const ALTO = 220;
const MARGEN = { arriba: 16, derecha: 16, abajo: 24, izquierda: 64 };

export default function GraficoEvolucion({ puntos }: { puntos: PuntoEvolucion[] }) {
  const valores = puntos.map((p) => p.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  // Con un valor constante el rango sería 0: se evita dividir por cero.
  const rango = max - min || 1;
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const altoUtil = ALTO - MARGEN.arriba - MARGEN.abajo;

  const x = (i: number) =>
    MARGEN.izquierda + (puntos.length === 1 ? anchoUtil / 2 : (i / (puntos.length - 1)) * anchoUtil);
  const y = (v: number) => MARGEN.arriba + altoUtil - ((v - min) / rango) * altoUtil;
  const linea = puntos.map((p, i) => `${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ");

  return (
    <div className="flex flex-col gap-4">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full" aria-hidden="true">
        <text
          x={MARGEN.izquierda - 8}
          y={y(max) + 4}
          textAnchor="end"
          className="fill-tinta/75 text-[11px]"
        >
          {formatearUsd(max)}
        </text>
        <text
          x={MARGEN.izquierda - 8}
          y={y(min) + 4}
          textAnchor="end"
          className="fill-tinta/75 text-[11px]"
        >
          {formatearUsd(min)}
        </text>
        <text x={MARGEN.izquierda} y={ALTO - 6} className="fill-tinta/75 text-[11px]">
          {puntos[0].fecha}
        </text>
        <text
          x={ANCHO - MARGEN.derecha}
          y={ALTO - 6}
          textAnchor="end"
          className="fill-tinta/75 text-[11px]"
        >
          {puntos[puntos.length - 1].fecha}
        </text>
        {puntos.length > 1 && <polyline points={linea} fill="none" strokeWidth={2} className="stroke-emerald-600" />}
        {puntos.map((p, i) => (
          <circle key={p.fecha} cx={x(i)} cy={y(p.valor)} r={3} className="fill-emerald-600" />
        ))}
      </svg>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Ver los datos en una tabla</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr>
              <th className="py-1 pr-4 font-medium">Fecha</th>
              <th className="py-1 font-medium">Valor estimado</th>
            </tr>
          </thead>
          <tbody>
            {puntos.map((p) => (
              <tr key={p.fecha}>
                <td className="py-0.5 pr-4">{p.fecha}</td>
                <td className="py-0.5">{formatearUsd(p.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
