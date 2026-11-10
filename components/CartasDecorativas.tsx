/**
 * Las tres cartas inclinadas de la portada, hechas solo con CSS y formas
 * simples. Son decoración original: no reproducen arte ni personajes oficiales.
 */
function Carta({
  className,
  fondo,
  panel,
  grosor,
  children,
}: {
  className: string;
  fondo: string;
  panel: string;
  grosor: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`absolute rounded-[18px] border-4 border-tinta p-3 ${fondo} ${className}`}>
      <div className={`flex items-center justify-center rounded-[10px] border-[3px] border-tinta ${panel} ${grosor}`}>
        {children}
      </div>
      <div className="mt-3 h-3 w-[70%] rounded-md bg-white" />
      <div className="mt-2 h-3 w-[45%] rounded-md bg-white" />
    </div>
  );
}

export default function CartasDecorativas() {
  return (
    <div aria-hidden="true" className="relative h-[440px] min-w-0 flex-1 basis-[400px] overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -mt-[190px] -ml-[190px] size-[380px] rounded-full border-4 border-tinta bg-amarillo" />

      <Carta
        className="top-[70px] left-[6%] h-[266px] w-[190px] -rotate-12 shadow-[0_8px_0_var(--tinta)]"
        fondo="bg-azul"
        panel="bg-[#bfd3ff]"
        grosor="h-[150px]"
      >
        <svg width="64" height="64" viewBox="0 0 64 64">
          <path
            d="M32 8c10 14 18 22 18 32a18 18 0 0 1-36 0c0-10 8-18 18-32z"
            fill="#fff"
            stroke="#1b1f3b"
            strokeWidth="3"
          />
        </svg>
      </Carta>

      <Carta
        className="top-[60px] right-[6%] h-[266px] w-[190px] rotate-[10deg] shadow-[0_8px_0_var(--tinta)]"
        fondo="bg-verde"
        panel="bg-[#b8f0d6]"
        grosor="h-[150px]"
      >
        <svg width="64" height="64" viewBox="0 0 64 64">
          <path d="M12 52C12 26 28 12 54 10c0 26-14 42-42 42z" fill="#fff" stroke="#1b1f3b" strokeWidth="3" />
        </svg>
      </Carta>

      <Carta
        className="top-5 left-1/2 -ml-[105px] h-[294px] w-[210px] shadow-[0_10px_0_var(--tinta)]"
        fondo="bg-rojo"
        panel="bg-[#ffd9d4]"
        grosor="h-[168px]"
      >
        <svg width="72" height="72" viewBox="0 0 64 64">
          <path
            d="M36 6 14 36h16l-4 22 24-32H34z"
            fill="#ffc93c"
            stroke="#1b1f3b"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
      </Carta>
    </div>
  );
}
