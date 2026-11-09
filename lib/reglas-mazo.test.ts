import { describe, expect, it } from "vitest";
import { COPIAS_MAX, TAMANO_MAZO, validarMazo, type EntradaMazo } from "./reglas-mazo";

let siguiente = 1;
function carta(parcial: Partial<EntradaMazo> = {}): EntradaMazo {
  const id = siguiente++;
  return {
    cartaId: id,
    cantidad: 1,
    nombre: `Carta ${id}`,
    nombreEn: `Card ${id}`,
    stage: "Item",
    subtipos: [],
    ...parcial,
  };
}

/** Un mazo de 60 cartas con un Pokémon Básico y el resto de Entrenadores distintos. */
function mazoCompleto(): EntradaMazo[] {
  return [
    carta({ nombre: "Pikachu", nombreEn: "Pikachu", stage: "Basic", cantidad: 4 }),
    ...Array.from({ length: 14 }, () => carta({ cantidad: 4 })),
  ];
}

const reglas = (r: ReturnType<typeof validarMazo>) => r.errores.map((e) => e.regla);

describe("tamaño del mazo", () => {
  it("un mazo vacío pide las 60 cartas y no avisa de Pokémon Básico", () => {
    const r = validarMazo([]);
    expect(r.total).toBe(0);
    expect(r.cumple).toBe(false);
    expect(r.errores).toEqual([{ regla: "tamano", mensaje: "Faltan 60 cartas para llegar a 60." }]);
    expect(r.advertencias).toEqual([]);
  });

  it("acepta exactamente 60 cartas", () => {
    const r = validarMazo(mazoCompleto());
    expect(r.total).toBe(TAMANO_MAZO);
    expect(r.errores).toEqual([]);
    expect(r.advertencias).toEqual([]);
    expect(r.cumple).toBe(true);
  });

  it("dice cuántas faltan, en singular y en plural", () => {
    const sinUna = mazoCompleto();
    sinUna[1].cantidad = 3;
    expect(validarMazo(sinUna).errores[0].mensaje).toBe("Faltan 1 carta para llegar a 60.");

    const sinDos = mazoCompleto();
    sinDos[1].cantidad = 2;
    expect(validarMazo(sinDos).errores[0].mensaje).toBe("Faltan 2 cartas para llegar a 60.");
  });

  it("dice cuántas sobran", () => {
    const conDemas = [...mazoCompleto(), carta({ cantidad: 3 })];
    const r = validarMazo(conDemas);
    expect(r.total).toBe(63);
    expect(r.errores).toEqual([
      { regla: "tamano", mensaje: "Sobran 3 cartas: el mazo tiene 63 y el máximo es 60." },
    ]);
  });
});

describe("copias por nombre", () => {
  it("permite hasta 4 copias y rechaza 5", () => {
    const cuatro = validarMazo([carta({ nombre: "Rare Candy", nombreEn: "Rare Candy", cantidad: COPIAS_MAX })]);
    expect(reglas(cuatro)).not.toContain("copias");

    const cinco = validarMazo([carta({ nombre: "Rare Candy", nombreEn: "Rare Candy", cantidad: COPIAS_MAX + 1 })]);
    expect(cinco.errores).toContainEqual({
      regla: "copias",
      mensaje: "Rare Candy: tienes 5 copias y el máximo es 4.",
    });
  });

  it("suma ediciones e idiomas distintos de la misma carta", () => {
    const r = validarMazo([
      carta({ nombre: "Caramelo raro", nombreEn: "Rare Candy", cantidad: 3 }),
      carta({ nombre: "Rare Candy", nombreEn: "Rare Candy", cantidad: 2 }),
    ]);
    expect(r.errores).toContainEqual({
      regla: "copias",
      mensaje: "Caramelo raro: tienes 5 copias y el máximo es 4.",
    });
  });

  it("no mezcla cartas de nombre parecido", () => {
    const r = validarMazo([
      carta({ nombreEn: "Pikachu", cantidad: 4 }),
      carta({ nombreEn: "Pikachu V", cantidad: 4 }),
    ]);
    expect(reglas(r)).not.toContain("copias");
  });

  it("no limita las energías básicas", () => {
    const r = validarMazo([
      carta({ nombre: "Energía Planta", nombreEn: "Grass Energy", stage: null, cantidad: 30 }),
      carta({ nombre: "Energía Fuego", nombreEn: "Fire Energy", stage: null, cantidad: 12 }),
    ]);
    expect(reglas(r)).not.toContain("copias");
  });

  it("sí limita una energía especial", () => {
    const r = validarMazo([carta({ nombreEn: "Double Turbo Energy", stage: null, cantidad: 5 })]);
    expect(reglas(r)).toContain("copias");
  });

  it("usa el nombre de la carta cuando no hay edición en inglés", () => {
    const r = validarMazo([
      carta({ nombre: "Poké Ball", nombreEn: null, cantidad: 3 }),
      carta({ nombre: "poké ball ", nombreEn: null, cantidad: 2 }),
    ]);
    expect(reglas(r)).toContain("copias");
  });
});

