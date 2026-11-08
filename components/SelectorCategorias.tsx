"use client";

import { useActionState, useRef } from "react";
import { alternarCategoriaAccion } from "@/app/coleccion/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import type { Categoria } from "@/lib/categorias";

const INICIAL: EstadoAccion = { error: null, exito: false };

type Props = {
  inventarioId: number;
  categorias: Categoria[];
  /** Ids de las categorías donde ya está esta carta. */
  marcadas: number[];
};

function CasillaCategoria({
  inventarioId,
  categoria,
  marcada,
}: {
  inventarioId: number;
  categoria: Categoria;
  marcada: boolean;
}) {
  const [estado, alternar, guardando] = useActionState(alternarCategoriaAccion, INICIAL);
  const formulario = useRef<HTMLFormElement>(null);

  return (
    <form ref={formulario} action={alternar} className="flex flex-col">
      <input type="hidden" name="categoriaId" value={categoria.id} />
      <input type="hidden" name="inventarioId" value={inventarioId} />
      <label className="flex items-center gap-2 text-sm font-bold">
        {/* Desmarcada no envía «marcar»: la acción interpreta eso como quitar. */}
        <input
          type="checkbox"
          name="marcar"
          value="1"
          defaultChecked={marcada}
          disabled={guardando}
          onChange={() => formulario.current?.requestSubmit()}
        />
        {categoria.nombre}
      </label>
      {estado.error && (
        <span role="alert" className="text-xs font-bold text-[#b42318]">
          {estado.error}
        </span>
      )}
    </form>
  );
}

/** Desplegable para poner una carta de la colección en una o varias categorías. */
export default function SelectorCategorias({ inventarioId, categorias, marcadas }: Props) {
  if (categorias.length === 0) return null;

  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-bold">
        Categorías{marcadas.length > 0 ? ` (${marcadas.length})` : ""}
      </summary>
      <div className="mt-2 flex flex-col gap-1.5">
        {categorias.map((c) => (
          <CasillaCategoria
            key={c.id}
            inventarioId={inventarioId}
            categoria={c}
            marcada={marcadas.includes(c.id)}
          />
        ))}
      </div>
    </details>
  );
}
