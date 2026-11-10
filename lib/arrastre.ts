/**
 * Qué hacer cuando el usuario suelta algo en el binder (PBI-15).
 *
 * Función pura: decide la acción a partir de lo arrastrado, dónde se soltó y
 * qué casillas de la página están ocupadas. Es solo una ayuda de interfaz para
 * no enviar peticiones inútiles; la regla real la aplican el servidor y la
 * base (RLS, clave primaria y triggers), que no confían en este cálculo.
 */

export type Origen = { tipo: "casilla"; posicion: number } | { tipo: "inventario"; inventarioId: number };
export type Destino = { tipo: "casilla"; posicion: number } | { tipo: "quitar" };

export type Accion =
  | { tipo: "mover"; desde: number; hasta: number }
  | { tipo: "colocar"; inventarioId: number; posicion: number }
  | { tipo: "quitar"; posicion: number };

export type Decision = { accion: Accion } | { error: string } | null;

export const MENSAJE_OCUPADA = "Esa casilla ya está ocupada. Quita su carta o elige una casilla vacía.";
export const MENSAJE_SOLO_QUITAR_DEL_BINDER = "Solo se pueden quitar las cartas que ya están en el binder.";

export function decidirSoltar(origen: Origen, destino: Destino | null, ocupadas: ReadonlySet<number>): Decision {
  // Soltar fuera de cualquier zona cancela el arrastre sin molestar.
  if (!destino) return null;

  if (destino.tipo === "quitar") {
    return origen.tipo === "casilla"
      ? { accion: { tipo: "quitar", posicion: origen.posicion } }
      : { error: MENSAJE_SOLO_QUITAR_DEL_BINDER };
  }

  if (origen.tipo === "casilla") {
    if (origen.posicion === destino.posicion) return null;
    return ocupadas.has(destino.posicion)
      ? { error: MENSAJE_OCUPADA }
      : {
          accion: {
            tipo: "mover",
            desde: origen.posicion,
            hasta: destino.posicion,
          },
        };
  }

  return ocupadas.has(destino.posicion)
    ? { error: MENSAJE_OCUPADA }
    : {
        accion: {
          tipo: "colocar",
          inventarioId: origen.inventarioId,
          posicion: destino.posicion,
        },
      };
}
