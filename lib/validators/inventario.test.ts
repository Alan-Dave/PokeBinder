import { describe, expect, it } from "vitest";
import {
  agregarAlInventarioSchema,
  cambiarCantidadSchema,
  eliminarDelInventarioSchema,
  listarInventarioSchema,
} from "./inventario";

const agregarValido = { cartaId: 1, variante: "holo", cantidad: 2 };

describe("agregarAlInventarioSchema", () => {
  it("acepta una entrada válida", () => {
    expect(agregarAlInventarioSchema.parse(agregarValido)).toEqual(agregarValido);
  });

  it("recorta los espacios de la variante", () => {
    const r = agregarAlInventarioSchema.parse({ ...agregarValido, variante: "  holo " });
    expect(r.variante).toBe("holo");
  });

  it.each([0, -1, 1.5, 10000])("rechaza la cantidad %s", (cantidad) => {
    expect(agregarAlInventarioSchema.safeParse({ ...agregarValido, cantidad }).success).toBe(false);
  });

  it.each([1, 9999])("acepta la cantidad límite %s", (cantidad) => {
    expect(agregarAlInventarioSchema.safeParse({ ...agregarValido, cantidad }).success).toBe(true);
  });

  it("rechaza una cantidad que llega como texto", () => {
    const r = agregarAlInventarioSchema.safeParse({ ...agregarValido, cantidad: "2" });
    expect(r.success).toBe(false);
  });

  it("rechaza una variante vacía o demasiado larga", () => {
    expect(agregarAlInventarioSchema.safeParse({ ...agregarValido, variante: "   " }).success).toBe(false);
    expect(agregarAlInventarioSchema.safeParse({ ...agregarValido, variante: "x".repeat(31) }).success).toBe(false);
  });

  it("rechaza un id de carta que no es número, útil contra inyección vía tipo", () => {
    const r = agregarAlInventarioSchema.safeParse({ ...agregarValido, cartaId: "1 OR 1=1" });
    expect(r.success).toBe(false);
  });

  it("rechaza un id de carta no positivo o no entero", () => {
    expect(agregarAlInventarioSchema.safeParse({ ...agregarValido, cartaId: 0 }).success).toBe(false);
    expect(agregarAlInventarioSchema.safeParse({ ...agregarValido, cartaId: 1.5 }).success).toBe(false);
  });

  it("rechaza campos faltantes", () => {
    expect(agregarAlInventarioSchema.safeParse({ cartaId: 1, variante: "holo" }).success).toBe(false);
    expect(agregarAlInventarioSchema.safeParse({}).success).toBe(false);
  });

  it("descarta usuario_id: no se puede crear una fila a nombre de otro usuario", () => {
    const r = agregarAlInventarioSchema.parse({ ...agregarValido, usuario_id: "otro", usuarioId: "otro" });
    expect(r).not.toHaveProperty("usuario_id");
    expect(r).not.toHaveProperty("usuarioId");
  });
});

describe("cambiarCantidadSchema", () => {
  it("acepta un id y una cantidad válidos", () => {
    expect(cambiarCantidadSchema.parse({ id: 5, cantidad: 3 })).toEqual({ id: 5, cantidad: 3 });
  });

  it("rechaza una cantidad fuera de rango", () => {
    expect(cambiarCantidadSchema.safeParse({ id: 5, cantidad: 0 }).success).toBe(false);
    expect(cambiarCantidadSchema.safeParse({ id: 5, cantidad: 10000 }).success).toBe(false);
  });

  it("rechaza un id inválido", () => {
    expect(cambiarCantidadSchema.safeParse({ id: -1, cantidad: 3 }).success).toBe(false);
    expect(cambiarCantidadSchema.safeParse({ id: "5", cantidad: 3 }).success).toBe(false);
  });
});

describe("eliminarDelInventarioSchema", () => {
  it("acepta un id válido", () => {
    expect(eliminarDelInventarioSchema.parse({ id: 9 })).toEqual({ id: 9 });
  });

  it("rechaza un id inválido o ausente", () => {
    expect(eliminarDelInventarioSchema.safeParse({ id: 0 }).success).toBe(false);
    expect(eliminarDelInventarioSchema.safeParse({}).success).toBe(false);
  });
});

describe("listarInventarioSchema", () => {
  it("usa la página 1 por defecto", () => {
    expect(listarInventarioSchema.parse({})).toEqual({ pagina: 1 });
  });

  it("acepta una página válida", () => {
    expect(listarInventarioSchema.parse({ pagina: 4 })).toEqual({ pagina: 4 });
  });

  it("rechaza páginas menores a 1 o no enteras", () => {
    expect(listarInventarioSchema.safeParse({ pagina: 0 }).success).toBe(false);
    expect(listarInventarioSchema.safeParse({ pagina: 1.5 }).success).toBe(false);
  });

  it("da un mensaje en español cuando la página no es un número", () => {
    for (const pagina of [Number.NaN, "2" as unknown as number]) {
      const r = listarInventarioSchema.safeParse({ pagina });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toBe("La página debe ser un número.");
    }
  });
});
