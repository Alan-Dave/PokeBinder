"use client";

import { useActionState } from "react";
import { fijarCantidadEnMazoAccion, quitarDelMazoAccion } from "@/app/mazos/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import type { LineaMazo } from "@/lib/mazos";

const INICIAL: EstadoAccion = { error: null, exito: false };

const BOTON =
  "boton boton-neutro !rounded-xl !px-3 !py-1 text-sm disabled:opacity-50";

type Props = {
  mazoId: number;
  linea: LineaMazo;
  // Los límites vienen de la página (servidor) para no cargar zod en el navegador.
  min: number;
  max: number;
};

export default function FilaMazo({ mazoId, linea, min, max }: Props) {
  const [estadoGuardar, guardar, guardando] = useActionState(fijarCantidadEnMazoAccion, INICIAL);
  const [estadoQuitar, quitar, quitando] = useActionState(quitarDelMazoAccion, INICIAL);

  const error = estadoGuardar.error ?? estadoQuitar.error;
  const idCantidad = `cantidad-mazo-${linea.cartaId}`;

  return (
    <li className="flex flex-col gap-2 tarjeta p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">{linea.nombre}</p>
          <p className="text-sm text-tinta/75">
            {linea.idApi} · {linea.idioma}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form action={guardar} className="flex items-center gap-2">
            <input type="hidden" name="mazoId" value={mazoId} />
            <input type="hidden" name="cartaId" value={linea.cartaId} />
            <label htmlFor={idCantidad} className="sr-only">
              Copias de {linea.nombre}
            </label>
            <input
              id={idCantidad}
              name="cantidad"
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              step={1}
              defaultValue={linea.cantidad}
              required
              className="w-20 rounded-xl border-[3px] border-tinta bg-white px-2 py-1.5 text-sm text-tinta"
            />
            <button type="submit" disabled={guardando} className={BOTON}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </form>

          <form action={quitar}>
            <input type="hidden" name="mazoId" value={mazoId} />
            <input type="hidden" name="cartaId" value={linea.cartaId} />
            <button type="submit" disabled={quitando} className={BOTON}>
              {quitando ? "Quitando…" : "Quitar"}
            </button>
          </form>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm font-bold text-[#b42318]">
          {error}
        </p>
      )}
    </li>
  );
}
