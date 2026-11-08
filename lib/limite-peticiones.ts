/**
 * Límite de peticiones por clave (por ejemplo, por IP) en una ventana de tiempo.
 *
 * Vive en la memoria del proceso. En un servidor de larga vida frena ráfagas
 * abusivas; en una plataforma sin servidor (Vercel) cada instancia lleva su
 * propia cuenta, así que es una defensa parcial y no sustituye a un límite en
 * el borde de la plataforma. Aun así, acota cuánto trabajo externo (TCGdex)
 * puede provocar una sola instancia.
 */

export type Limitador = {
  /** true si la petición cabe en el límite; false si hay que rechazarla (429). */
  permitir: (clave: string) => boolean;
  /** Segundos que debe esperar quien fue rechazado, para la cabecera Retry-After. */
  segundosParaReintentar: (clave: string) => number;
};

type Opciones = {
  maximo: number;
  ventanaMs: number;
  // Tope de claves guardadas: evita que una ráfaga de IPs distintas llene la memoria.
  clavesMaximas?: number;
  ahora?: () => number;
};

type Ventana = { inicio: number; cuenta: number };

export function crearLimitador({ maximo, ventanaMs, clavesMaximas = 10_000, ahora = Date.now }: Opciones): Limitador {
  const ventanas = new Map<string, Ventana>();

  function purgarVencidas(t: number) {
    for (const [clave, ventana] of ventanas) {
      if (t - ventana.inicio >= ventanaMs) ventanas.delete(clave);
    }
  }

  return {
    permitir(clave) {
      const t = ahora();
      if (ventanas.size >= clavesMaximas) purgarVencidas(t);

      const actual = ventanas.get(clave);
      if (!actual || t - actual.inicio >= ventanaMs) {
        ventanas.set(clave, { inicio: t, cuenta: 1 });
        return true;
      }
      if (actual.cuenta >= maximo) return false;
      actual.cuenta += 1;
      return true;
    },

    segundosParaReintentar(clave) {
      const actual = ventanas.get(clave);
      if (!actual) return 1;
      return Math.max(1, Math.ceil((actual.inicio + ventanaMs - ahora()) / 1000));
    },
  };
}

/**
 * Clave del cliente a partir de las cabeceras. Detrás de un proxy de confianza
 * (Vercel, Azure App Service) el primer valor de x-forwarded-for es la IP real
 * del visitante. Sin esa cabecera, todos comparten la clave "desconocido":
 * un límite común, que es lo más seguro a falta de otro dato.
 */
export function claveDeCliente(cabeceras: Headers): string {
  const reenviada = cabeceras.get("x-forwarded-for");
  const primera = reenviada?.split(",")[0]?.trim();
  return primera ? primera.slice(0, 64) : "desconocido";
}
