# Recuperación y cambio de contraseña (PBI-X4)

## Cómo funciona

1. En `/login`, «¿Olvidaste tu contraseña?» lleva a `/recuperar`.
2. `/recuperar` pide el correo. La respuesta es siempre la misma, exista o no la cuenta: así el formulario no sirve para averiguar qué correos están registrados.
3. Supabase envía el correo. El enlace vuelve a `/auth/callback` con un código de un solo uso (flujo PKCE).
4. `/auth/callback` canjea el código por una sesión y deja una cookie firmada de 15 minutos. El destino es siempre `/restablecer`; nunca se lee de la URL.
5. `/restablecer` pide la contraseña nueva dos veces. Al guardar, se cierran las demás sesiones y se gasta el permiso.
6. Con sesión iniciada, `/cuenta` permite cambiar la contraseña pidiendo la actual.

## Por qué existe la cookie de permiso

Quien abre el enlace del correo queda con sesión. Si `/restablecer` aceptara a cualquiera con sesión, una sesión robada bastaría para cambiar la contraseña sin conocer la actual. La cookie `pb_recuperacion` solo la emite `/auth/callback`; va firmada con HMAC-SHA256 usando la clave secreta del servidor, atada al usuario y con vencimiento ([`lib/recuperacion.ts`](../lib/recuperacion.ts)). Un script en el navegador no puede fabricarla porque es `httpOnly` y no conoce la clave.

## Configuración en Supabase (la hace una persona del equipo)

En **Authentication → URL Configuration**:

- **Site URL:** la URL pública de la aplicación.
- **Redirect URLs:** agregar `https://<tu-dominio>/auth/callback` (y `http://localhost:3000/auth/callback` para desarrollo). Supabase ignora cualquier destino que no esté en esta lista.

En **Authentication → Emails**:

- Revisar la plantilla *Reset Password*. Debe conservar `{{ .ConfirmationURL }}`.
- El correo integrado del plan gratuito envía muy pocos mensajes por hora y solo a miembros del proyecto. Para uso real hay que configurar un SMTP propio (**Authentication → SMTP Settings**).

## Limitaciones conocidas

- **Mismo navegador:** el flujo PKCE exige abrir el enlace en el navegador desde el que se pidió. Abrirlo en otro dispositivo falla y muestra «El enlace venció o ya se usó». La alternativa (`token_hash` con plantilla propia) funciona entre dispositivos, pero obliga a editar la plantilla del correo.
- **Límite de envíos:** lo impone Supabase. La aplicación muestra el mismo mensaje de «Demasiados intentos» que en el inicio de sesión.

## Verificación manual

- [ ] Pedir recuperación con un correo registrado: llega el correo.
- [ ] Pedir recuperación con un correo inexistente: misma respuesta en pantalla, sin correo.
- [ ] Abrir el enlace: lleva a `/restablecer`. Abrirlo por segunda vez: pide uno nuevo.
- [ ] Entrar a `/restablecer` con sesión normal (sin pasar por el correo): redirige a `/recuperar`.
- [ ] Cambiar la contraseña: otra sesión abierta en otro navegador deja de funcionar.
- [ ] `/cuenta` con la contraseña actual equivocada: se rechaza.
