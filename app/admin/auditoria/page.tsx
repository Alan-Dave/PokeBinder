import Link from "next/link";
import { listarAuditoria } from "@/lib/auditoria";

// La bitácora cambia con cada acción: nunca se sirve desde caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Bitácora de auditoría · PokeBinder" };

const FORMATO_FECHA = new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "medium" });

type Props = { searchParams: Promise<{ pagina?: string; accion?: string }> };

export default async function AuditoriaPage({ searchParams }: Props) {
  const { pagina, accion } = await searchParams;
  // El rol se verifica en la base (listar_auditoria); aquí solo se muestra el resultado.
  const resultado = await listarAuditoria({ pagina, accion });

  if (!resultado.ok) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-8">
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          {resultado.error}
        </p>
      </main>
    );
  }

  const { registros, total, pagina: actual, porPagina } = resultado.datos;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const enlace = (p: number) => {
    const params = new URLSearchParams({ pagina: String(p) });
    if (accion) params.set("accion", accion);
    return `/admin/auditoria?${params}`;
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Bitácora de auditoría</h1>

      <form className="flex flex-wrap items-center gap-2" method="get">
        <label htmlFor="accion" className="text-sm">
          Acción
        </label>
        <input
          id="accion"
          name="accion"
          defaultValue={accion ?? ""}
          maxLength={50}
          placeholder="cambio_rol"
          className="rounded-md border border-zinc-400 px-2 py-1 text-sm"
        />
        <button type="submit" className="rounded-md border border-zinc-400 px-3 py-1 text-sm">
          Filtrar
        </button>
      </form>

      {registros.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No hay registros.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-300 dark:border-zinc-700">
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Usuario</th>
                <th className="py-2 pr-4">Acción</th>
                <th className="py-2 pr-4">Tabla</th>
                <th className="py-2 pr-4">Registro</th>
                <th className="py-2">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} className="border-b border-zinc-200 align-top dark:border-zinc-800">
                  <td className="py-2 pr-4 whitespace-nowrap">{FORMATO_FECHA.format(new Date(r.ocurrido_en))}</td>
                  {/* Sin usuario_id significa un cambio hecho desde la consola de la base. */}
                  <td className="py-2 pr-4">{r.nombre_visible ?? (r.usuario_id ? "Usuario eliminado" : "Consola")}</td>
                  <td className="py-2 pr-4">{r.accion}</td>
                  <td className="py-2 pr-4">{r.tabla}</td>
                  <td className="py-2 pr-4 break-all">{r.registro_id ?? "—"}</td>
                  {/* React escapa el texto: el detalle nunca se interpreta como HTML. */}
                  <td className="py-2 font-mono text-xs break-all">{r.detalle ? JSON.stringify(r.detalle) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav aria-label="Paginación" className="flex items-center gap-4 text-sm">
        {actual > 1 ? <Link href={enlace(actual - 1)}>← Anterior</Link> : <span />}
        <span>
          Página {actual} de {totalPaginas} · {total} registros
        </span>
        {actual < totalPaginas ? <Link href={enlace(actual + 1)}>Siguiente →</Link> : <span />}
      </nav>
    </main>
  );
}
