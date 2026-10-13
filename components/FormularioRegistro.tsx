"use client";

import { useActionState } from "react";
import { registrarAccion } from "@/app/registro/acciones";
import type { EstadoFormulario } from "@/lib/estado-formulario";

const INICIAL: EstadoFormulario = { error: null };

const CAMPO =
  "rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700";

type Props = {
  // Los límites vienen de la página (servidor) para no cargar zod en el navegador.
  contrasenaMin: number;
  contrasenaMax: number;
  nombreMin: number;
  nombreMax: number;
};

export default function FormularioRegistro({
  contrasenaMin,
  contrasenaMax,
  nombreMin,
  nombreMax,
}: Props) {
  const [estado, registrar, enviando] = useActionState(registrarAccion, INICIAL);

  return (
    <form action={registrar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="nombreVisible" className="text-sm font-medium">
          Nombre visible
        </label>
        <input
          id="nombreVisible"
          name="nombreVisible"
          type="text"
          autoComplete="nickname"
          minLength={nombreMin}
          maxLength={nombreMax}
          required
          className={CAMPO}
        />
      </div>
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
          autoComplete="new-password"
          minLength={contrasenaMin}
          maxLength={contrasenaMax}
          aria-describedby="ayuda-contrasena"
          required
          className={CAMPO}
        />
        <p id="ayuda-contrasena" className="text-sm text-zinc-600 dark:text-zinc-400">
          Mínimo {contrasenaMin} caracteres. Una frase larga sirve mejor que una clave corta con
          símbolos.
        </p>
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
        {enviando ? "Creando cuenta…" : "Crear cuenta"}
      </button>
    </form>
  );
}
