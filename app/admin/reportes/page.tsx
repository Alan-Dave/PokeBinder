import Link from "next/link";
import CerrarReporte from "@/components/CerrarReporte";
import { listarReportes, puedeRevisarReportes, SIN_SESION } from "@/lib/reportes-catalogo";
import { ETIQUETAS_MOTIVO, ESTADOS_REPORTE, type EstadoReporte } from "@/lib/validators/reportes-catalogo";

// Depende de la sesión y cambia con cada revisión: nunca se sirve desde caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Reportes del catálogo · PokeBinder" };

const FORMATO_FECHA = new Intl.DateTimeFormat("es-CL", { dateStyle: "short" });
const NOMBRES_ESTADO: Record<EstadoReporte, string> = {
  abierto: "Abiertos",
  resuelto: "Resueltos",
  descartado: "Descartados",
};

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string | string[] }>;
}) {
  // Esta comprobación solo decide qué pantalla mostrar: el control real es RLS
  // (un usuario normal nunca recibe reportes ajenos ni puede cambiar estados).
  if (!(await puedeRevisarReportes())) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-8">
        <h1 className="text-2xl font-semibold">Reportes del catálogo</h1>
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          Solo Administración puede revisar los reportes.
        </p>
      </main>
    );
  }

  const { estado: bruto } = await searchParams;
  const texto = Array.isArray(bruto) ? bruto[0] : bruto;
  // La validación real la hace listarReportes; el resultado trae el mensaje.
  const resultado = await listarReportes({ estado: texto ?? "abierto" });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Reportes del catálogo</h1>

      <nav aria-label="Estado" className="flex gap-3 text-sm">
        {ESTADOS_REPORTE.map((e) => (
          <Link
            key={e}
            href={`/admin/reportes?estado=${e}`}
            aria-current={(texto ?? "abierto") === e ? "page" : undefined}
            className={(texto ?? "abierto") === e ? "font-semibold underline" : "underline"}
          >
            {NOMBRES_ESTADO[e]}
          </Link>
        ))}
      </nav>

      {!resultado.ok ? (
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          {resultado.error === SIN_SESION ? "Inicia sesión para ver los reportes." : resultado.error}
        </p>
      ) : resultado.datos.length === 0 ? (
        <p className="rounded-2xl border-[3px] border-dashed border-tinta bg-white p-6 text-tinta">
          No hay reportes en este estado.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {resultado.datos.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 tarjeta p-4">
              <p className="font-medium">
                {r.cartas ? (
                  <Link href={`/catalogo/${r.cartas.id}`} className="font-bold text-azul underline">
                    {r.cartas.nombre}
                  </Link>
                ) : (
                  "Carta eliminada"
                )}
                <span className="font-normal text-tinta/75">
                  {" "}
                  · {ETIQUETAS_MOTIVO[r.motivo] ?? r.motivo} · {FORMATO_FECHA.format(new Date(r.creado_en))}
                </span>
              </p>
              {/* El detalle lo escribió un usuario: React lo escapa, nunca se inserta como HTML. */}
              <p className="text-sm whitespace-pre-wrap">{r.detalle}</p>
              {r.estado === "abierto" && <CerrarReporte id={r.id} />}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
