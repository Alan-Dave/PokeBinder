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
| F2 | `/api/cartas/[id]/imagen-hd` no exige sesión ni tiene límite de peticiones: cualquiera puede hacer que el servidor pida imágenes a TCGdex | Baja | Abierto. Mitigado por id validado, host fijo, tiempo y tamaño máximos y caché. Recomendación: límite de peticiones en la plataforma de despliegue (o exigir sesión) |
| F3 | La CSP admite `'unsafe-inline'` en scripts, porque Next.js inyecta scripts propios para hidratar | Baja | Abierto. Una política con nonce exige renderizar todo dinámicamente; mejora futura |
| F4 | Las páginas protegidas responden 200 con un aviso en vez de redirigir a `/login` | Informativa | Abierto. No expone datos; es de coherencia de la interfaz |
| F5 | `/reportes/exportar` sin sesión responde 400 (parámetros) en vez de 401 | Informativa | Abierto. No expone datos |

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
