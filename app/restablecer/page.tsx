import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { restablecerAccion } from "@/app/restablecer/acciones";
import FormularioContrasenaNueva from "@/components/FormularioContrasenaNueva";
import { obtenerPerfilActual } from "@/lib/auth";
import { COOKIE_RECUPERACION, permisoValido } from "@/lib/recuperacion";

// Depende de la sesión y de una cookie: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Contraseña nueva · PokeBinder" };

export default async function RestablecerPage() {
  // Solo se llega desde el enlace del correo: /auth/callback deja el permiso.
  const perfil = await obtenerPerfilActual();
  const permiso = (await cookies()).get(COOKIE_RECUPERACION)?.value;
  if (!perfil || !permisoValido(permiso, perfil.id)) redirect("/recuperar?enlace=invalido");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Elige tu contraseña nueva</h1>
      <FormularioContrasenaNueva accion={restablecerAccion} textoBoton="Guardar contraseña" />
    </main>
  );
}
