// Reglas de construcción de un mazo (PBI-16). Va aparte de la capa de servidor
// para poder probarla sin base de datos.
//
// Solo se validan las reglas que el catálogo permite comprobar con certeza.
// La categoría (Pokémon, Entrenador, Energía) y la etapa las completa
// ingesta/completar_categorias.py con datos de TCGdex (PBI-X14); mientras una
// carta no las tenga, lo que no se puede comprobar se devuelve como advertencia
// y nunca como aprobado. No se infiere ni se inventa ningún dato.
//
// Las reglas oficiales no limitan cuántas Energías ni cuántos Partidarios lleva
// un mazo, así que no se validan: la categoría sirve para saber qué carta es una
// energía básica y qué carta puede ser un Pokémon Básico.

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
  /** Categoría según TCGdex; null mientras no se haya completado. */
  categoria?: CategoriaCarta | null;
  /** Solo en energías: true si es básica; null si no se sabe. */
  energiaBasica?: boolean | null;
};

export type CategoriaCarta = "Pokemon" | "Trainer" | "Energy";

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

/**
 * Energía básica (sin límite de copias). Si el catálogo ya dice si lo es, manda
 * ese dato; si no, se reconoce por el nombre en inglés de las 8 básicas.
 */
function esEnergiaBasica(entrada: EntradaMazo): boolean {
  if (entrada.energiaBasica === true) return entrada.categoria === "Energy";
  if (entrada.energiaBasica === false) return false;
  return ENERGIAS_BASICAS.has(claveNombre(entrada));
}

/**
 * Una carta que NO puede ser un Pokémon Básico con certeza: es Entrenador o
 * Energía, o tiene una etapa conocida que no es básica. Si falta la etapa de
 * algo que podría ser Pokémon, no se sabe.
 */
function sabemosQueNoEsBasico(entrada: EntradaMazo): boolean {
  if (entrada.categoria === "Trainer" || entrada.categoria === "Energy") return true;
  return entrada.stage !== null && !ETAPAS_BASICAS.has(entrada.stage.toLowerCase());
}

function tieneSubtipo(entrada: EntradaMazo, subtipo: string): boolean {
  const buscado = subtipo.toLowerCase();
  return entrada.subtipos.some((s) => s.toLowerCase() === buscado);
}

/** «A», «A y B», «A, B y C» o «A, B, C y 2 más»: nombra hasta tres y cuenta el resto. */
function listaDeNombres(nombres: readonly string[], maximo = 3): string {
  const unicos = [...new Set(nombres)];
  if (unicos.length === 1) return unicos[0];
  if (unicos.length <= maximo) return `${unicos.slice(0, -1).join(", ")} y ${unicos[unicos.length - 1]}`;
  return `${unicos.slice(0, maximo).join(", ")} y ${unicos.length - maximo} más`;
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
  const porNombre = new Map<string, { nombre: string; copias: number; basica: boolean }>();
  for (const e of entradas) {
    const clave = claveNombre(e);
    const actual = porNombre.get(clave);
    if (actual) {
      actual.copias += e.cantidad;
      actual.basica = actual.basica && esEnergiaBasica(e);
    } else {
      porNombre.set(clave, { nombre: e.nombre, copias: e.cantidad, basica: esEnergiaBasica(e) });
    }
  }
  for (const { nombre, copias, basica } of porNombre.values()) {
    if (basica || copias <= COPIAS_MAX) continue;
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
      const sinDato = entradas.filter((e) => !sabemosQueNoEsBasico(e));
      if (sinDato.length > 0) {
        advertencias.push({
          regla: "basico",
          mensaje: `No se pudo comprobar que el mazo tenga un Pokémon Básico porque el catálogo no tiene la categoría o la etapa de ${listaDeNombres(sinDato.map((e) => e.nombre))}. Confirma tú que alguna lo sea.`,
        });
      } else {
        errores.push({ regla: "basico", mensaje: "El mazo necesita al menos un Pokémon Básico." });
      }
    }
  }

  return { total, errores, advertencias, cumple: errores.length === 0 };
}
