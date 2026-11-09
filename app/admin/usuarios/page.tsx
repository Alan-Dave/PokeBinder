import Link from "next/link";
import SelectorRol from "@/components/SelectorRol";
import { obtenerPerfilActual } from "@/lib/auth";
import { ETIQUETAS_ROL } from "@/lib/etiquetas-rol";
import { listarPerfiles } from "@/lib/roles";

// Depende de la sesión y cambia con cada asignación: nunca se sirve desde caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Usuarios y roles · PokeBinder" };

const FORMATO_FECHA = new Intl.DateTimeFormat("es-CL", { dateStyle: "short" });

export default async function UsuariosPage() {
  // El rol se verifica en la base (listar_perfiles); aquí solo se muestra el resultado.
  const [resultado, actual] = await Promise.all([listarPerfiles(), obtenerPerfilActual()]);

  if (!resultado.ok) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-8">
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          {resultado.error}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Usuarios y roles</h1>
      <p className="text-sm text-tinta/75">
        Solo un superusuario asigna roles. Nadie cambia el propio y el sistema siempre conserva al menos un
        superusuario. Cada cambio queda en la{" "}
        <Link href="/admin/auditoria" className="font-bold text-azul underline">
          bitácora de auditoría
        </Link>
        .
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-[3px] border-tinta">
              <th className="py-2 pr-4">Usuario</th>
              <th className="py-2 pr-4">Alta</th>
              <th className="py-2">Rol</th>
            </tr>
          </thead>
          <tbody>
            {resultado.datos.map((perfil) => (
              <tr key={perfil.id} className="border-b-2 border-tinta/20 align-top">
                <td className="py-2 pr-4">{perfil.nombre_visible}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{FORMATO_FECHA.format(new Date(perfil.creado_en))}</td>
                <td className="py-2">
                  {perfil.id === actual?.id ? (
                    <span>{ETIQUETAS_ROL[perfil.rol]} (tú)</span>
                  ) : (
                    <SelectorRol usuarioId={perfil.id} nombre={perfil.nombre_visible} rolActual={perfil.rol} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
