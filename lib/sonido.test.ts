import { describe, expect, it, vi } from "vitest";
import {
  CLAVE_SONIDO,
  guardarSonido,
  leerSonido,
  reproducirTono,
  TONOS,
  tonoDeClick,
  type ControlClick,
} from "./sonido";

const almacen = (inicial: string | null = null) => {
  let valor = inicial;
  return {
    getItem: vi.fn(() => valor),
    setItem: vi.fn((_: string, v: string) => {
      valor = v;
    }),
  };
};

describe("preferencia de sonido", () => {
  it("está apagado por defecto", () => {
    expect(leerSonido(almacen())).toBe(false);
    expect(leerSonido(null)).toBe(false);
  });

  it("solo el valor «1» lo activa: cualquier otra cosa guardada cuenta como apagado", () => {
    expect(leerSonido(almacen("1"))).toBe(true);
    for (const valor of ["0", "true", "si", "", "2"]) expect(leerSonido(almacen(valor))).toBe(false);
  });

  it("guarda y vuelve a leer la preferencia", () => {
    const a = almacen();

    expect(guardarSonido(a, true)).toBe(true);
    expect(a.setItem).toHaveBeenCalledWith(CLAVE_SONIDO, "1");
    expect(leerSonido(a)).toBe(true);

    expect(guardarSonido(a, false)).toBe(true);
    expect(leerSonido(a)).toBe(false);
  });

  it("si el navegador bloquea el almacenamiento, no lanza y lo avisa", () => {
    const roto = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };

    expect(leerSonido(roto)).toBe(false);
    expect(guardarSonido(roto, true)).toBe(false);
    expect(guardarSonido(null, true)).toBe(false);
  });
});

describe("tonoDeClick", () => {
  const control = (atributos: Record<string, string> = {}): ControlClick => ({
    getAttribute: (n) => atributos[n] ?? null,
    hasAttribute: (n) => n in atributos,
  });

  it("suena el clic en un control", () => {
    expect(tonoDeClick({ closest: () => control() })).toBe("clic");
  });

  it("busca el control con un selector que cubre botones, enlaces y pestañas", () => {
    const closest = vi.fn<(selector: string) => ControlClick | null>(() => control());

    tonoDeClick({ closest });

    const selector = closest.mock.calls[0][0];
    for (const parte of ["button", "a[href]", "summary", "[role='tab']", "input[type='checkbox']"]) {
      expect(selector).toContain(parte);
    }
  });

  it("no suena si el clic no cayó en un control", () => {
    expect(tonoDeClick({ closest: () => null })).toBeNull();
    expect(tonoDeClick(null)).toBeNull();
  });

  it.each([
    ["disabled", { disabled: "" }],
    ["aria-disabled", { "aria-disabled": "true" }],
  ])("no suena en un control deshabilitado (%s)", (_, atributos) => {
    expect(tonoDeClick({ closest: () => control(atributos) })).toBeNull();
  });

  it("aria-disabled en «false» no lo deshabilita", () => {
    expect(tonoDeClick({ closest: () => control({ "aria-disabled": "false" }) })).toBe("clic");
  });
});

describe("reproducirTono", () => {
  function contextoFalso() {
    const osciladores: Array<{ type: string; frequency: { value: number }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }> = [];
    const ganancias: Array<{ gain: { setValueAtTime: ReturnType<typeof vi.fn>; exponentialRampToValueAtTime: ReturnType<typeof vi.fn> }; connect: ReturnType<typeof vi.fn> }> = [];
    const contexto = {
      currentTime: 10,
      destination: { nombre: "salida" },
      createOscillator: () => {
        const o = { type: "", frequency: { value: 0 }, start: vi.fn(), stop: vi.fn(), connect: vi.fn() };
        osciladores.push(o);
        return o;
      },
      createGain: () => {
        const g = {
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
        };
        ganancias.push(g);
        return g;
      },
    };
    return { contexto: contexto as unknown as AudioContext, osciladores, ganancias, destino: contexto.destination };
  }

  it("el clic es una sola nota corta y suave", () => {
    const { contexto, osciladores, ganancias, destino } = contextoFalso();

    reproducirTono(contexto, "clic");

    expect(osciladores).toHaveLength(1);
    expect(osciladores[0].frequency.value).toBe(TONOS.clic.frecuencias[0]);
    expect(osciladores[0].type).toBe(TONOS.clic.tipo);
    expect(osciladores[0].start).toHaveBeenCalledWith(10);
    expect(ganancias[0].connect).toHaveBeenCalledWith(destino);
    // Sube hasta el volumen del tono y vuelve a casi cero: sin chasquido.
    expect(ganancias[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(TONOS.clic.volumen, expect.any(Number));
    expect(ganancias[0].gain.exponentialRampToValueAtTime).toHaveBeenLastCalledWith(0.0001, expect.any(Number));
  });

  it("el error son dos notas, una detrás de otra", () => {
    const { contexto, osciladores } = contextoFalso();

    reproducirTono(contexto, "error");

    expect(osciladores.map((o) => o.frequency.value)).toEqual([...TONOS.error.frecuencias]);
    const [primera, segunda] = osciladores.map((o) => o.start.mock.calls[0][0] as number);
    expect(segunda).toBeGreaterThan(primera);
  });

  it("todos los tonos son breves y de volumen bajo", () => {
    for (const tono of Object.values(TONOS)) {
      expect(tono.duracion).toBeLessThanOrEqual(0.3);
      expect(tono.volumen).toBeLessThanOrEqual(0.1);
      expect(tono.volumen).toBeGreaterThan(0);
    }
  });
});
