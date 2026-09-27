import { z } from "zod";

// Una clave secreta en una variable NEXT_PUBLIC_ quedaría expuesta a cualquier
// visitante. Se rechaza tanto el formato nuevo (sb_secret_) como el JWT
// antiguo con rol service_role.
export function esClaveSecreta(clave: string): boolean {
  if (clave.startsWith("sb_secret_")) return true;

  const partes = clave.split(".");
  if (partes.length !== 3) return false;

  try {
    // atob en vez de Buffer: este código también corre en el navegador.
    const base64 = partes[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64)) as { role?: unknown };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    protocol: /^https$/,
    error: "NEXT_PUBLIC_SUPABASE_URL debe ser una URL https válida.",
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string({ error: "Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY." })
    .min(1, "Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.")
    .refine((clave) => !esClaveSecreta(clave), {
      message:
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY contiene una clave secreta. " +
        "Usa la clave publicable: la secreta nunca va al navegador.",
    }),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const resultado = publicEnvSchema.safeParse(source);
  if (!resultado.success) {
    const detalle = resultado.error.issues.map((issue) => `- ${issue.message}`).join("\n");
    throw new Error(`Variables de entorno inválidas:\n${detalle}`);
  }
  return resultado.data;
}
