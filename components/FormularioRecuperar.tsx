"use client";

import { useActionState } from "react";
import { recuperarAccion } from "@/app/recuperar/acciones";
import type { EstadoFormulario } from "@/lib/estado-formulario";

const INICIAL: EstadoFormulario = { error: null };

const CAMPO = "rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";

export default function FormularioRecuperar() {
  const [estado, enviar, enviando] = useActionState(recuperarAccion, INICIAL);

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="correo" className="text-sm font-medium">
          Correo
        </label>
        <input id="correo" name="correo" type="email" autoComplete="email" maxLength={254} required className={CAMPO} />
      </div>

      {estado.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {estado.error}
        </p>
      )}
      {estado.aviso && (
        <p role="status" className="text-sm text-green-800 dark:text-green-400">
          {estado.aviso}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {enviando ? "Enviando…" : "Enviar enlace"}
      </button>
    </form>
  );
}
