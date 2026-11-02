import Link from "next/link";
import { redirect } from "next/navigation";
import FormularioRegistro from "@/components/FormularioRegistro";
import { obtenerPerfilActual } from "@/lib/auth";
import { CONTRASENA_MAX, CONTRASENA_MIN, NOMBRE_MAX, NOMBRE_MIN } from "@/lib/validators/auth";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Crear cuenta · PokeBinder" };

export default async function RegistroPage() {
  // Quien ya tiene sesión no necesita ver el formulario.
  if (await obtenerPerfilActual()) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Crear cuenta</h1>
      <FormularioRegistro
        contrasenaMin={CONTRASENA_MIN}
        contrasenaMax={CONTRASENA_MAX}
        nombreMin={NOMBRE_MIN}
        nombreMax={NOMBRE_MAX}
      />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="underline">
          Iniciar sesión
        </Link>
      </p>
    </main>
  );
}
