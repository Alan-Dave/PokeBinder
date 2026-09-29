import "server-only";

import { publicEnv } from "@/lib/env";

// La verificación se hace en cada visita, nunca desde una copia en caché.
export const dynamic = "force-dynamic";

type Estado = { conectado: true } | { conectado: false };

/**
 * Consulta el endpoint de salud del servicio de autenticación de Supabase.
 * Una respuesta 200 confirma a la vez que la URL es correcta, que el proyecto
 * está activo (no pausado) y que la clave publicable es válida.
 */
async function verificarSupabase(): Promise<Estado> {
  try {
    const respuesta = await fetch(`${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!respuesta.ok) {
      console.error(`[estado] Supabase respondió HTTP ${respuesta.status}`);
      return { conectado: false };
    }
    return { conectado: true };
  } catch (error) {
    console.error("[estado] No se pudo contactar a Supabase:", error);
    return { conectado: false };
  }
}

export default async function EstadoPage() {
  const estado = await verificarSupabase();

  // El detalle del error queda solo en los registros del servidor: mostrarlo
  // en pantalla revelaría información interna a cualquier visitante.
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Estado del sistema</h1>
      {estado.conectado ? (
        <p className="rounded-md bg-green-100 px-4 py-2 text-green-900">
          Base de datos: conectada
        </p>
      ) : (
        <p className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          Base de datos: sin conexión
        </p>
      )}
    </main>
  );
}
