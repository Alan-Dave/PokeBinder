# PBI-27 (AB#54): QA y endurecimiento de seguridad

Revisión hecha el 5 de noviembre de 2026 sobre la rama que junta `develop` con
todos los PR abiertos (ver `docs/probar-integracion.md`). Mezcla comprobaciones
automáticas (código y pruebas HTTP contra la aplicación en marcha, sin sesión)
con una lista de pruebas manuales que faltan.

## Resultado por regla del proyecto

| Regla | Comprobación | Resultado |
|---|---|---|
| 1. Sin secretos en el código | Búsqueda de `sb_secret_`, JWT y `service_role` en los 108 archivos que cambian respecto de `develop`; `.env.local` ignorado por git | Sin hallazgos. El pipeline además corre gitleaks |
| 2. `service_role` solo en servidor | Solo `lib/imagenes.ts` y `lib/historial-precios.ts` importan el cliente admin; ningún componente `"use client"` importa módulos de servidor | Cumple. El uso sobre `precios_historial` está justificado en `lib/supabase/admin.ts` |
| 3. RLS con `using` y `with check` | Las 11 tablas de `public` tienen RLS activada. Las de datos de usuario llevan ambas cláusulas; `precios_historial` y el catálogo no tienen política de escritura | Cumple. Cada migración nueva trae una prueba SQL con `ROLLBACK` |
| 4. Entrada validada con zod | Todo módulo de `lib/` que consulta la base valida con `safeParse` antes de `.from()`; los dos que no lo hacen (`inventario-filtrado`, `proxies`) son auxiliares puros | Cumple |
| 5. Sin consultas por concatenación | Los únicos filtros con texto del usuario son `like`/`ilike` con `patronPrefijo`, que escapa `%`, `_` y `\`; el valor viaja como parámetro | Cumple |
| 6. Rol verificado en el servidor | Sin sesión, `/admin/*` responde con el aviso de permiso, las descargas con 401 y el resto con el aviso de iniciar sesión; el control real es RLS y las funciones SQL | Cumple, ver F4 |
| 7. Bitácora de solo inserción | Sin cambios en esta revisión; los triggers que bloquean `update/delete/truncate` siguen en la migración original | Sin cambios |
| 8. PDF en servidor, 63 × 88 mm | `app/mazos/[id]/proxies/route.ts` es una ruta de servidor; las medidas son constantes en `lib/proxies.ts` | Cumple |

Otras comprobaciones: CSV/Excel neutralizan fórmulas (`'=CMD()` en las pruebas de
`lib/exportar.test.ts`); `lib/tcgdex.ts` fija el host, no sigue redirecciones y
limita tiempo y tamaño (defensa contra SSRF).

## Hallazgos

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| F1 | No había política de seguridad de contenido (CSP): el propio `next.config.ts` la dejaba pendiente para este PBI | Media | **Corregido**: `lib/csp.ts` + cabecera en `next.config.ts`, con pruebas |
| F2 | `/api/cartas/[id]/imagen-hd` no exige sesión ni tiene límite de peticiones: cualquiera puede hacer que el servidor pida imágenes a TCGdex | Baja | Mitigado. Id validado, host fijo, tiempo y tamaño máximos, caché, límite propio de 240 peticiones por minuto por IP y cortafuegos de Vercel (verificado en el despliegue). Queda abierto exigir sesión, si se quiere cerrar del todo |
| F3 | La CSP admite `'unsafe-inline'` en scripts, porque Next.js inyecta scripts propios para hidratar | Baja | **Corregido**: `proxy.ts` genera un nonce por petición y `script-src` pasa a `'self' 'nonce-…' 'strict-dynamic'`, sin `unsafe-inline`. Todas las páginas se renderizan al pedirse (`connection()` en el layout). Verificado en un navegador real, ver abajo. Queda `style-src 'unsafe-inline'` (Tailwind y estilos en línea): un estilo inyectado cambia la apariencia, pero no ejecuta código |
| F4 | Las páginas protegidas responden 200 con un aviso en vez de redirigir a `/login` | Informativa | **Corregido** (`lib/rutas-protegidas.ts` + `proxy.ts`): un visitante sin ninguna cookie de sesión va al login. Con una cookie vencida o si Supabase falla, la página se sirve y decide ella; las descargas siguen respondiendo 401. Es comodidad, no control de acceso: la sesión y el rol se siguen verificando en el servidor |
| F5 | `/reportes/exportar` sin sesión responde 400 (parámetros) en vez de 401 | Informativa | **Corregido** (`exportarFaltantes` comprueba la sesión antes de validar): sin sesión responde 401 con cualquier parámetro y no explica qué faltaba |

## Verificación sobre lo desplegado (8 de noviembre de 2026)

Pruebas HTTP sin sesión contra el despliegue de Vercel, con `develop` completo
(incluidos CSP, recuperación de contraseña y rediseño). No se probó con sesión.

| Comprobación | Resultado |
|---|---|
| Cabeceras: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security` | Presentes. La CSP coincide con `lib/csp.ts` (solo el propio sitio y el bucket de Supabase para imágenes) |
| `X-Powered-By` | Ausente |
| `/admin/usuarios`, `/admin/auditoria`, `/admin/reportes` sin sesión | Responden con el aviso de permiso, sin datos (hallazgo F4: 200 en vez de redirigir) |
| `/coleccion`, `/binder`, `/mazos`, `/dashboard`, `/reportes` sin sesión | Aviso de iniciar sesión, sin datos |
| `/coleccion/exportar` sin sesión | 401 |
| `/reportes/exportar` sin sesión | 400 (hallazgo F5) |
| `/cuenta` sin sesión | Redirige a `/login` |
| `/restablecer` sin el permiso firmado | Redirige a `/recuperar?enlace=invalido` |
| `/auth/callback` sin código o con código falso | Redirige a `/recuperar?enlace=invalido`; el destino es fijo |
| `/api/cartas/{id}/imagen-hd` con id no numérico, `tam` inválido o carta inexistente | 404, 400 y 404; con datos válidos, `image/webp` |
| 260 peticiones seguidas a la ruta de imágenes | Tras 17 respuestas 200, el cortafuegos de Vercel respondió 403 con un desafío («Security Checkpoint», `X-Vercel-Mitigated: challenge`) |

Sobre F2: la protección de la plataforma actuó antes que el límite propio de la
aplicación (240 por minuto por IP, respuesta 429), así que **este límite no se
verificó desde fuera**; sus pruebas unitarias sí pasan. El hallazgo queda mitigado
por dos capas, una de ellas ajena al código. Probar a ritmo moderado la próxima vez:
la prueba bloqueó la dirección del evaluador unos minutos.

## Verificación de la CSP con nonce (F3), en un navegador real

Hecha con Edge sin ventana, controlado por el protocolo de depuración (CDP),
sobre `next start` (compilación de producción). Es un entorno de prueba local:
no sustituye revisar el despliegue de Vercel.

| Comprobación | Antes (`unsafe-inline`) | Ahora (nonce) |
|---|---|---|
| Scripts de la página con nonce (`/catalogo`) | 0 de 44 | 19 de 19 |
| La página hidrata (elementos con React enganchado) | 999 | 1003 |
| Errores de CSP al navegar `/`, `/catalogo`, `/login`, `/registro` | ninguno | ninguno |
| `<script>` en línea sin nonce, llegado en el HTML (simula un XSS) | **se ejecuta** | bloqueado |
| Manejador `onerror` en línea, llegado en el HTML | **se ejecuta** | bloqueado |
| Cabeceras `Content-Security-Policy` por respuesta | 1 | 1, con un nonce distinto en cada petición |

La prueba de inyección usó una página temporal, ya eliminada. Las 404 que aparecen
en la consola de `/catalogo` son las mismas con ambas políticas (imágenes).

## Qué hace la CSP

Solo se admiten recursos del propio sitio y las imágenes firmadas del bucket de
Supabase. Se prohíben iframes (`frame-ancestors 'none'`), plugins, `<base>` ajeno
y formularios que envíen a otro sitio. Verificada compilando en modo producción y
leyendo la cabecera; **no** se probó en un navegador.

## Pruebas manuales pendientes (necesitan personas y navegador)

Estas no se pueden hacer desde el código; se recomienda hacerlas entre las dos
con la aplicación abierta y la consola del navegador y los logs del servidor a la vista:

1. **Dos cuentas normales:** que A no vea ni modifique inventario, mazos, binders ni
   reportes de B (probando también cambiando ids en la URL y en formularios).
   La capa de base de datos se comprueba con `supabase/tests/aislamiento_entre_usuarios.test.sql`
   (se pega en el SQL Editor; simula dos usuarios y termina en `ROLLBACK`). Falta
   anotar aquí su resultado y hacer la prueba con dos cuentas reales en el navegador.
2. **Cuenta normal contra rutas de administración:** abrir `/admin/usuarios`,
   `/admin/auditoria` y `/admin/reportes` y confirmar que no muestran datos.
3. **Consola del navegador:** recorrer todas las pantallas y confirmar que la CSP no
   bloquea nada legítimo (imágenes del catálogo, binder, gráficos, PDF).
4. **Supabase Auth (panel):** confirmar la política de contraseñas, la confirmación de
   correo y los límites de intentos de inicio de sesión y registro. No se pueden ver desde el código.
5. **Cookies de sesión:** revisar en las herramientas del navegador que sean `HttpOnly`,
   `Secure` (en producción) y `SameSite`.
6. **Logs del servidor:** durante el recorrido, buscar mensajes que revelen detalles
   internos (el código registra el detalle en el servidor y muestra mensajes genéricos).
7. **Qué se guarda y cuándo:** repasar las tablas del panel tras el recorrido: que
   `precios_historial` solo tenga precios, `reportes_catalogo` solo lo enviado, y que
   `auditoria` registre los cambios de rol y las consultas de perfiles.
8. **Recuperación de contraseña (PBI-X4):** pedir el correo con una cuenta existente y
   con una inexistente (la pantalla debe responder igual); abrir el enlace en el mismo
   navegador y elegir contraseña nueva; abrir el mismo enlace otra vez (debe pedir uno
   nuevo); entrar a `/restablecer` con sesión normal, sin pasar por el correo (debe
   redirigir); tras el cambio, una sesión abierta en otro navegador debe dejar de funcionar.
9. **Cambio de contraseña en `/cuenta`:** con la contraseña actual equivocada debe
   rechazarse; con la correcta, cambiarse y cerrar las demás sesiones.
10. **Rediseño y CSP en el navegador:** la portada, el catálogo (precios y colores por
    tipo) y el binder con miniaturas deben verse completos, sin errores de la CSP en la consola.
