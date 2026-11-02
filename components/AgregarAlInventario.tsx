"use client";

import { useActionState } from "react";
import { agregarCartaAccion } from "@/app/catalogo/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";

const INICIAL: EstadoAccion = { error: null, exito: false };

type Props = {
  cartaId: number;
  variantes: string[];
  // Los límites vienen de la página (servidor) para no cargar zod en el navegador.
  min: number;
  max: number;
};

export default function AgregarAlInventario({ cartaId, variantes, min, max }: Props) {
  const [estado, agregar, agregando] = useActionState(agregarCartaAccion, INICIAL);
  const idVariante = `variante-${cartaId}`;
  const idCantidad = `cantidad-${cartaId}`;

  if (variantes.length === 0) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Sin variantes disponibles.</p>;
  }

  return (
    <form action={agregar} className="flex flex-col gap-2">
      <input type="hidden" name="cartaId" value={cartaId} />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={idVariante} className="sr-only">
          Variante
        </label>
        <select
          id={idVariante}
          name="variante"
          className="rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
        >
          {variantes.map((variante) => (
            <option key={variante} value={variante}>
              {variante}
            </option>
          ))}
        </select>
        <label htmlFor={idCantidad} className="sr-only">
          Cantidad
        </label>
        <input
          id={idCantidad}
          name="cantidad"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          defaultValue={1}
          required
          className="w-20 rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={agregando}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {agregando ? "Agregando…" : "Agregar"}
        </button>
      </div>
      {estado.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {estado.error}
        </p>
      )}
      {estado.exito && !estado.error && (
        <p role="status" className="text-sm text-green-800 dark:text-green-400">
          Agregada a tu colección.
        </p>
      )}
    </form>
  );
}
