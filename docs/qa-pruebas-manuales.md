# Registro de pruebas manuales de QA y seguridad (PBI-27)

Se completa durante las pruebas. Cada fila lleva **Pasa** o **Falla**; si falla, se anota
la evidencia (captura o texto) y se abre una tarjeta nueva en Azure Boards.

**Preparación.** Sitio de producción (dominio de `main`), dos cuentas normales (**A** y
**B**) y una cuenta de administrador. Dos navegadores, o uno normal y otro en incógnito.
F12 abierto con la **Consola** y la pestaña **Red** a la vista.

Con **B** se crea antes: una carta en la colección, un mazo (anotar su id en
`/mazos/<id>`), un binder (id en `/binder/<id>`) y un reporte de error del catálogo.

Fecha: ____ · Quién probó: ____ · Versión (commit o despliegue): ____

## 1. Aislamiento entre dos cuentas (AB#95 · PBI-X28)

| # | Con la sesión de A | Esperado | Resultado | Evidencia |
|---|---|---|---|---|
| 1.1 | Abrir `/mazos/<id del mazo de B>` | «No existe» o aviso; nunca el contenido de B | | |
| 1.2 | Abrir `/binder/<id del binder de B>` | Igual | | |
| 1.3 | Abrir `/mazos/<id>/proxies` con el id del mazo de B | Error o 404, nunca el PDF de B | | |
| 1.4 | Probar `0`, `-1`, `abc` y `99999999` como id en `/mazos/…` y `/binder/…` | Aviso genérico, sin errores internos | | |
| 1.5 | `/coleccion` de A | Solo las cartas de A | | |
| 1.6 | `/reportes` de A | Solo reportes de A | | |
| 1.7 | Descargar CSV y Excel de `/coleccion` | Solo datos de A | | |
| 1.8 | Pestaña Red: copiar como fetch una acción de guardar cantidad, cambiar el `id` por el de una fila de B y ejecutarla en la Consola | Error o sin efecto | | |
| 1.9 | Repetir 1.8 con «Eliminar» | Sin efecto | | |
| 1.10 | Con B, revisar que sus datos siguen intactos | Igual que al empezar | | |

## 2. Cuenta normal contra administración (AB#95)

| # | Paso | Esperado | Resultado | Evidencia |
|---|---|---|---|---|
| 2.1 | A abre `/admin/usuarios` | Aviso de permiso, sin lista | **Pasa** | Confirmado por Macarena el 16/11/2026: solo el aviso de permiso, sin listas |
| 2.2 | A abre `/admin/auditoria` | Aviso de permiso | **Pasa** | Confirmado por Macarena el 16/11/2026: solo el aviso de permiso, sin listas |
| 2.3 | A abre `/admin/reportes` | Aviso de permiso | **Pasa** | Confirmado por Macarena el 16/11/2026: solo el aviso de permiso, sin listas |
| 2.4 | Administrador abre `/admin/reportes` y `/admin/auditoria` | Ve datos; en `/admin/usuarios` solo lo que su rol permite | | |

## 3. Consola del navegador y CSP (AB#94 · PBI-X27)

Recorrer con la Consola filtrada por **Errores**: `/`, `/catalogo` (3 páginas), `/catalogo/<id>`,
`/login`, `/registro`, `/recuperar`, `/coleccion`, `/coleccion/evolucion`, `/mazos`, `/mazos/<id>`,
`/binder`, `/binder/<id>` (arrastrar una carta), `/dashboard`, `/reportes`, `/cuenta`.

| # | Esperado | Resultado | Evidencia |
|---|---|---|---|
| 3.1 | Ningún «violates the Content Security Policy» | | |
| 3.2 | Imágenes, gráfico de evolución y PDF funcionan | | |
| 3.3 | Las 404 de imágenes son solo de cartas sin imagen y muestran la ilustración de reemplazo | Parcial | Verificado desde el servidor, no en el navegador: la ilustración responde 200 y la ruta de respaldo devuelve 404 para las cartas sin imagen (ver sección 10) |
| 3.4 | Mi colección muestra la miniatura de cada carta | | |

## 4. Cookies de sesión (AB#96 · PBI-X29)

