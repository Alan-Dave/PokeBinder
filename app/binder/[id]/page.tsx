import Link from "next/link";
import CarpetaBinder from "@/components/CarpetaBinder";
import CasillaBinder from "@/components/CasillaBinder";
import ControlesBinder from "@/components/ControlesBinder";
import TableroBinder from "@/components/TableroBinder";
import { listarOpcionesInventario, obtenerBinder, SIN_SESION } from "@/lib/binders";
import { urlsImagenesOpcionales } from "@/lib/catalogo";
import { listarCategorias } from "@/lib/categorias";
import { PAGINAS_MAX, PAGINAS_MIN } from "@/lib/validators/binders";

// Depende de la sesión del usuario y las URLs firmadas caducan: sin caché.
export const dynamic = "force-dynamic";

export const metadata = { title: "Binder · PokeBinder" };

// Las clases de Tailwind deben aparecer completas en el código: no se pueden
// armar con `grid-cols-${n}`.
const COLUMNAS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

// La ruta llega como texto: solo dígitos, de 1 a 15, sin ceros a la izquierda.
function entero(texto: string | undefined): number {
  return texto !== undefined && /^[1-9]\d{0,14}$/.test(texto) ? Number(texto) : Number.NaN;
}

export default async function BinderDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pagina?: string | string[] }>;
}) {
  const { id } = await params;
  const { pagina: paginaBruta } = await searchParams;
  const paginaTexto = Array.isArray(paginaBruta) ? paginaBruta[0] : paginaBruta;

  // La validación real la hace obtenerBinder; el resultado trae el mensaje.
  const resultado = await obtenerBinder({
    binderId: entero(id),
    pagina: paginaTexto === undefined ? 1 : entero(paginaTexto),
  });

  if (!resultado.ok) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-8">
        <h1 className="text-2xl font-semibold">Binder</h1>
        <p role="alert" className="rounded-md bg-red-100 px-4 py-2 text-red-900">
          {resultado.error === SIN_SESION ? "Inicia sesión para ver tu binder." : resultado.error}
        </p>
        <Link href={resultado.error === SIN_SESION ? "/login" : "/binder"} className="text-sm font-bold text-azul underline">
          {resultado.error === SIN_SESION ? "Ir a iniciar sesión" : "Volver a mis binders"}
        </Link>
      </main>
    );
  }

  const { binder, pagina, casillas } = resultado.datos;
  const total = binder.filas * binder.columnas;

  const opciones = await listarOpcionesInventario();
  const listaCategorias = await listarCategorias();
  const categorias = listaCategorias.ok ? listaCategorias.datos.map((c) => ({ id: c.id, nombre: c.nombre })) : [];
  const imagenes = await urlsImagenesOpcionales([...new Set(casillas.map((c) => c.cartaId))]);
  const porPosicion = new Map(casillas.map((c) => [c.posicion, c]));

  const enlace = (n: number) => `/binder/${binder.id}?pagina=${n}`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-8">
      <Link href="/binder" className="text-sm font-bold text-azul underline">
        ← Mis binders
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{binder.nombre}</h1>
        <p className="text-sm text-tinta/75">
          Cuadrícula {binder.cuadricula.replace("x", " × ")} · {casillas.length} de {total} casillas ocupadas en esta
          página
        </p>
      </header>

      <TableroBinder
        binderId={binder.id}
        pagina={pagina}
        ocupadas={casillas.map((c) => c.posicion)}
        categorias={categorias}
      >
        <CarpetaBinder id={binder.id} nombre={binder.nombre}>
          <ul className={`grid gap-3 ${COLUMNAS[binder.columnas]}`}>
            {Array.from({ length: total }, (_, posicion) => {
              const c = porPosicion.get(posicion);
              return (
                <CasillaBinder
                  key={posicion}
                  binderId={binder.id}
                  pagina={pagina}
                  posicion={posicion}
                  carta={
                    c
                      ? {
                          id: c.cartaId,
                          nombre: c.nombre,
                          idApi: c.idApi,
                          variante: c.variante,
                          imagenUrl: imagenes[c.cartaId] ?? null,
                        }
                      : null
                  }
                  opciones={opciones.ok ? opciones.datos : []}
                />
              );
            })}
          </ul>
        </CarpetaBinder>
      </TableroBinder>

      <nav aria-label="Páginas del binder" className="flex items-center justify-between text-sm">
        {pagina > 1 ? (
          <Link href={enlace(pagina - 1)} className="font-bold text-azul underline">
            ← Anterior
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
        <span>
          Página {pagina} de {binder.paginas}
        </span>
        {pagina < binder.paginas ? (
          <Link href={enlace(pagina + 1)} className="font-bold text-azul underline">
            Siguiente →
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
      </nav>

      <ControlesBinder
        binderId={binder.id}
        paginas={binder.paginas}
        paginasMin={PAGINAS_MIN}
        paginasMax={PAGINAS_MAX}
      />
    </main>
  );
}