describe("cartas limitadas a una por mazo", () => {
  it("rechaza dos cartas Radiant aunque sean distintas", () => {
    const r = validarMazo([
      carta({ nombreEn: "Radiant Charizard", subtipos: ["Radiant"] }),
      carta({ nombreEn: "Radiant Greninja", subtipos: ["Radiant"] }),
    ]);
    expect(r.errores).toContainEqual({
      regla: "radiant",
      mensaje: "Solo se permite 1 carta Radiant por mazo y tienes 2.",
    });
  });

  it("acepta una carta Radiant", () => {
    const r = validarMazo([carta({ subtipos: ["Radiant"] })]);
    expect(reglas(r)).not.toContain("radiant");
  });

  it("rechaza dos copias de una misma carta ACE SPEC, sin distinguir mayúsculas", () => {
    const r = validarMazo([carta({ nombreEn: "Maximum Belt", subtipos: ["ace spec"], cantidad: 2 })]);
    expect(reglas(r)).toContain("ace-spec");
  });
});

describe("Pokémon Básico", () => {
  it("se da por cumplido con una etapa Basic o Baby", () => {
    expect(validarMazo([carta({ stage: "Basic" })]).advertencias).toEqual([]);
    expect(reglas(validarMazo([carta({ stage: "Baby" })]))).not.toContain("basico");
    expect(reglas(validarMazo([carta({ stage: "basic" })]))).not.toContain("basico");
  });

  it("avisa, sin aprobar ni rechazar, cuando hay cartas sin categoría", () => {
    const r = validarMazo([carta({ stage: null }), carta({ stage: null }), carta({ stage: "Item" })]);
    expect(reglas(r)).not.toContain("basico");
    expect(r.advertencias).toEqual([
      {
        regla: "basico",
        mensaje:
          "No se pudo comprobar que el mazo tenga un Pokémon Básico: el catálogo no trae la categoría de 2 de las 3 cartas distintas del mazo.",
      },
    ]);
  });

  it("la advertencia no convierte el mazo en inválido, pero tampoco lo oculta", () => {
    // 15 cartas distintas de 4 copias: 60 en total y ninguna con categoría.
    const sinCategoria = Array.from({ length: 15 }, () => carta({ stage: null, cantidad: 4 }));
    const r = validarMazo(sinCategoria);
    expect(r.errores).toEqual([]);
    expect(r.cumple).toBe(true);
    expect(r.advertencias).toHaveLength(1);
  });

  it("es un error cuando todas las cartas tienen categoría y ninguna es Básico", () => {
    const r = validarMazo([carta({ stage: "Stage 1" }), carta({ stage: "Supporter" })]);
    expect(r.errores).toContainEqual({ regla: "basico", mensaje: "El mazo necesita al menos un Pokémon Básico." });
  });

  it("un solo Básico conocido basta aunque otras cartas no tengan categoría", () => {
    const r = validarMazo([carta({ stage: "Basic" }), carta({ stage: null })]);
    expect(r.advertencias).toEqual([]);
    expect(reglas(r)).not.toContain("basico");
  });
});

describe("con la categoría completada (PBI-X14)", () => {
  it("una energía básica marcada por el catálogo no tiene límite aunque su nombre no esté en la lista", () => {
    const r = validarMazo([
      carta({ nombreEn: "Basic Lightning Energy", categoria: "Energy", energiaBasica: true, stage: null, cantidad: 20 }),
    ]);
    expect(reglas(r)).not.toContain("copias");
  });

  it("una energía especial sí está limitada, aunque se llame como una básica", () => {
    const r = validarMazo([
      carta({ nombreEn: "Fire Energy", categoria: "Energy", energiaBasica: false, stage: null, cantidad: 5 }),
    ]);
    expect(reglas(r)).toContain("copias");
  });

  it("energiaBasica sin categoría Energy no da exención", () => {
    const r = validarMazo([
      carta({ nombreEn: "Rare Candy", categoria: "Trainer", energiaBasica: true, stage: null, cantidad: 5 }),
    ]);
    expect(reglas(r)).toContain("copias");
  });

  it("sin dato de energiaBasica se sigue reconociendo por el nombre", () => {
    const r = validarMazo([carta({ nombreEn: "Water Energy", categoria: null, stage: null, cantidad: 12 })]);
    expect(reglas(r)).not.toContain("copias");
  });

  it("Entrenadores y Energías sin etapa ya no impiden afirmar que falta un Pokémon Básico", () => {
    const r = validarMazo([
      carta({ categoria: "Trainer", stage: null }),
      carta({ categoria: "Energy", energiaBasica: true, nombreEn: "Fire Energy", stage: null }),
    ]);
    expect(r.advertencias).toEqual([]);
    expect(r.errores).toContainEqual({ regla: "basico", mensaje: "El mazo necesita al menos un Pokémon Básico." });
  });

  it("un Pokémon sin etapa conocida mantiene la advertencia: podría ser Básico", () => {
    const r = validarMazo([carta({ categoria: "Pokemon", stage: null }), carta({ categoria: "Trainer", stage: null })]);
    expect(r.advertencias.map((a) => a.regla)).toEqual(["basico"]);
    expect(reglas(r)).not.toContain("basico");
  });

  it("cuenta como incierta solo la carta sin dato, no las que ya se sabe que no son Pokémon", () => {
    const r = validarMazo([
      carta({ categoria: "Trainer", stage: null }),
      carta({ categoria: null, stage: null }),
    ]);
    expect(r.advertencias[0].mensaje).toContain("de 1 de las 2 cartas distintas");
  });
});
