"use client";

import { useActionState, useState } from "react";
import { cambiarRolAccion } from "@/app/admin/usuarios/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import { ETIQUETAS_ROL } from "@/lib/etiquetas-rol";
import { ROLES, type Rol } from "@/lib/validators/roles";

const INICIAL: EstadoAccion = { error: null, exito: false };

const BOTON =
  "boton boton-neutro !rounded-xl !px-3 !py-1 text-sm disabled:opacity-50";

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
          className="rounded-xl border-[3px] border-tinta bg-white px-2 py-1 text-sm text-tinta"
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
        <p role="alert" className="text-sm font-bold text-[#b42318]">
          {estado.error}
        </p>
      )}
      {estado.exito && <p className="text-sm font-bold text-verde">Rol actualizado.</p>}
    </div>
  );
}
