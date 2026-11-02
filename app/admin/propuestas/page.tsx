import FilaPropuesta from "@/components/FilaPropuesta";
import { listarPendientes } from "@/lib/propuestas";
import { MOTIVO_RECHAZO_MAX, MOTIVO_RECHAZO_MIN } from "@/lib/validators/propuestas";

// Las URLs firmadas de las vistas previas caducan: nunca se sirve desde caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Propuestas · PokeBinder" };

export default async function PropuestasPage() {
  // El rol se verifica en la base (listar_propuestas_pendientes); aquí solo se muestra el resultado.
  const resultado = await listarPendientes();

  if (!resultado.ok) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-8">
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          {resultado.error}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Propuestas pendientes</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Al aprobar, la imagen, la descripción y los detalles se publican en el catálogo y las demás propuestas
        para la misma carta se rechazan solas.
      </p>

      {resultado.datos.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">No hay propuestas pendientes.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {resultado.datos.map((propuesta) => (
            <FilaPropuesta
              key={propuesta.id}
              propuesta={propuesta}
              motivoMin={MOTIVO_RECHAZO_MIN}
              motivoMax={MOTIVO_RECHAZO_MAX}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
