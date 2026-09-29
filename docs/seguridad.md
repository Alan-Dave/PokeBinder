# Clasificación de datos críticos

> Este documento cubre un control puntual: identificar los datos críticos de la
> plataforma y su resguardo. No es el documento de los 15 controles de
> seguridad que menciona `CLAUDE.md` — ese vive en otro lugar (Wiki de Azure
> DevOps) y no se duplica aquí. Si en algún momento se decide traerlo al
> repositorio, este archivo pasa a ser una sección de ese documento mayor, no
> se reemplaza.

## Por qué existe

La Ley 21.719 exige saber qué datos personales se tratan, para qué, y qué
resguardo tiene cada uno. Además, ningún sistema serio debería tener sus
secretos técnicos (claves, contraseñas de conexión) mezclados con sus datos
de negocio sin distinguir cuáles exigen más cuidado. Esta tabla es esa
distinción, para el estado actual del proyecto (PBI-03, 04, 07 y 08).

## Niveles

- **Secreto técnico.** Si se filtra, compromete todo el sistema, no solo un
  usuario. Nunca en el código, nunca en un commit, nunca en el navegador.
- **Personal.** Identifica o puede vincularse a una persona. Protegido por RLS
  y, cuando corresponde, por auditoría de quién lo cambió o accedió a él en
  bloque.
- **Público.** El catálogo de cartas. Cualquiera lo lee sin sesión, a propósito
  (regla del proyecto: el catálogo es de lectura pública).

## Tabla

| Dato | Dónde vive | Nivel | Resguardo actual |
|---|---|---|---|
| `SUPABASE_SECRET_KEY` | Variable de entorno del servidor | Secreto técnico | Nunca en `NEXT_PUBLIC_*`; `parseServerEnv` ([env.ts](../lib/validators/env.ts)) rechaza el arranque si no es una clave secreta real. Solo la usa [`admin.ts`](../lib/supabase/admin.ts), y solo para firmar URLs de Storage — nunca para leer tablas. |
| Contraseña de conexión a Postgres (`SUPABASE_DB_URL`) | Variable de entorno de los scripts de `/ingesta` | Secreto técnico | Nunca en el string de conexión ni en el historial de la terminal: los scripts la piden con `getpass`, que no la muestra en pantalla. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Variable de entorno pública, bundle del navegador | — (no es secreta) | Inofensiva porque RLS limita lo que permite hacer. `esClaveSecreta` impide que alguien pegue ahí la clave secreta por error. |
| Contraseña de cada usuario | `auth.users`, la gestiona Supabase Auth | Personal | La aplicación nunca la ve ni la guarda: Supabase Auth almacena el hash. Ninguna tabla propia duplica este dato. |
| Correo de cada usuario | `auth.users` | Personal | Fuera de las tablas propias del proyecto; acceso sujeto a las políticas de Supabase Auth, no a las de `public`. |
| `nombre_visible`, `rol` | `perfiles` | Personal | RLS: cada usuario ve y edita solo su propio perfil ([`perfiles_mazos_auditoria`](../supabase/migrations/20260928004000_perfiles_mazos_auditoria.sql)). Nadie puede escribir su propio `rol` (`grant update (nombre_visible)` sin incluir `rol`). Cambiarlo pasa por `asignar_rol`, verificado en el servidor (regla 6) y auditado. |
| Rol de **todos** los usuarios a la vez | Resultado de `listar_perfiles()` | Personal (acceso masivo) | Solo lo puede pedir un superusuario. Antes no dejaba registro; esta entrega agrega una fila de auditoría cada vez que se llama ([`auditar_listar_perfiles`](../supabase/migrations/20260928080000_auditar_listar_perfiles.sql)), porque ver los datos personales de todos de un vistazo pesa distinto que ver los propios. |
| Inventario y mazos (`inventario`, `mazos`, `mazo_cartas`) | Tablas propias | Personal | RLS: `for all` restringido a `usuario_id = auth.uid()`, con `using` **y** `with check`. Nadie ve ni modifica la colección o los mazos de otro. |
| Historial de cambios de rol (`auditoria`) | Tabla propia | Personal (derivado) | Solo inserción: los triggers bloquean `update`, `delete` y `truncate`, incluso para `service_role`. Sin políticas de lectura: nadie la consulta por la API, ni con sesión. `usuario_id` no tiene clave foránea a propósito, para que el registro sobreviva si se borra la cuenta. |
| Ruta de la imagen de cada carta (`cartas.imagen_path`) | Tabla propia | Público (no personal) | No es un dato de usuario: es la ubicación de un archivo del catálogo. Se expone sin problema por la misma política pública de `cartas`; lo que protege el bucket es que la ruta sola no sirve sin una URL firmada ([`imagen_path`](../supabase/migrations/20260928050000_imagen_path.sql)). |
| Catálogo (`cartas`, `sets`) | Tablas propias | Público | Lectura abierta a propósito. Sin escritura desde la API: solo el script de ingesta, por conexión directa. |

