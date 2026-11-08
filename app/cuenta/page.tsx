import { redirect } from "next/navigation";
import { cambiarContrasenaAccion } from "@/app/cuenta/acciones";
import FormularioContrasenaNueva from "@/components/FormularioContrasenaNueva";
import { obtenerPerfilActual } from "@/lib/auth";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Mi cuenta · PokeBinder" };

export default async function CuentaPage() {
  const perfil = await obtenerPerfilActual();
  if (!perfil) redirect("/login");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Mi cuenta</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{perfil.correo}</p>
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Cambiar contraseña</h2>
        <FormularioContrasenaNueva accion={cambiarContrasenaAccion} pideActual textoBoton="Cambiar contraseña" />
      </section>
    </main>
  );
}
