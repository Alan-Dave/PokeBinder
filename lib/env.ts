import { parsePublicEnv } from "@/lib/validators/env";

/**
 * Variables de entorno públicas (llegan al navegador), ya validadas.
 *
 * Se validan al cargar el módulo: si falta una o tiene un formato incorrecto,
 * la aplicación falla de inmediato con un mensaje claro en vez de romperse
 * más tarde en una pantalla cualquiera.
 *
 * Next.js solo incrusta en el bundle del navegador las variables NEXT_PUBLIC_
 * escritas literalmente, por eso se listan una por una.
 */
export const publicEnv = parsePublicEnv({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});
