import { z } from "zod";

/**
 * Entradas del binder (PBI-14).
 *
 * Las cuadrículas son una lista cerrada: la misma que el check de la tabla
 * public.binders. Qué carta puede ir en cada casilla (que sea del inventario
 * del usuario, que la posición exista) lo decide la base con RLS y triggers;
 * aquí solo se acota la forma de la entrada.
 */

export const CUADRICULAS = ["2x2", "3x3", "3x4", "4x4"] as const;

export type Cuadricula = (typeof CUADRICULAS)[number];

export const PAGINAS_MIN = 1;
export const PAGINAS_MAX = 100;
// La cuadrícula más grande (4x4) tiene 16 casillas.
export const CASILLAS_MAX = 16;

export function dimensionesDe(cuadricula: Cuadricula): { filas: number; columnas: number } {
  const [filas, columnas] = cuadricula.split("x").map(Number);
  return { filas, columnas };
}

export function cuadriculaDe(filas: number, columnas: number): Cuadricula | null {
  const texto = `${filas}x${columnas}`;
  return (CUADRICULAS as readonly string[]).includes(texto) ? (texto as Cuadricula) : null;
}

const id = (nombre: string) =>
  z.number({ error: `${nombre} no es válido.` }).int({ error: `${nombre} no es válido.` }).positive({
    error: `${nombre} no es válido.`,
  });

const nombre = z
  .string({ error: "El nombre debe ser texto." })
  .trim()
  .min(1, { error: "El nombre es obligatorio." })
  .max(60, { error: "El nombre es demasiado largo (máximo 60)." });

const paginas = z
  .number({ error: "El número de páginas debe ser un número." })
  .int({ error: "El número de páginas debe ser entero." })
  .min(PAGINAS_MIN, { error: `El binder necesita al menos ${PAGINAS_MIN} página.` })
  .max(PAGINAS_MAX, { error: `El máximo es ${PAGINAS_MAX} páginas.` });

const pagina = z
  .number({ error: "La página debe ser un número." })
  .int({ error: "La página debe ser un número entero." })
  .min(PAGINAS_MIN, { error: "La página mínima es 1." })
  .max(PAGINAS_MAX, { error: `La página máxima es ${PAGINAS_MAX}.` });

const posicion = z
  .number({ error: "La casilla debe ser un número." })
  .int({ error: "La casilla debe ser un número entero." })
  .min(0, { error: "La casilla no es válida." })
  .max(CASILLAS_MAX - 1, { error: "La casilla no es válida." });

export const crearBinderSchema = z.object({
  nombre,
  cuadricula: z.enum(CUADRICULAS, { error: "La cuadrícula no es válida." }),
  paginas: paginas.default(1),
});

export const obtenerBinderSchema = z.object({
  binderId: id("El binder"),
  pagina: pagina.default(1),
});

export const cambiarPaginasSchema = z.object({
  binderId: id("El binder"),
  paginas,
});

export const eliminarBinderSchema = z.object({ binderId: id("El binder") });

export const colocarCartaSchema = z.object({
  binderId: id("El binder"),
  pagina,
  posicion,
  inventarioId: id("La carta"),
});

export const quitarCartaSchema = z.object({
  binderId: id("El binder"),
  pagina,
  posicion,
});

export type CrearBinderInput = z.infer<typeof crearBinderSchema>;
