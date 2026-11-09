import Link from "next/link";
import FormularioRecuperar from "@/components/FormularioRecuperar";

// Depende de la sesión y de la URL: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Recuperar contraseña · PokeBinder" };

type Parametros = Promise<Record<string, string | string[] | undefined>>;

export default async function RecuperarPage({ searchParams }: { searchParams: Parametros }) {
  const { enlace } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">Recuperar contraseña</h1>
      <p className="text-sm text-tinta/75">
        Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.
      </p>
      {enlace === "invalido" && (
        <p role="alert" className="text-sm font-bold text-[#b42318]">
          El enlace venció o ya se usó. Pide uno nuevo.
        </p>
      )}
      <FormularioRecuperar />
      <p className="text-sm">
        <Link href="/login" className="font-bold text-azul underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </main>
  );
}