## Políticas de RLS por tabla

Verificación de la regla 3 (`CLAUDE.md`): toda tabla con datos de usuario lleva
RLS activada y una política con `using` **y** `with check`. Hay 7 tablas en el
proyecto; ninguna quedó sin RLS.

| Tabla | RLS | Políticas de escritura | `using` + `with check` |
|---|---|---|---|
| `sets`, `cartas` | Activa | Ninguna — la escritura está revocada por completo ([`catalogo.sql`](../supabase/migrations/20260926213011_catalogo.sql)) | No aplica: son catálogo público, no dato de usuario. La política de lectura solo lleva `using`, que es lo correcto para `select` |
| `perfiles` | Activa | `update`, restringida a la propia fila | Ambos. Además, `grant update (nombre_visible)` bloquea a nivel de columna que alguien escriba su propio `rol`, aunque sea su fila |
| `inventario` | Activa | `for all`, restringida a `usuario_id = auth.uid()` | Ambos |
| `mazos` | Activa | `for all`, restringida a `usuario_id = auth.uid()` | Ambos |
| `mazo_cartas` | Activa | `for all`, vía subconsulta a `mazos` (el mazo debe ser del usuario) | Ambos |
| `auditoria` | Activa | Ninguna política, para ningún comando | Más estricto que la regla: ni siquiera se intenta permitir un caso. Solo escriben funciones `security definer` |

**Por qué las políticas de solo lectura no llevan `with check`:** `with check`
solo tiene efecto en `insert`/`update`; agregarlo a una política de `select` no
hace nada. El riesgo real que la regla 3 busca evitar —crear o modificar una
fila a nombre de otro usuario— solo existe en políticas de escritura, y todas
las que hay en el proyecto (`perfiles.update`, `inventario`, `mazos`,
`mazo_cartas`) ya llevan ambas cláusulas.

**Storage:** los buckets `Images` y `Assets` son privados y `storage.objects`
no tiene ninguna política para ellos ([`buckets_storage.sql`](../supabase/migrations/20260927120000_buckets_storage.sql)).
Ni `anon` ni `authenticated` pueden leer, subir ni borrar un archivo. Solo
`service_role` opera sobre ellos, y en el código eso queda acotado a firmar
URLs ([`admin.ts`](../lib/supabase/admin.ts)) — nunca a leer o escribir tablas.

**Funciones con control de rol propio:** `asignar_rol` y `listar_perfiles`
([`asignar_roles.sql`](../supabase/migrations/20260928020000_asignar_roles.sql))
no son políticas RLS, pero cumplen el mismo propósito para la asignación de
roles: `execute` revocado a `public` y `anon`, otorgado solo a `authenticated`,
y el rol de quien llama se verifica dentro de la función. Probado en vivo
contra el proyecto remoto (seis casos: autoascenso, degradar a otro sin ser
superusuario, autodegradación, asignación válida con su registro en
auditoría, `listar_perfiles` con y sin el rol, y sin sesión).

**Pendiente de probar en vivo:** que los triggers de `auditoria` bloqueen
`update`, `delete` y `truncate` incluso para `service_role` (regla 7). El
código está escrito para eso, pero a diferencia de `asignar_rol` nunca se
ejecutó la prueba contra el proyecto remoto.

## Pendiente, fuera de esta entrega

- **Fecha de nacimiento:** no se recolecta todavía. Sigue pendiente la decisión
  sobre usuarios menores de edad (ver `CLAUDE.md`); hasta que se resuelva, no
  se agrega esta columna.
- **Este documento no cubre infraestructura** (backups, logs de Azure
  Pipelines, acceso al panel de Supabase). Es un control aparte, no de datos
  de la aplicación.
- **No hay una tabla de "solicitudes de eliminación" (derecho ARCO).** Hoy
  borrar la cuenta en Supabase Auth arrastra por cascada perfil, inventario y
  mazos; la auditoría queda con `usuario_id` huérfano a propósito. Si la Ley
  21.719 exige un flujo formal de solicitud y respuesta, es un PBI aparte.
