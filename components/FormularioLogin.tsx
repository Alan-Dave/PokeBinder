"use client";

import { useActionState } from "react";
import { iniciarSesionAccion } from "@/app/login/acciones";
import type { EstadoFormulario } from "@/lib/estado-formulario";

const INICIAL: EstadoFormulario = { error: null };

const CAMPO =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";

export default function FormularioLogin() {
  const [estado, iniciarSesion, enviando] = useActionState(iniciarSesionAccion, INICIAL);

  return (
    <form action={iniciarSesion} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="correo" className="text-sm font-medium">
          Correo
        </label>
        <input
          id="correo"
          name="correo"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          className={CAMPO}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="contrasena" className="text-sm font-medium">
          Contraseña
        </label>
        <input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="current-password"
          maxLength={72}
          required
          className={CAMPO}
        />
      </div>

      {estado.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {enviando ? "Entrando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
