import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/**
 * Cliente de Supabase para componentes que corren en el navegador.
 *
 * Usa solo la clave publicable: todo lo que haga queda sujeto a las
 * políticas RLS de la base, igual que cualquier visitante.
 */
export function createClient() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
