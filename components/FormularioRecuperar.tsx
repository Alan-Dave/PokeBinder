"use client";

import { useActionState } from "react";
import { recuperarAccion } from "@/app/recuperar/acciones";
import type { EstadoFormulario } from "@/lib/estado-formulario";

const INICIAL: EstadoFormulario = { error: null };

const CAMPO = "rounded-xl border-[3px] border-tinta bg-white px-3 py-2 text-base text-tinta";

export default function FormularioRecuperar() {
  const [estado, enviar, enviando] = useActionState(recuperarAccion, INICIAL);

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="correo" className="text-sm font-extrabold">
          Correo
        </label>
        <input id="correo" name="correo" type="email" autoComplete="email" maxLength={254} required className={CAMPO} />
      </div>

      {estado.error && (
        <p role="alert" className="text-sm font-bold text-[#b42318]">
          {estado.error}
        </p>
      )}
      {estado.aviso && (
        <p role="status" className="text-sm font-bold text-verde">
          {estado.aviso}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="boton boton-rojo disabled:opacity-50"
      >
        {enviando ? "Enviando…" : "Enviar enlace"}
      </button>
    </form>
  );
}
