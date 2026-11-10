"use client";

import { useActionState } from "react";
import { crearMazoAccion } from "@/app/mazos/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";

const INICIAL: EstadoAccion = { error: null, exito: false };

const CAMPO = "rounded-xl border-[3px] border-tinta bg-white px-2 py-1.5 text-sm text-tinta";

// El límite viene de la página (servidor) para no cargar zod en el navegador.
export default function FormularioMazo({ nombreMax }: { nombreMax: number }) {
  const [estado, crear, creando] = useActionState(crearMazoAccion, INICIAL);

  return (
    <form action={crear} className="flex flex-col gap-3 tarjeta p-4">
      <h2 className="font-medium">Nuevo mazo</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Nombre
          <input name="nombre" required maxLength={nombreMax} className={CAMPO} />
        </label>
        <button
          type="submit"
          disabled={creando}
          className="boton boton-neutro !rounded-xl !px-3 !py-1 text-sm disabled:opacity-50"
        >
          {creando ? "Creando…" : "Crear mazo"}
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
