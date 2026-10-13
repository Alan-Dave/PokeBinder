import { z } from "zod";

// Largo antes que complejidad (criterio NIST): exigir mezclar símbolos
// frustra al usuario y no vuelve la clave más difícil de adivinar.
export const CONTRASENA_MIN = 12;
// bcrypt, que usa Supabase Auth, ignora lo que pase de 72 bytes.
export const CONTRASENA_MAX = 72;

// Mismo rango que el check de public.perfiles.nombre_visible.
export const NOMBRE_MIN = 3;
export const NOMBRE_MAX = 30;

// El correo se normaliza (sin espacios, en minúsculas) antes de validarlo, para
// que "Ana@Correo.cl " y "ana@correo.cl" sean la misma cuenta.
const correo = z
  .string({ error: "El correo debe ser texto." })
  .trim()
  .toLowerCase()
  .max(254, { error: "El correo es demasiado largo." })
  .pipe(z.email({ error: "El correo no es válido." }));

// La contraseña nunca se recorta: los espacios pueden ser parte de ella.
const contrasenaNueva = z
  .string({ error: "La contraseña debe ser texto." })
  .min(CONTRASENA_MIN, { error: `La contraseña debe tener al menos ${CONTRASENA_MIN} caracteres.` })
  .max(CONTRASENA_MAX, { error: `La contraseña no puede superar ${CONTRASENA_MAX} caracteres.` });

export const registroSchema = z.object({
  correo,
  contrasena: contrasenaNueva,
  nombreVisible: z
    .string({ error: "El nombre debe ser texto." })
    .trim()
    .min(NOMBRE_MIN, { error: `El nombre debe tener al menos ${NOMBRE_MIN} caracteres.` })
    .max(NOMBRE_MAX, { error: `El nombre no puede superar ${NOMBRE_MAX} caracteres.` }),
});

// Al iniciar sesión no se aplica la política de largo mínimo: eso diría cuál es
// la regla a quien prueba contraseñas. Solo se acota el tamaño de lo recibido.
export const loginSchema = z.object({
  correo,
  contrasena: z
    .string({ error: "La contraseña debe ser texto." })
    .min(1, { error: "Ingresa tu contraseña." })
    .max(CONTRASENA_MAX, { error: "Correo o contraseña incorrectos." }),
});

export type RegistroInput = z.infer<typeof registroSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
