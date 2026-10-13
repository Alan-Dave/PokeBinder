import Link from "next/link";
import { redirect } from "next/navigation";
import FormularioLogin from "@/components/FormularioLogin";
import { obtenerPerfilActual } from "@/lib/auth";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Iniciar sesión · PokeBinder" };

export default async function LoginPage() {
  // Quien ya tiene sesión no necesita ver el formulario.
  if (await obtenerPerfilActual()) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
      <FormularioLogin />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="underline">
          Crear cuenta
        </Link>
      </p>
    </main>
  );
}
