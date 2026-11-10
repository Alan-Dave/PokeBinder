import Link from "next/link";
import GraficoBarras from "@/components/GraficoBarras";
import { obtenerDashboard } from "@/lib/dashboard";
import { NOMBRES_IDIOMA } from "@/lib/etiquetas-idioma";
import { SIN_SESION } from "@/lib/reportes";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard · PokeBinder" };

const dinero = new Intl.NumberFormat("es-CL", { style: "currency", currency: "USD" });

const idiomaLegible = (codigo: string) => NOMBRES_IDIOMA[codigo as keyof typeof NOMBRES_IDIOMA] ?? codigo;

export default async function DashboardPage() {
  // La sesión y el aislamiento por usuario los resuelven lib/ y RLS; aquí solo se dibuja.
  const resultado = await obtenerDashboard();

  if (!resultado.ok) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          {resultado.error === SIN_SESION ? "Inicia sesión para ver tu dashboard." : resultado.error}
        </p>
        {resultado.error === SIN_SESION && (
          <Link href="/login" className="text-sm font-bold text-azul underline">
            Ir a iniciar sesión
          </Link>
        )}
      </main>
    );
  }

  const { resumen, analisis } = resultado.datos;
  const idiomas = resumen.porIdioma.map((i) => ({ etiqueta: idiomaLegible(i.idioma), valor: i.copias }));
  const sets = analisis.sets.map((s) => ({
    etiqueta: resumen.nombresSet[`${s.setId}|${s.idioma}`] ?? s.setId,
    valor: s.copias,
  }));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ["Copias", resumen.copias.toLocaleString("es-CL")],
          ["Cartas distintas", resumen.distintas.toLocaleString("es-CL")],
          ["Valor estimado", dinero.format(resumen.valorEstimado)],
          ["Sets completos", String(analisis.completos)],
        ].map(([etiqueta, valor]) => (
          <div key={etiqueta} className="tarjeta p-4">
            <dt className="text-sm text-tinta/75">{etiqueta}</dt>
            <dd className="text-2xl font-semibold">{valor}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="observaciones" className="flex flex-col gap-2">
        <h2 id="observaciones" className="text-lg font-semibold">
          Análisis
        </h2>
        <ul className="list-disc pl-5 text-sm">
          {analisis.observaciones.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
        <p className="text-xs text-tinta/75">
          Calculado en el servidor con tu inventario; no se envía a servicios externos.
        </p>
      </section>

      {resumen.copias > 0 && (
        <>
          <section aria-labelledby="idiomas" className="flex flex-col gap-3">
            <h2 id="idiomas" className="text-lg font-semibold">
              Copias por idioma
            </h2>
            <GraficoBarras titulo="Copias por idioma" datos={idiomas} unidad="copias" />
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b-[3px] border-tinta">
                  <th className="py-2 pr-4">Idioma</th>
                  <th className="py-2">Copias</th>
                </tr>
              </thead>
              <tbody>
                {idiomas.map((i) => (
                  <tr key={i.etiqueta} className="border-b-2 border-tinta/20">
                    <td className="py-2 pr-4">{i.etiqueta}</td>
                    <td className="py-2">{i.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section aria-labelledby="sets" className="flex flex-col gap-3">
            <h2 id="sets" className="text-lg font-semibold">
              Sets con más copias
            </h2>
            <GraficoBarras titulo="Copias por set" datos={sets} unidad="copias" />
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b-[3px] border-tinta">
                  <th className="py-2 pr-4">Set</th>
                  <th className="py-2 pr-4">Idioma</th>
                  <th className="py-2 pr-4">Copias</th>
                  <th className="py-2">Avance</th>
                </tr>
              </thead>
              <tbody>
                {analisis.sets.map((s) => (
                  <tr key={`${s.setId}|${s.idioma}`} className="border-b-2 border-tinta/20">
                    <td className="py-2 pr-4">{resumen.nombresSet[`${s.setId}|${s.idioma}`] ?? s.setId}</td>
                    <td className="py-2 pr-4">{idiomaLegible(s.idioma)}</td>
                    <td className="py-2 pr-4">{s.copias}</td>
                    <td className="py-2">
                      {s.tengo} de {s.total} ({s.porcentaje} %)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      <Link href="/reportes" className="text-sm font-bold text-azul underline">
        Ver reportes detallados y faltantes
      </Link>
    </main>
  );
}
