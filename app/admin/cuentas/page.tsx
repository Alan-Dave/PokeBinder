import FilaCuenta from "@/components/FilaCuenta";
import { listarPerfiles } from "@/lib/roles";
import { MOTIVO_MAX, MOTIVO_MIN } from "@/lib/validators/cuentas";

// El estado de las cuentas cambia con cada acción: nunca se sirve desde caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Cuentas · PokeBinder" };

export default async function CuentasPage() {
  // El rol se verifica en la base (listar_perfiles); aquí solo se muestra el resultado.
  const resultado = await listarPerfiles();

  if (!resultado.ok) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-8">
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          {resultado.error}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Cuentas</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Una cuenta deshabilitada no puede iniciar sesión ni ver su colección. El motivo queda en la bitácora.
      </p>

      <ul className="flex flex-col gap-3">
        {resultado.datos.map((perfil) => (
          <FilaCuenta key={perfil.id} perfil={perfil} motivoMin={MOTIVO_MIN} motivoMax={MOTIVO_MAX} />
        ))}
      </ul>
    </main>
  );
}
