import Link from "next/link";
import GraficoEvolucion from "@/components/GraficoEvolucion";
import { obtenerEvolucionValor, SIN_SESION } from "@/lib/evolucion-valor";
import { formatearUsd } from "@/lib/precios";
import { DIAS_POR_DEFECTO } from "@/lib/validators/historial";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Evolución del valor · PokeBinder" };

const PERIODOS = [30, 90, 365];

export default async function EvolucionPage({ searchParams }: { searchParams: Promise<{ dias?: string | string[] }> }) {
  const { dias: diasBruto } = await searchParams;
  const diasTexto = Array.isArray(diasBruto) ? diasBruto[0] : diasBruto;
  // La validación real la hace obtenerEvolucionValor; el resultado trae el mensaje.
  const resultado = await obtenerEvolucionValor({
    dias: diasTexto === undefined ? DIAS_POR_DEFECTO : Number(diasTexto),
  });

  if (!resultado.ok) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-8">
        <h1 className="text-2xl font-semibold">Evolución del valor</h1>
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          {resultado.error === SIN_SESION ? "Inicia sesión para ver la evolución de tu colección." : resultado.error}
        </p>
        <Link href={resultado.error === SIN_SESION ? "/login" : "/coleccion/evolucion"} className="text-sm underline">
          {resultado.error === SIN_SESION ? "Ir a iniciar sesión" : "Volver al período por defecto"}
        </Link>
      </main>
    );
  }

  const { puntos, dias, filasValuadas, filasSinPrecio, inventarioRecortado } = resultado.datos;
  const ultimo = puntos[puntos.length - 1];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <Link href="/coleccion" className="text-sm font-bold text-azul underline">
        ← Volver a mi colección
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Evolución del valor</h1>
        <p className="text-sm font-bold text-tinta/75">
          Tu colección actual valuada con los precios de mercado (TCGplayer, dólares) de los últimos {dias} días.
        </p>
      </header>

      <nav aria-label="Período" className="flex flex-wrap gap-3 text-sm">
        {PERIODOS.map((p) => (
          <Link
            key={p}
            href={`/coleccion/evolucion?dias=${p}`}
            aria-current={p === dias ? "page" : undefined}
            className={`boton !rounded-xl !px-3 !py-1 text-sm ${p === dias ? "boton-amarillo" : "boton-neutro"}`}
          >
            {p} días
          </Link>
        ))}
      </nav>

      {puntos.length === 0 ? (
        <p className="rounded-2xl border-[3px] border-dashed border-tinta bg-white p-6 text-tinta">
          Todavía no hay historial de precios para tus cartas. El historial se empieza a guardar cuando abres tu
          colección o la ficha de una carta, un registro por día: vuelve en unos días.
        </p>
      ) : (
        <>
          <p className="text-sm">
            Último valor estimado: <strong>{formatearUsd(ultimo.valor)}</strong> ({ultimo.fecha}) con {filasValuadas}{" "}
            {filasValuadas === 1 ? "registro" : "registros"} del inventario.
            {filasSinPrecio > 0 && ` No se cuentan ${filasSinPrecio} sin historial o sin precio equivalente.`}
          </p>
          <GraficoEvolucion puntos={puntos} />
        </>
      )}

      {inventarioRecortado && (
        <p className="text-xs font-bold text-tinta/75">
          Solo se consideran los primeros registros de tu inventario; el resto no entra en el cálculo.
        </p>
      )}
      <p className="text-xs font-bold text-tinta/75">
        Es una referencia orientativa: usa tu inventario de hoy con los precios de cada fecha, no refleja cartas que
        tuviste antes.
      </p>
    </main>
  );
}
