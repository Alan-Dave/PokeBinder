import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 *
 * Actúa en nombre del usuario de la sesión (leída desde las cookies), así que
 * sigue sujeto a RLS. No usa la clave secreta.
 *
 * `server-only` hace fallar la compilación si algún componente de navegador
 * importa este archivo por error.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Los Server Components no pueden escribir cookies. La renovación
            // de la sesión se hará en el middleware de autenticación (PBI-06).
          }
        },
      },
    },
  );
}
