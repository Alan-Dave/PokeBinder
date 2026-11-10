"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "@/lib/estado-formulario";
import { CONTRASENA_MAX, CONTRASENA_MIN } from "@/lib/validators/auth";

const INICIAL: EstadoFormulario = { error: null };

const CAMPO = "rounded-xl border-[3px] border-tinta bg-white px-3 py-2 text-base text-tinta";

type Props = {
  accion: (previo: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  /** Con true se pide también la contraseña actual (cambio desde la cuenta). */
  pideActual?: boolean;
  textoBoton: string;
};

/** Formulario de contraseña nueva, compartido por /restablecer y /cuenta. */
export default function FormularioContrasenaNueva({ accion, pideActual = false, textoBoton }: Props) {
  const [estado, enviar, enviando] = useActionState(accion, INICIAL);

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {pideActual && (
        <div className="flex flex-col gap-1">
          <label htmlFor="contrasenaActual" className="text-sm font-extrabold">
            Contraseña actual
          </label>
          <input
            id="contrasenaActual"
            name="contrasenaActual"
            type="password"
            autoComplete="current-password"
            maxLength={CONTRASENA_MAX}
            required
            className={CAMPO}
          />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="contrasena" className="text-sm font-extrabold">
          Contraseña nueva
        </label>
        <input
          id="contrasena"
          name="contrasena"
          type="password"
          autoComplete="new-password"
          minLength={CONTRASENA_MIN}
          maxLength={CONTRASENA_MAX}
          required
          aria-describedby="ayuda-contrasena"
          className={CAMPO}
        />
        <p id="ayuda-contrasena" className="text-xs text-tinta/75">
          Al menos {CONTRASENA_MIN} caracteres. Una frase larga es mejor que una clave con símbolos.
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="confirmacion" className="text-sm font-extrabold">
          Repite la contraseña nueva
        </label>
        <input
          id="confirmacion"
          name="confirmacion"
          type="password"
          autoComplete="new-password"
          maxLength={CONTRASENA_MAX}
          required
          className={CAMPO}
        />
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
        {enviando ? "Guardando…" : textoBoton}
      </button>
    </form>
  );
}
