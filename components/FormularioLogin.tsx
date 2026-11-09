"use client";

import { useActionState } from "react";
import { iniciarSesionAccion } from "@/app/login/acciones";
import type { EstadoFormulario } from "@/lib/estado-formulario";

const INICIAL: EstadoFormulario = { error: null };

const CAMPO =
  "rounded-xl border-[3px] border-tinta bg-white px-3 py-2 text-base text-tinta";

export default function FormularioLogin() {
  const [estado, iniciarSesion, enviando] = useActionState(iniciarSesionAccion, INICIAL);

  return (
    <form action={iniciarSesion} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="correo" className="text-sm font-extrabold">
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
        <label htmlFor="contrasena" className="text-sm font-extrabold">
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
        <p role="alert" className="text-sm font-bold text-[#b42318]">
          {estado.error}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="boton boton-rojo disabled:opacity-50"
      >
        {enviando ? "Entrando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
