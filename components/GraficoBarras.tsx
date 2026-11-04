"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type DatoBarra = { etiqueta: string; valor: number };

type Props = { titulo: string; datos: DatoBarra[]; unidad: string };

/**
 * Gráfico de barras horizontales. Es solo presentación: recibe datos ya
 * calculados en el servidor. La tabla equivalente de la página es la versión
 * accesible del mismo contenido, por eso el gráfico se oculta a los lectores
 * de pantalla.
 */
export default function GraficoBarras({ titulo, datos, unidad }: Props) {
  return (
    <figure className="flex flex-col gap-2" aria-hidden="true">
      <figcaption className="text-sm font-medium">{titulo}</figcaption>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} layout="vertical" margin={{ left: 16, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="etiqueta" width={90} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(valor) => [`${valor} ${unidad}`, ""]} />
            <Bar dataKey="valor" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
