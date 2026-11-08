import { NextResponse, type NextRequest } from "next/server";
import { canjearCodigoDeRecuperacion } from "@/lib/auth";
import { COOKIE_RECUPERACION, crearPermiso, VIGENCIA_SEGUNDOS } from "@/lib/recuperacion";

/**
 * Destino del enlace del correo de recuperación. Canjea el código por una
 * sesión y deja el permiso firmado que /restablecer exige. El destino es
 * siempre fijo: nunca se lee de la URL (evita redirecciones abiertas).
 */
export async function GET(request: NextRequest) {
  const resultado = await canjearCodigoDeRecuperacion(request.nextUrl.searchParams.get("code"));

  if (!resultado.ok) {
    return NextResponse.redirect(new URL("/recuperar?enlace=invalido", request.nextUrl.origin));
  }

  const respuesta = NextResponse.redirect(new URL("/restablecer", request.nextUrl.origin));
  respuesta.cookies.set(COOKIE_RECUPERACION, crearPermiso(resultado.datos.usuarioId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/restablecer",
    maxAge: VIGENCIA_SEGUNDOS,
  });
  return respuesta;
}
