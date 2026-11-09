"use client";

import { useActionState } from "react";
import { crearBinderAccion } from "@/app/binder/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";

const INICIAL: EstadoAccion = { error: null, exito: false };

const CAMPO = "rounded-xl border-[3px] border-tinta bg-white px-2 py-1.5 text-sm text-tinta";

type Props = {
  cuadriculas: readonly string[];
  paginasMin: number;
  paginasMax: number;
};

// Las opciones vienen de la página (servidor) para no cargar zod en el navegador.
export default function FormularioBinder({ cuadriculas, paginasMin, paginasMax }: Props) {
  const [estado, crear, creando] = useActionState(crearBinderAccion, INICIAL);

  return (
    <form action={crear} className="flex flex-col gap-3 tarjeta p-4">
      <h2 className="font-medium">Nuevo binder</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Nombre
          <input name="nombre" required maxLength={60} className={CAMPO} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Cuadrícula
          <select name="cuadricula" defaultValue="3x3" className={CAMPO}>
            {cuadriculas.map((c) => (
              <option key={c} value={c}>
                {c.replace("x", " × ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Páginas
          <input
            name="paginas"
            type="number"
            defaultValue={paginasMin}
            min={paginasMin}
            max={paginasMax}
            required
            className={`${CAMPO} w-24`}
          />
        </label>
        <button
          type="submit"
          disabled={creando}
          className="boton boton-neutro !rounded-xl !px-3 !py-1 text-sm disabled:opacity-50"
        >
          {creando ? "Creando…" : "Crear binder"}
        </button>
      </div>
      {estado.error && (
        <p role="alert" className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-900">
          {estado.error}
        </p>
      )}
    </form>
  );
}
