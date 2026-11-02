"use client";

import { useActionState, useState } from "react";
import { cambiarEstadoCuentaAccion } from "@/app/admin/cuentas/acciones";
import type { EstadoCuenta } from "@/app/admin/cuentas/tipos";
import type { Perfil } from "@/lib/roles";

const INICIAL: EstadoCuenta = { error: null, exito: false };

const BOTON =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

type Props = {
  perfil: Perfil;
  // Los límites vienen de la página (servidor) para no cargar zod en el navegador.
  motivoMin: number;
  motivoMax: number;
};

export default function FilaCuenta({ perfil, motivoMin, motivoMax }: Props) {
  const [estado, enviar, enviando] = useActionState(cambiarEstadoCuentaAccion, INICIAL);
  const [abierto, setAbierto] = useState(false);

  const habilitada = perfil.deshabilitada_en === null;
  const idMotivo = `motivo-${perfil.id}`;

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium">{perfil.nombre_visible}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {perfil.rol === "administrador" ? "Administración" : "Usuario"} ·{" "}
            {habilitada ? "Habilitada" : "Deshabilitada"}
          </p>
          {/* React escapa el texto: el motivo nunca se interpreta como HTML. */}
          {!habilitada && perfil.motivo_deshabilitacion && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Motivo: {perfil.motivo_deshabilitacion}</p>
          )}
        </div>

        {!abierto && (
          <button type="button" onClick={() => setAbierto(true)} className={BOTON}>
            {habilitada ? "Deshabilitar" : "Habilitar"}
          </button>
        )}
      </div>

      {abierto && (
        <form action={enviar} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="usuarioId" value={perfil.id} />
          <input type="hidden" name="habilitar" value={habilitada ? "false" : "true"} />
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor={idMotivo} className="text-sm">
              Motivo
            </label>
            <input
              id={idMotivo}
              name="motivo"
              type="text"
              minLength={motivoMin}
              maxLength={motivoMax}
              required
              className="rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={enviando}
              className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
            >
              {enviando ? "Guardando…" : habilitada ? "Confirmar deshabilitación" : "Confirmar habilitación"}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className={BOTON}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {estado.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {estado.error}
        </p>
      )}
      {estado.exito && !estado.error && (
        <p role="status" className="text-sm text-green-800 dark:text-green-400">
          Estado de la cuenta actualizado.
        </p>
      )}
    </li>
  );
}