F12 → Aplicación → Cookies → el dominio del sitio, con la sesión iniciada.

| # | Qué anotar | Valor | Evaluación |
|---|---|---|---|
| 4.1 | `Secure` en las cookies `sb-…-auth-token` | | |
| 4.2 | `SameSite` | | |
| 4.3 | `HttpOnly` | | |
| 4.4 | ¿Aparece el token al escribir `document.cookie` en la Consola? | | |

## 5. Supabase Auth, en el panel (AB#96)

| # | Dónde | Valor encontrado | Evaluación |
|---|---|---|---|
| 5.1 | Sign In / Providers → Email: ¿«Confirm email» activado? | | |
| 5.2 | Largo mínimo y exigencias de la contraseña | | |
| 5.3 | Rate Limits: intentos de inicio de sesión, registros y correos | | |
| 5.4 | URL Configuration: «Site URL» y «Redirect URLs» | | |
| 5.5 | Vigencia de la sesión | | |

## 6. Registros del servidor, en Vercel → Logs (AB#97 · PBI-X30)

Repetir acciones fallidas (contraseña equivocada, ids inválidos, `/admin/*` sin permiso).

| # | Esperado | Resultado | Evidencia |
|---|---|---|---|
| 6.1 | Ninguna contraseña, token, clave ni correo completo en los registros | Parcial | Vercel (Request Logs): 0 advertencias, 0 errores y 0 fatales durante un recorrido por todas las pantallas. Falta ver la línea `[auth]` del intento con contraseña mala (sección 10) |
| 6.2 | En el navegador, mensajes genéricos; sin trazas ni nombres de tablas | | |
| 6.3 | No aparecen `SUPABASE_SECRET_KEY` ni la URL de la base con contraseña | Parcial | En los registros de Vercel y de Supabase revisados no aparecen claves ni la URL de la base; solo rutas y códigos |
## 7. Datos guardados, en Supabase → Table Editor (AB#97)

| # | Tabla | Esperado | Resultado |
|---|---|---|---|
| 7.1 | `precios_historial` | Solo precios por carta y día | |
| 7.2 | `reportes_catalogo` | Solo los reportes enviados | |
| 7.3 | `auditoria` | Cambios de rol y consultas, con fecha y usuario | |
| 7.4 | `perfiles` | Todos `usuario_normal` salvo los asignados | |

## 8. Recuperación y cambio de contraseña

| # | Paso | Esperado | Resultado | Evidencia |
|---|---|---|---|---|
| 8.1 | `/recuperar` con una cuenta existente | Mensaje genérico | | |
| 8.2 | `/recuperar` con una cuenta inexistente | **El mismo** mensaje | | |
| 8.3 | Abrir el enlace del correo y poner contraseña nueva | Funciona | | |
| 8.4 | Abrir **el mismo enlace** otra vez | Pide un enlace nuevo | | |
| 8.5 | Con sesión normal, abrir `/restablecer` sin el correo | Redirige | | |
| 8.6 | Cambiar la contraseña con otra sesión abierta en otro navegador | La otra sesión deja de funcionar | | |
| 8.7 | `/cuenta` con la contraseña actual equivocada | Rechaza | | |
| 8.8 | `/cuenta` con la contraseña actual correcta | Cambia y cierra las demás sesiones | | |

## 9. Recorrido funcional (AB#94)

Con una cuenta normal, en escritorio y en móvil: registrarse, iniciar sesión, buscar y filtrar
en el catálogo, agregar al inventario, editar y eliminar en Mi colección, crear una categoría,
descargar CSV y Excel, armar un mazo hasta 60 cartas (ver el contador y las reglas), descargar el
PDF de proxies, crear un binder y arrastrar cartas, enviar un reporte de error, ver el dashboard.

