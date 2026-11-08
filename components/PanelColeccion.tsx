"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import type { CartaPanel } from "@/lib/panel-coleccion";

/**
 * Panel con las cartas de Mi colección (PBI-X9): imagen, buscador por nombre,
 * filtro por categoría y «Cargar más». Solo pide y muestra datos; qué se hace
 * con cada carta (arrastrarla, elegirla) lo decide quien lo usa con `renderCarta`.
 * Los datos vienen de /api/coleccion/panel, que exige sesión y valida todo en
 * el servidor: nada de lo que se filtra aquí es una regla de seguridad.
 */

type Props = {
  categorias: Array<{ id: number; nombre: string }>;
  renderCarta: (carta: CartaPanel) => ReactNode;
};

type Estado = {
  /** A qué búsqueda y filtro corresponden las cartas guardadas. */
  clave: string;
  /** Última página ya cargada. */
  pagina: number;
  cartas: CartaPanel[];
  hayMas: boolean;
  error: string | null;
};

const VACIO: Estado = { clave: "", pagina: 0, cartas: [], hayMas: false, error: null };
const ESPERA_BUSQUEDA_MS = 300;

const CAMPO = "w-full rounded-xl border-[3px] border-tinta bg-white px-3 py-1.5 text-base text-tinta";

export default function PanelColeccion({ categorias, renderCarta }: Props) {
  const idBusqueda = useId();
  const idCategoria = useId();
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("");
  const [estado, setEstado] = useState<Estado>(VACIO);
  // Qué página se quiere para cada búsqueda: al cambiar la búsqueda vuelve a la 1.
  const [pedida, setPedida] = useState({ clave: "", pagina: 1 });

  const clave = `${busqueda}|${categoria}`;
  const paginaPedida = pedida.clave === clave ? pedida.pagina : 1;

  // Espera a que el usuario deje de escribir antes de pedir datos.
  useEffect(() => {
    const espera = setTimeout(() => setBusqueda(texto.trim()), ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(espera);
  }, [texto]);

  useEffect(() => {
    const control = new AbortController();
    const params = new URLSearchParams({ pagina: String(paginaPedida) });
    if (busqueda) params.set("texto", busqueda);
    if (categoria) params.set("categoria", categoria);

    fetch(`/api/coleccion/panel?${params}`, { signal: control.signal })
      .then(async (respuesta) => {
        const cuerpo = (await respuesta.json().catch(() => null)) as
          | { cartas?: CartaPanel[]; hayMas?: boolean; error?: string }
          | null;
        if (!respuesta.ok || !cuerpo?.cartas) {
          throw new Error(
            respuesta.status === 401
              ? "Inicia sesión para ver tu colección."
              : respuesta.status === 429
                ? "Demasiadas búsquedas seguidas. Espera un momento."
                : "No se pudo cargar tu colección.",
          );
        }
        const nuevas = cuerpo.cartas;
        setEstado((previo) => ({
          clave,
          pagina: paginaPedida,
          // La primera página reemplaza lo anterior; las siguientes se agregan.
          cartas: paginaPedida === 1 || previo.clave !== clave ? nuevas : [...previo.cartas, ...nuevas],
          hayMas: cuerpo.hayMas === true,
          error: null,
        }));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const mensaje = error instanceof Error ? error.message : "No se pudo cargar tu colección.";
        setEstado((previo) => ({ ...previo, clave, pagina: paginaPedida, error: mensaje }));
      });

    return () => control.abort();
  }, [busqueda, categoria, clave, paginaPedida]);

  const cargando = estado.clave !== clave || estado.pagina !== paginaPedida;
  const cartas = estado.clave === clave ? estado.cartas : [];

  return (
    <section aria-labelledby={`${idBusqueda}-titulo`} className="tarjeta flex flex-col gap-3 p-4">
      <h2 id={`${idBusqueda}-titulo`} className="text-lg font-extrabold">
        Mi colección
      </h2>

      <div className="flex flex-col gap-1">
        <label htmlFor={idBusqueda} className="text-sm font-extrabold">
          Buscar por nombre
        </label>
        <input
          id={idBusqueda}
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={50}
          placeholder="Sylveon"
          className={CAMPO}
        />
      </div>

      {categorias.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor={idCategoria} className="text-sm font-extrabold">
            Categoría
          </label>
          <select id={idCategoria} value={categoria} onChange={(e) => setCategoria(e.target.value)} className={CAMPO}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {cargando ? "Cargando cartas…" : `${cartas.length} cartas`}
      </p>

      {estado.error && (
        <p role="alert" className="text-sm font-bold text-[#b42318]">
          {estado.error}
        </p>
      )}

      {!estado.error && !cargando && cartas.length === 0 && (
        <p className="text-sm font-bold">
          {busqueda || categoria ? "Ninguna carta coincide con la búsqueda." : "Tu colección está vacía."}
        </p>
      )}

      <ul className="grid max-h-[32rem] grid-cols-2 gap-2 overflow-y-auto pr-1">
        {cartas.map((carta) => (
          <li key={carta.inventarioId}>{renderCarta(carta)}</li>
        ))}
      </ul>

      {cargando && cartas.length === 0 && <p className="text-sm font-bold">Cargando…</p>}

      {estado.hayMas && estado.clave === clave && (
        <button
          type="button"
          disabled={cargando}
          onClick={() => setPedida({ clave, pagina: paginaPedida + 1 })}
          className="boton boton-neutro !py-1.5 text-sm disabled:opacity-50"
        >
          {cargando ? "Cargando…" : "Cargar más"}
        </button>
      )}
    </section>
  );
}
