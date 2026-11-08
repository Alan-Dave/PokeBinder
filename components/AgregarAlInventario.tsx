"use client";

import { useActionState } from "react";
import { agregarCartaAccion } from "@/app/catalogo/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import { etiquetaVariante, ordenarVariantes } from "@/lib/variantes";

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
    return <p className="text-sm font-bold">Sin variantes disponibles.</p>;
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
          className="rounded-xl border-[3px] border-tinta bg-white px-2 py-1.5 text-sm font-bold"
        >
          {ordenarVariantes(variantes).map((variante) => (
            <option key={variante} value={variante}>
              {etiquetaVariante(variante)}
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
          className="w-20 rounded-xl border-[3px] border-tinta bg-white px-2 py-1.5 text-sm font-bold"
        />
        <button
          type="submit"
          disabled={agregando}
          className="boton boton-azul !rounded-xl !px-4 !py-1.5 text-sm disabled:opacity-50"
        >
          {agregando ? "Agregando…" : "Agregar"}
        </button>
      </div>
      {estado.error && (
        <p role="alert" className="text-sm font-bold text-[#b42318]">
          {estado.error}
        </p>
      )}
      {estado.exito && !estado.error && (
        <p role="status" className="text-sm font-bold text-precio">
          Agregada a tu colección.
        </p>
      )}
    </form>
  );
}
