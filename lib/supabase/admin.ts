import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { parseServerEnv } from "@/lib/validators/env";

/**
 * Cliente de Supabase con la clave secreta (service_role).
 *
 * Se salta RLS por completo, así que su uso se limita a lo que RLS no puede
 * resolver por sí solo: firmar URLs de un bucket privado. No se usa para leer
 * ni escribir tablas — para eso está lib/supabase/server.ts, que respeta RLS.
 *
 * `server-only` hace fallar la build si algún componente de navegador la
 * importa por error.
 */
export function createAdminClient() {
  const { SUPABASE_SECRET_KEY } = parseServerEnv(process.env);

  return createSupabaseClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