| # | Flujo | Escritorio | Móvil | Observaciones |
|---|---|---|---|---|
| 9.1 | Registro e inicio de sesión | | | |
| 9.2 | Catálogo: búsqueda, filtros y paginación | | | |
| 9.3 | Agregar al inventario desde el catálogo | | | |
| 9.4 | Mi colección: editar, eliminar, categorías | | | |
| 9.5 | Exportar CSV y Excel | | | |
| 9.6 | Evolución del valor | | | |
| 9.7 | Mazo: agregar cartas, reglas y contador | | | |
| 9.8 | PDF de proxies (incluida una carta sin imagen) | | | |
| 9.9 | Binder: crear, arrastrar, quitar, paginar | | | |
| 9.10 | Reporte de error del catálogo | | | |
| 9.11 | Dashboard y reportes de faltantes | | | |
| 9.12 | Portada y logo (ver si se ve estirado; anotar dispositivo y URL) | | | |

## 10. Evidencias y hallazgos del 16 de noviembre de 2026

Resultados parciales a partir de capturas de Vercel y de Supabase. Lo que no figura
aquí sigue **sin probar**: secciones 1, 3 (salvo 3.3), 4, 5, 7, 8 y 9, y el resto de la 6.

### Hallazgo Q1: producción servía una versión vieja (corregido)
| | |
|---|---|
| **Qué pasaba** | `poke-binder-lemon.vercel.app` no mostraba la ilustración de «Imagen no disponible»: `/imagen-no-disponible.webp` daba 404, y tampoco las miniaturas de Mi colección ni los arreglos del catálogo |
| **Causa** | En Vercel, la **rama de producción** seguía siendo `integracion/prueba-completa`, borrada el 9 de noviembre. Todos los despliegues «Production» venían de esa rama (el último del 8 de noviembre) y los de `main` se publicaban como «Preview». Lo que se fusionaba en `main` nunca llegaba al sitio |
| **Corrección** | Settings → Environments → Production → Branch Tracking → `main`, y *Redeploy*. Después `/imagen-no-disponible.webp` responde 200 |
| **Lección** | Al borrar una rama hay que comprobar que ningún servicio la use. Queda anotado en [despliegue.md](despliegue.md) |

### Hallazgo Q2: el proyecto de Supabase se pausó por inactividad (corregido)
El 16 de noviembre el proyecto estaba pausado por 7 días sin actividad y la recuperación
de contraseña fallaba con «No se pudo enviar el correo». La tarea programada que la
documentación daba por hecha no existía. Se agregó el flujo `.github/workflows/mantener-activo.yml`
(PR #90 y #91) y la variable `APP_URL`; se lanzó a mano y terminó en verde (`GET /catalogo -> HTTP 200`).

### Hallazgo Q3: las cartas chinas no buscaban su imagen (PR #92, en revisión)
La ruta `/api/cartas/[id]/imagen-hd` no probaba `zh-tw` ni `zh-cn`, y la validación de la URL
de imagen rechazaba esas rutas. Las cartas con ids entre 90000 y 93000 daban 404 y mostraban
la ilustración de reemplazo. Corrección en el PR #92 (PBI-X34).

### Sección 6 · registros del servidor
| Evidencia | Qué muestra |
|---|---|
| Vercel, Request Logs, recorrido por `/`, `/catalogo`, `/coleccion`, `/binder`, `/mazos`, `/dashboard`, `/reportes`, `/cuenta`, `/admin/usuarios`, `/admin/auditoria` | Todas responden 200; «Contains Console Level»: 0 advertencias, 0 errores, 0 fatales |
| Vercel, intento de inicio de sesión con contraseña mala | `POST /login` 200 (la acción responde con el aviso de error en pantalla) |
| Supabase, API Gateway, mismo intento | `POST /auth/v1/token?grant_type=password` → **400** (credenciales rechazadas), seguido del cierre de sesión. La URL no lleva datos del usuario |
| Supabase, última hora | 2,1 mil respuestas 2xx, **10 respuestas 4xx** y **7 respuestas 5xx** |

**Pendiente de la sección 6:**
1. Esperaba la línea `[auth] Error al iniciar sesión (código: …)` en los registros de Vercel y no apareció. Hay que repetir la prueba con **Live** activo y revisar si se emite.
2. Revisar las **7 respuestas 5xx** de Supabase (¿de cuando el proyecto estaba pausado o reanudándose?).
3. Las rutas `/api/cartas/<id>/imagen-hd` con 404 son cartas que TCGdex no tiene; la ruta no escribe ningún mensaje al fallar, así que desde los registros no se ve el motivo.
