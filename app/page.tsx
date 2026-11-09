import Link from "next/link";
import CartasDecorativas from "@/components/CartasDecorativas";
import LogoMarca from "@/components/LogoMarca";
import { obtenerPerfilActual } from "@/lib/auth";

// Depende de la sesión del usuario: nunca se sirve desde una copia en caché.
export const dynamic = "force-dynamic";

const CIFRAS = [
  { valor: "95.924", texto: "cartas en el catálogo" },
  { valor: "6", texto: "idiomas" },
  { valor: "63 × 88 mm", texto: "proxies a tamaño real" },
  { valor: "USD", texto: "precios de mercado" },
];

const ICONO = "size-[30px]";

const FUNCIONES = [
  {
    titulo: "Catálogo",
    texto: "Busca por nombre, tipo, rareza o idioma, con precios y detalle de cada carta.",
    fondo: "bg-azul",
    icono: (
      <svg className={ICONO} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4-4" />
      </svg>
    ),
  },
  {
    titulo: "Mi colección",
    texto: "Lleva la cuenta de lo que tienes, en qué versión y cuánto vale hoy.",
    fondo: "bg-rojo",
    icono: (
      <svg
        className={ICONO}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="3" width="16" height="18" rx="3" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    ),
  },
  {
    titulo: "Binder virtual",
    texto: "Ordena tus cartas en páginas de 2×2 a 4×4 y arrástralas a su lugar.",
    fondo: "bg-verde",
    icono: (
      <svg
        className={ICONO}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="8" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
        <rect x="13" y="13" width="8" height="8" rx="2" />
      </svg>
    ),
  },
  {
    titulo: "Mazos y proxies",
    texto: "Arma mazos con validación de formato e imprime el PDF listo para recortar.",
    fondo: "bg-amarillo",
    icono: (
      <svg
        className={ICONO}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#1b1f3b"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3l9 5-9 5-9-5 9-5z" />
        <path d="M3 13l9 5 9-5" />
      </svg>
    ),
  },
];

const BOTON_GRANDE = "boton !rounded-2xl !px-8 !py-4 text-xl !shadow-[0_6px_0_var(--tinta)]";

export default async function Home() {
  const perfil = await obtenerPerfilActual();

  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-12 px-4 py-14 sm:px-8 md:py-20">
        <div className="min-w-0 flex-1 basis-[480px]">
          <LogoMarca className="mb-6 h-28 w-auto md:h-36" sizes="(min-width: 768px) 324px, 253px" priority />
          <p className="mb-4 inline-block rounded-full bg-azul px-4 py-1.5 text-base font-extrabold text-white">
            Para coleccionistas de todas las edades
          </p>
          <h1 className="text-5xl leading-[1.02] font-extrabold md:text-7xl">
            Tu colección de cartas, <span className="text-rojo">ordenada</span> y siempre a mano
          </h1>
          <p className="mt-6 max-w-xl text-xl">
            Explora 95.924 cartas en seis idiomas, arma tu binder virtual, crea mazos e imprime tus proxies a tamaño
            real.
          </p>
          <div className="mt-9 flex flex-wrap gap-4">
            {perfil ? (
              <>
                <Link href="/coleccion" className={`${BOTON_GRANDE} boton-rojo`}>
                  Ir a mi colección
                </Link>
                <Link href="/catalogo" className={`${BOTON_GRANDE} boton-amarillo`}>
                  Ver el catálogo
                </Link>
              </>
            ) : (
              <>
                <Link href="/registro" className={`${BOTON_GRANDE} boton-rojo`}>
                  Empezar gratis
                </Link>
                <Link href="/catalogo" className={`${BOTON_GRANDE} boton-amarillo`}>
                  Ver el catálogo
                </Link>
              </>
            )}
          </div>
        </div>
        <CartasDecorativas />
      </section>

      <section aria-label="PokeBinder en cifras" className="bg-tinta px-4 py-10 text-white sm:px-8">
        <dl className="mx-auto grid max-w-6xl grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6 text-center">
          {CIFRAS.map((c) => (
            <div key={c.texto}>
              <dt className="font-titulo text-[44px] leading-tight font-extrabold text-amarillo">{c.valor}</dt>
              <dd className="font-bold">{c.texto}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pt-20 pb-10 sm:px-8">
        <h2 className="mb-3 text-center text-4xl leading-tight font-extrabold md:text-5xl">
          Todo lo que necesitas, en un solo lugar
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-xl">
          Desde buscar una carta hasta llevar tu mazo a la mesa.
        </p>
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-6">
          {FUNCIONES.map((f) => (
            <li key={f.titulo} className="tarjeta p-7">
              <div
                aria-hidden="true"
                className={`flex size-14 items-center justify-center rounded-2xl border-[3px] border-tinta ${f.fondo}`}
              >
                {f.icono}
              </div>
              <h3 className="mt-4 mb-2 text-2xl leading-tight font-bold">{f.titulo}</h3>
              <p>{f.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      {!perfil && (
        <section className="px-4 pt-16 pb-24 sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-8 rounded-[28px] border-4 border-tinta bg-azul px-8 py-12 shadow-[0_10px_0_var(--tinta)] md:px-12">
            <div className="min-w-0 flex-1 basis-[420px] text-white">
              <h2 className="text-4xl leading-tight font-extrabold">¿Listo para ordenar tu colección?</h2>
              <p className="mt-3 text-xl">Crea tu cuenta en un minuto y empieza a guardar tus cartas.</p>
            </div>
            <Link href="/registro" className={`${BOTON_GRANDE} boton-amarillo`}>
              Crear mi cuenta
            </Link>
          </div>
        </section>
      )}

      <footer className="mt-auto bg-tinta px-4 py-7 text-center text-base text-white">
        PokeBinder · Proyecto académico INACAP · Las imágenes y marcas de las cartas pertenecen a sus dueños.
      </footer>
    </main>
  );
}
