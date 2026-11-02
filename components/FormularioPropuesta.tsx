"use client";

import { useActionState } from "react";
import { proponerAccion } from "@/app/catalogo/[id]/acciones";
import type { EstadoAccion } from "@/app/coleccion/tipos";

const INICIAL: EstadoAccion = { error: null, exito: false };

const CAMPO =
  "rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700";

type Props = {
  cartaId: number;
  // Los límites vienen de la página (servidor) para no cargar zod en el navegador.
  descripcionMax: number;
  detallesMax: number;
};

export default function FormularioPropuesta({ cartaId, descripcionMax, detallesMax }: Props) {
  const [estado, enviar, enviando] = useActionState(proponerAccion, INICIAL);

  if (estado.exito) {
    return (
      <p role="status" className="text-sm text-green-800 dark:text-green-400">
        Propuesta enviada. Un administrador la revisará antes de publicarla.
      </p>
    );
  }

  return (
    <form action={enviar} className="flex flex-col gap-3">
      <input type="hidden" name="cartaId" value={cartaId} />

      <label className="flex flex-col gap-1 text-sm">
        Imagen (JPEG, PNG o WebP, hasta 2 MB)
        {/* accept solo filtra el diálogo del navegador: el servidor revisa el archivo de verdad. */}
        <input name="archivo" type="file" accept="image/jpeg,image/png,image/webp" required className="text-sm" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Descripción
        <textarea name="descripcion" required maxLength={descripcionMax} rows={3} className={CAMPO} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Detalles
        <textarea name="detalles" required maxLength={detallesMax} rows={4} className={CAMPO} />
      </label>

      <button
        type="submit"
        disabled={enviando}
        className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {enviando ? "Enviando…" : "Enviar propuesta"}
      </button>

      {estado.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {estado.error}
        </p>
      )}
    </form>
  );
}
