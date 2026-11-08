"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  crearCategoriaAccion,
  eliminarCategoriaAccion,
  renombrarCategoriaAccion,
} from "@/app/coleccion/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";
import type { Categoria } from "@/lib/categorias";

const INICIAL: EstadoAccion = { error: null, exito: false };

const CAMPO = "rounded-xl border-[3px] border-tinta bg-white px-3 py-1.5 text-base text-tinta";
const FICHA = "rounded-full border-2 border-tinta px-3 py-1 text-sm font-extrabold";

type Props = {
  categorias: Categoria[];
  /** Categoría que filtra la lista, o null si se ven todas las cartas. */
  activa: number | null;
  // El largo máximo viene de la página (servidor) para no cargar zod en el navegador.
  nombreMax: number;
};

function Mensaje({ estado }: { estado: EstadoAccion }) {
  return estado.error ? (
    <p role="alert" className="text-sm font-bold text-[#b42318]">
      {estado.error}
    </p>
  ) : null;
}

function FormularioNueva({ nombreMax }: { nombreMax: number }) {
  const [estado, crear, creando] = useActionState(crearCategoriaAccion, INICIAL);
  return (
    <form action={crear} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm font-extrabold">
        Nueva categoría
        <input name="nombre" required maxLength={nombreMax} placeholder="Mis Sylveon" className={CAMPO} />
      </label>
      <button type="submit" disabled={creando} className="boton boton-rojo">
        {creando ? "Creando…" : "Crear"}
      </button>
      <Mensaje estado={estado} />
    </form>
  );
}

function AjustesDeCategoria({ categoria, nombreMax }: { categoria: Categoria; nombreMax: number }) {
  const [estadoRenombrar, renombrar, renombrando] = useActionState(renombrarCategoriaAccion, INICIAL);
  const [estadoEliminar, eliminar, eliminando] = useActionState(eliminarCategoriaAccion, INICIAL);
  const [confirmando, setConfirmando] = useState(false);

  return (
    <div className="flex flex-col gap-2 border-t-2 border-dashed border-tinta pt-3">
      <form action={renombrar} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={categoria.id} />
        <label className="flex flex-col gap-1 text-sm font-extrabold">
          Nombre de la categoría
          <input name="nombre" required maxLength={nombreMax} defaultValue={categoria.nombre} className={CAMPO} />
        </label>
        <button type="submit" disabled={renombrando} className="boton boton-neutro">
          {renombrando ? "Guardando…" : "Renombrar"}
        </button>

        {confirmando ? (
          <span className="flex items-center gap-2">
            <button
              type="submit"
              formAction={eliminar}
              disabled={eliminando}
              className="boton boton-rojo"
              aria-label={`Confirmar: eliminar la categoría ${categoria.nombre}`}
            >
              {eliminando ? "Eliminando…" : "Confirmar"}
            </button>
            <button type="button" onClick={() => setConfirmando(false)} className="boton boton-neutro">
              Cancelar
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmando(true)} className="boton boton-neutro">
            Eliminar
          </button>
        )}
      </form>
      {confirmando && (
        <p className="text-sm">Las cartas no se borran de tu colección; solo se elimina la categoría.</p>
      )}
      <Mensaje estado={estadoRenombrar} />
      <Mensaje estado={estadoEliminar} />
    </div>
  );
}

export default function PanelCategorias({ categorias, activa, nombreMax }: Props) {
  const seleccionada = categorias.find((c) => c.id === activa) ?? null;

  return (
    <section aria-labelledby="titulo-categorias" className="tarjeta flex flex-col gap-4 p-5">
      <h2 id="titulo-categorias" className="text-xl font-extrabold">
        Categorías
      </h2>

      <nav aria-label="Filtrar por categoría" className="flex flex-wrap gap-2">
        <Link
          href="/coleccion"
          aria-current={seleccionada === null ? "page" : undefined}
          className={`${FICHA} ${seleccionada === null ? "bg-[#FFC93C]" : "bg-white"}`}
        >
          Todas
        </Link>
        {categorias.map((c) => (
          <Link
            key={c.id}
            href={`/coleccion?categoria=${c.id}`}
            aria-current={c.id === activa ? "page" : undefined}
            className={`${FICHA} ${c.id === activa ? "bg-[#FFC93C]" : "bg-white"}`}
          >
            {c.nombre} · {c.cartas}
          </Link>
        ))}
      </nav>
      {categorias.length === 0 && (
        <p className="text-sm">Aún no tienes categorías. Crea una para ordenar tus cartas, por ejemplo «Mis Sylveon».</p>
      )}

      <FormularioNueva nombreMax={nombreMax} />
      {seleccionada && <AjustesDeCategoria key={seleccionada.id} categoria={seleccionada} nombreMax={nombreMax} />}
    </section>
  );
}
