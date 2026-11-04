"use client";

import { useActionState, useState } from "react";
import { cambiarRolAccion } from "@/app/admin/usuarios/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import { ETIQUETAS_ROL } from "@/lib/etiquetas-rol";
import { ROLES, type Rol } from "@/lib/validators/roles";

const INICIAL: EstadoAccion = { error: null, exito: false };

const BOTON =
  "rounded-md border border-zinc-300 px-3 py-1 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";

type Props = { usuarioId: string; nombre: string; rolActual: Rol };

export default function SelectorRol({ usuarioId, nombre, rolActual }: Props) {
  const [estado, cambiar, cambiando] = useActionState(cambiarRolAccion, INICIAL);
  const [elegido, setElegido] = useState<Rol>(rolActual);
  // Un cambio de rol es sensible: se pide confirmar antes de enviarlo.
  const [confirmando, setConfirmando] = useState(false);

  return (
    <div className="flex flex-col items-start gap-1">
      <form action={cambiar} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="usuarioId" value={usuarioId} />
        <label htmlFor={`rol-${usuarioId}`} className="sr-only">
          Rol de {nombre}
        </label>
        <select
          id={`rol-${usuarioId}`}
          name="rol"
          value={elegido}
          onChange={(e) => {
            setElegido(e.target.value as Rol);
            setConfirmando(false);
          }}
          className="rounded-md border border-zinc-400 bg-transparent px-2 py-1 text-sm"
        >
          {ROLES.map((rol) => (
            <option key={rol} value={rol}>
              {ETIQUETAS_ROL[rol]}
            </option>
          ))}
        </select>

        {elegido !== rolActual &&
          (confirmando ? (
            <>
              <button type="submit" disabled={cambiando} className={BOTON}>
                {cambiando ? "Guardando…" : `Confirmar: ${ETIQUETAS_ROL[elegido]}`}
              </button>
              <button type="button" onClick={() => setConfirmando(false)} className={BOTON}>
                Cancelar
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmando(true)} className={BOTON}>
              Cambiar rol
            </button>
          ))}
      </form>
      {estado.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {estado.error}
        </p>
      )}
      {estado.exito && <p className="text-sm text-green-800 dark:text-green-400">Rol actualizado.</p>}
    </div>
  );
}
