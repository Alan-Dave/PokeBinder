"use client";

import { useActionState, useState, type ReactNode } from "react";
import { agregarCartaAlMazoAccion } from "@/app/mazos/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import ImagenConRespaldo from "@/components/ImagenConRespaldo";
import PanelColeccion from "@/components/PanelColeccion";
import type { CartaPanel } from "@/lib/panel-coleccion";
import { etiquetaVariante } from "@/lib/variantes";

/**
 * Cómo se agregan cartas a un mazo (PBI-X11): dos pestañas. «Mi colección» usa
 * el panel con imágenes de PBI-X9; «Catálogo» es la búsqueda de siempre, que la
 * página dibuja en el servidor y entra aquí como `catalogo`. El mazo no se
 * limita a lo que se posee: la cobertura y los proxies existen para las cartas
 * que faltan. Cada «Agregar 1» termina en la misma Server Action de siempre;
 * lo que se muestre aquí no es una regla.
 */

const INICIAL: EstadoAccion = { error: null, exito: false };

type Pestana = "coleccion" | "catalogo";

type Props = {
  mazoId: number;
  /** Copias que ya hay en el mazo, por id de carta. */
  enMazo: Record<number, number>;
  categorias: Array<{ id: number; nombre: string }>;
  pestanaInicial: Pestana;
  catalogo: ReactNode;
};

function TarjetaMazo({ mazoId, carta, enMazo }: { mazoId: number; carta: CartaPanel; enMazo: number }) {
  const [estado, agregar, agregando] = useActionState(agregarCartaAlMazoAccion, INICIAL);

  return (
    <form action={agregar} className="flex h-full flex-col gap-1 rounded-xl border-2 border-tinta bg-white p-1.5">
      <input type="hidden" name="mazoId" value={mazoId} />
      <input type="hidden" name="cartaId" value={carta.cartaId} />
      <span className="flex aspect-[5/7] w-full items-center justify-center overflow-hidden rounded-lg bg-[#e9e9ee]">
        <ImagenConRespaldo src={carta.imagenUrl} alt={carta.nombre} />
      </span>
      <span className="block truncate text-xs font-extrabold">{carta.nombre}</span>
      <span className="block truncate text-xs">
        {etiquetaVariante(carta.variante)} · tienes {carta.cantidad}
      </span>
      {enMazo > 0 && <span className="text-xs font-extrabold text-precio">En el mazo: {enMazo}</span>}
      <button type="submit" disabled={agregando} className="boton boton-azul !rounded-xl !px-3 !py-1 text-xs disabled:opacity-50">
        {agregando ? "Agregando…" : "Agregar 1"}
      </button>
      {estado.error && (
        <span role="alert" className="text-xs font-bold text-[#b42318]">
          {estado.error}
        </span>
      )}
    </form>
  );
}

export default function AgregarCartasAlMazo({ mazoId, enMazo, categorias, pestanaInicial, catalogo }: Props) {
  const [pestana, setPestana] = useState<Pestana>(pestanaInicial);
  const base = "rounded-t-xl border-[3px] border-b-0 border-tinta px-4 py-2 font-extrabold";

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Dónde buscar cartas" className="flex gap-2">
        <button
          type="button"
          role="tab"
          id="pestana-coleccion"
          aria-selected={pestana === "coleccion"}
          aria-controls="panel-coleccion"
          onClick={() => setPestana("coleccion")}
          className={`${base} ${pestana === "coleccion" ? "bg-amarillo" : "bg-white"}`}
        >
          Mi colección
        </button>
        <button
          type="button"
          role="tab"
          id="pestana-catalogo"
          aria-selected={pestana === "catalogo"}
          aria-controls="panel-catalogo"
          onClick={() => setPestana("catalogo")}
          className={`${base} ${pestana === "catalogo" ? "bg-amarillo" : "bg-white"}`}
        >
          Catálogo
        </button>
      </div>

      {/* Las dos se montan siempre: cambiar de pestaña no pierde la búsqueda ni lo escrito. */}
      <div role="tabpanel" id="panel-coleccion" aria-labelledby="pestana-coleccion" hidden={pestana !== "coleccion"}>
        <PanelColeccion
          categorias={categorias}
          columnas="grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
          renderCarta={(carta) => <TarjetaMazo mazoId={mazoId} carta={carta} enMazo={enMazo[carta.cartaId] ?? 0} />}
        />
      </div>
      <div role="tabpanel" id="panel-catalogo" aria-labelledby="pestana-catalogo" hidden={pestana !== "catalogo"}>
        {catalogo}
      </div>
    </div>
  );
}
