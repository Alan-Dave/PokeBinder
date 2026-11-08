// Reglas de construcción de un mazo (PBI-16). Va aparte de la capa de servidor
// para poder probarla sin base de datos.
//
// Solo se validan las reglas que el catálogo permite comprobar con certeza.
// El catálogo no trae la categoría (Pokémon, Entrenador, Energía) de la mayoría
// de las cartas: lo que no se puede comprobar se devuelve como advertencia y
// nunca como aprobado. No se infiere ni se inventa ningún dato.

export const TAMANO_MAZO = 60;
export const COPIAS_MAX = 4;

// Las energías básicas no tienen límite de copias. Se reconocen por su nombre en
// inglés, que es el único que comparten todas las ediciones e idiomas.
const ENERGIAS_BASICAS = new Set([
  "grass energy",
  "fire energy",
  "water energy",
  "lightning energy",
  "psychic energy",
  "fighting energy",
  "darkness energy",
  "metal energy",
]);

// Etapas que cuentan como Pokémon Básico.
const ETAPAS_BASICAS = new Set(["basic", "baby"]);

export type EntradaMazo = {
  cartaId: number;
  cantidad: number;
  /** Nombre en el idioma de la carta, para mostrar. */
  nombre: string;
  /** Nombre en inglés, que agrupa las ediciones de todos los idiomas; null si no hay versión en inglés. */
  nombreEn: string | null;
  /** Etapa o categoría; null cuando el catálogo no la trae. */
  stage: string | null;
  subtipos: string[];
};

export type ReglaMazo = "tamano" | "copias" | "radiant" | "ace-spec" | "basico";

export type Incumplimiento = { regla: ReglaMazo; mensaje: string };

export type ResultadoReglas = {
  /** Cartas del mazo contando copias. */
  total: number;
  /** Incumplimientos comprobados: el mazo no es válido mientras haya alguno. */
  errores: Incumplimiento[];
  /** Reglas que no se pudieron comprobar por falta de datos del catálogo. */
  advertencias: Incumplimiento[];
  /** true solo si no hay errores. Una advertencia no es una aprobación: se muestra siempre. */
  cumple: boolean;
};

function claveNombre(entrada: EntradaMazo): string {
  return (entrada.nombreEn ?? entrada.nombre).trim().toLowerCase();
}

function tieneSubtipo(entrada: EntradaMazo, subtipo: string): boolean {
  const buscado = subtipo.toLowerCase();
  return entrada.subtipos.some((s) => s.toLowerCase() === buscado);
}

function plural(n: number, singular: string, plural: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${plural}`;
}

export function validarMazo(entradas: readonly EntradaMazo[]): ResultadoReglas {
  const errores: Incumplimiento[] = [];
  const advertencias: Incumplimiento[] = [];
  const total = entradas.reduce((suma, e) => suma + e.cantidad, 0);

  // Tamaño: exactamente 60 cartas.
  if (total < TAMANO_MAZO) {
    errores.push({
      regla: "tamano",
      mensaje: `Faltan ${plural(TAMANO_MAZO - total, "carta", "cartas")} para llegar a ${TAMANO_MAZO}.`,
    });
  } else if (total > TAMANO_MAZO) {
    errores.push({
      regla: "tamano",
      mensaje: `Sobran ${plural(total - TAMANO_MAZO, "carta", "cartas")}: el mazo tiene ${total} y el máximo es ${TAMANO_MAZO}.`,
    });
  }

  // Copias: máximo 4 por nombre, sin contar las energías básicas. Ediciones e
  // idiomas distintos de una misma carta suman juntos.
  const porNombre = new Map<string, { nombre: string; copias: number }>();
  for (const e of entradas) {
    const clave = claveNombre(e);
    const actual = porNombre.get(clave);
    if (actual) actual.copias += e.cantidad;
    else porNombre.set(clave, { nombre: e.nombre, copias: e.cantidad });
  }
  for (const [clave, { nombre, copias }] of porNombre) {
    if (ENERGIAS_BASICAS.has(clave) || copias <= COPIAS_MAX) continue;
    errores.push({
      regla: "copias",
      mensaje: `${nombre}: tienes ${copias} copias y el máximo es ${COPIAS_MAX}.`,
    });
  }

  // Cartas limitadas a 1 por mazo, según el subtipo que marque el catálogo.
  for (const [regla, subtipo, etiqueta] of [
    ["radiant", "Radiant", "Radiant"],
    ["ace-spec", "ACE SPEC", "ACE SPEC"],
  ] as const) {
    const copias = entradas.filter((e) => tieneSubtipo(e, subtipo)).reduce((suma, e) => suma + e.cantidad, 0);
    if (copias > 1) {
      errores.push({
        regla,
        mensaje: `Solo se permite 1 carta ${etiqueta} por mazo y tienes ${copias}.`,
      });
    }
  }

  // Pokémon Básico: el mazo necesita al menos uno. Solo se puede afirmar o negar
  // si las cartas tienen etapa; si no, se avisa de que no se pudo comprobar.
  if (total > 0) {
    const hayBasico = entradas.some((e) => e.stage !== null && ETAPAS_BASICAS.has(e.stage.toLowerCase()));
    if (!hayBasico) {
      const sinEtapa = entradas.filter((e) => e.stage === null).length;
      if (sinEtapa > 0) {
        advertencias.push({
          regla: "basico",
          mensaje: `No se pudo comprobar que el mazo tenga un Pokémon Básico: el catálogo no trae la categoría de ${sinEtapa} de las ${plural(entradas.length, "carta distinta", "cartas distintas")} del mazo.`,
        });
      } else {
        errores.push({ regla: "basico", mensaje: "El mazo necesita al menos un Pokémon Básico." });
      }
    }
  }

  return { total, errores, advertencias, cumple: errores.length === 0 };
}
