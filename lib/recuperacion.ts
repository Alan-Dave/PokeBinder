import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { parseServerEnv } from "@/lib/validators/env";

/**
 * Permiso para restablecer la contraseña sin conocer la actual (PBI-X4).
 *
 * Quien abre el enlace del correo queda con sesión. Sin este permiso, cualquiera
 * con una sesión abierta (por ejemplo una robada) podría entrar a /restablecer y
 * cambiar la contraseña sin saber la actual. El permiso es una cookie que solo
 * emite /auth/callback tras validar el código del correo. Va firmada con HMAC
 * y la clave secreta del servidor, así que ni un script en el navegador ni el
 * propio usuario pueden fabricarla. Está atada al usuario y caduca pronto.
 *
 * No reemplaza a la sesión: solo la complementa.
 */
export const COOKIE_RECUPERACION = "pb_recuperacion";
export const VIGENCIA_SEGUNDOS = 15 * 60;

function firmar(usuarioId: string, vence: number, secreto: string): string {
  return createHmac("sha256", secreto).update(`recuperacion|${usuarioId}|${vence}`).digest("base64url");
}

function secretoDelServidor(): string {
  return parseServerEnv(process.env).SUPABASE_SECRET_KEY;
}

export function crearPermiso(usuarioId: string, ahora = Date.now(), secreto = secretoDelServidor()): string {
  const vence = Math.floor(ahora / 1000) + VIGENCIA_SEGUNDOS;
  return `${vence}.${firmar(usuarioId, vence, secreto)}`;
}

export function permisoValido(
  valor: string | undefined,
  usuarioId: string,
  ahora = Date.now(),
  secreto = secretoDelServidor(),
): boolean {
  if (!valor) return false;
  const [textoVence, firma, ...resto] = valor.split(".");
  if (!textoVence || !firma || resto.length > 0) return false;
  const vence = Number(textoVence);
  if (!Number.isInteger(vence) || vence < Math.floor(ahora / 1000)) return false;

  const esperada = Buffer.from(firmar(usuarioId, vence, secreto));
  const recibida = Buffer.from(firma);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}
