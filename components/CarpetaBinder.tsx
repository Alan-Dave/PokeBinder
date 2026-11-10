import type { ReactNode } from "react";
import { colorDeBinder } from "@/lib/estilo-binder";

/**
 * Carpeta de un binder (PBI-X10), dibujada con CSS: cubierta de color, pestaña
 * con el nombre, anillas y una hoja interior donde van las casillas. Es solo
 * presentación: no cambia cómo se arrastra ni qué se guarda.
 */

type Props = {
  id: number;
  nombre: string;
  children: ReactNode;
};

const ANILLAS = [0, 1, 2];

export default function CarpetaBinder({ id, nombre, children }: Props) {
  const color = colorDeBinder(id);

  return (
    <section aria-label={`Carpeta del binder ${nombre}`} className="relative pt-10">
      {/* La pestaña repite el título de la página: es decoración. */}
      <div
        aria-hidden="true"
        className={`absolute top-0 left-8 flex h-11 max-w-[70%] items-center rounded-t-2xl border-[4px] border-b-0 border-tinta px-5 font-titulo text-lg font-extrabold ${color.cubierta} ${color.texto}`}
      >
        <span className="truncate">{nombre}</span>
      </div>

      <div
        className={`relative rounded-[1.5rem] border-[4px] border-tinta p-3 pl-10 shadow-[6px_6px_0_var(--tinta)] sm:p-5 sm:pl-14 ${color.cubierta}`}
      >
        <div
          aria-hidden="true"
          className="absolute top-0 left-2 flex h-full flex-col justify-evenly sm:left-4"
        >
          {ANILLAS.map((n) => (
            <span
              key={n}
              className="block h-5 w-5 rounded-full border-[3px] border-tinta bg-crema shadow-[inset_2px_2px_0_rgba(27,31,59,0.25)] sm:h-6 sm:w-6"
            />
          ))}
        </div>

        <div className="rounded-2xl border-[3px] border-tinta bg-crema p-3 sm:p-4">{children}</div>
      </div>
    </section>
  );
}

/** Carpeta pequeña para la lista de binders: el mismo color que la grande. */
export function IconoCarpeta({ id }: { id: number }) {
  const color = colorDeBinder(id);
  return (
    <span aria-hidden="true" className="relative inline-block h-12 w-16 shrink-0 pt-2">
      <span className={`absolute top-0 left-1 h-3 w-7 rounded-t-md border-[3px] border-b-0 border-tinta ${color.cubierta}`} />
      <span className={`block h-full w-full rounded-lg border-[3px] border-tinta shadow-[3px_3px_0_var(--tinta)] ${color.cubierta}`}>
        <span className="mt-2.5 ml-1.5 block h-2.5 w-2.5 rounded-full border-2 border-tinta bg-crema" />
      </span>
    </span>
  );
}
