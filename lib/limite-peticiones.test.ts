import { describe, expect, it } from "vitest";
import { claveDeCliente, crearLimitador } from "./limite-peticiones";

function limitadorConReloj(maximo: number, ventanaMs: number, clavesMaximas?: number) {
  let t = 1_000;
  const limitador = crearLimitador({
    maximo,
    ventanaMs,
    clavesMaximas,
    ahora: () => t,
  });
  return { limitador, avanzar: (ms: number) => (t += ms) };
}

describe("crearLimitador", () => {
  it("deja pasar hasta el máximo y rechaza lo que sigue", () => {
    const { limitador } = limitadorConReloj(3, 60_000);
    expect([1, 2, 3, 4].map(() => limitador.permitir("a"))).toEqual([true, true, true, false]);
  });

  it("lleva la cuenta de cada clave por separado", () => {
    const { limitador } = limitadorConReloj(1, 60_000);
    expect(limitador.permitir("a")).toBe(true);
    expect(limitador.permitir("a")).toBe(false);
    expect(limitador.permitir("b")).toBe(true);
  });

  it("vuelve a permitir cuando pasa la ventana", () => {
    const { limitador, avanzar } = limitadorConReloj(1, 60_000);
    limitador.permitir("a");
    expect(limitador.permitir("a")).toBe(false);
    avanzar(60_000);
    expect(limitador.permitir("a")).toBe(true);
  });

  it("indica cuántos segundos faltan para reintentar", () => {
    const { limitador, avanzar } = limitadorConReloj(1, 60_000);
    limitador.permitir("a");
    avanzar(15_000);
    expect(limitador.segundosParaReintentar("a")).toBe(45);
  });

  it("pide al menos 1 segundo, también para una clave desconocida", () => {
    const { limitador } = limitadorConReloj(1, 60_000);
    expect(limitador.segundosParaReintentar("nunca-vista")).toBe(1);
  });

  it("purga las ventanas vencidas al llegar al tope de claves", () => {
    const { limitador, avanzar } = limitadorConReloj(1, 1_000, 2);
    limitador.permitir("a");
    limitador.permitir("b");
    avanzar(1_000);
    // Al purgar, "a" y "b" se olvidan y la nueva clave entra sin problema.
    expect(limitador.permitir("c")).toBe(true);
    expect(limitador.permitir("a")).toBe(true);
  });
});

describe("claveDeCliente", () => {
  it("usa la primera IP de x-forwarded-for", () => {
    const cabeceras = new Headers({
      "x-forwarded-for": "203.0.113.7, 10.0.0.1",
    });
    expect(claveDeCliente(cabeceras)).toBe("203.0.113.7");
  });

  it("agrupa bajo una clave común cuando no hay cabecera", () => {
    expect(claveDeCliente(new Headers())).toBe("desconocido");
    expect(claveDeCliente(new Headers({ "x-forwarded-for": " " }))).toBe("desconocido");
  });

  it("recorta una clave exageradamente larga", () => {
    const larga = "1".repeat(500);
    expect(claveDeCliente(new Headers({ "x-forwarded-for": larga })).length).toBe(64);
  });
});
