import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";

/**
 * Renueva la sesión de Supabase en cada petición.
 *
 * El token de acceso caduca a los pocos minutos; si nadie lo renueva, el
 * usuario aparecería sin sesión a mitad de la visita. Los Server Components no
 * pueden escribir cookies, así que la renovación se hace aquí.
 *
 * Esto NO es control de acceso: no bloquea ni redirige a nadie. Quién puede
 * hacer qué lo deciden lib/*.ts (sesión y rol, en el servidor) y RLS.
 */
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesParaGuardar) {
          for (const { name, value } of cookiesParaGuardar) request.cookies.set(name, value);
          respuesta = NextResponse.next({ request });
          for (const { name, value, options } of cookiesParaGuardar) {
            respuesta.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  try {
    // getUser valida el token con Supabase Auth y dispara la renovación.
    await supabase.auth.getUser();
  } catch (error) {
    // Si Supabase no responde, la página igual se sirve; falla la sesión, no el sitio.
    console.error("[proxy] No se pudo renovar la sesión:", error);
  }

  return respuesta;
}

export const config = {
  // Todas las rutas menos los archivos estáticos y las imágenes de Next.js.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
