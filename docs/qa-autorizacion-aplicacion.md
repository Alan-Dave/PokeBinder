# Revisión de autorización en la capa de aplicación (PBI-27 · PBI-X28)

Revisión del 11 de noviembre de 2026 **leyendo el código** (no es una prueba con dos
cuentas reales en el navegador: esa sigue pendiente, ver el final). Complementa la
prueba SQL `supabase/tests/aislamiento_entre_usuarios.test.sql`, que verificó la capa
de base de datos.

## Método

La regla 6 del proyecto exige que el rol y la sesión se verifiquen en el servidor.
Se revisó cada punto de entrada de datos: los 12 archivos de Server Actions (`"use server"`),
las 6 rutas `route.ts` y las 46 funciones exportadas de 15 módulos de `lib/` que
leen o escriben datos. Para cada una: ¿exige sesión?, ¿valida la entrada con zod?,
¿qué decide a quién pertenece el dato?

## Resultado

| Punto de entrada | Sesión / rol | Entrada | Quién acota los datos |
|---|---|---|---|
| Acciones de colección, mazos, binders, categorías, reportes | Cada función de `lib/` empieza con `auth.getUser()`; sin sesión devuelve «Se requiere una sesión iniciada» | zod con `safeParse` antes de cualquier consulta | RLS (`usuario_id = auth.uid()`), no el filtro de la aplicación |
| Administración de usuarios | `asignar_rol` y `listar_perfiles` son funciones SQL que verifican el rol de quien llama | zod | La función SQL (solo superusuario) |
| Administración de reportes | Las políticas de RLS solo dejan cambiar el estado a administradores y superusuarios | zod | RLS y privilegio por columna (`estado`) |
| `/coleccion/exportar`, `/reportes/exportar` | Responden 401 sin sesión | zod sobre los filtros | RLS |
| `/mazos/[id]/proxies` | Usa `obtenerMazo`, que exige sesión; el PDF se genera en el servidor | id numérico validado | RLS: el mazo de otro usuario «no existe» |
| `/api/coleccion/panel` | 401 sin sesión | zod; límite de peticiones | RLS |
| `/api/cartas/[id]/imagen-hd` | Pública a propósito (el catálogo es de lectura abierta) | id numérico y tamaño validados; solo sale a un host fijo | Límite de 240 peticiones por minuto por IP y cortafuegos de Vercel |
| `/auth/callback` | Canjea un código de un solo uso | código validado; destino de la redirección fijo | Supabase Auth |

Tres funciones sin comprobación de sesión propia, revisadas una por una:

| Función | Por qué es correcta |
|---|---|
| `obtenerLegalidadMazo` | Llama a `obtenerMazo`, que valida la sesión; RLS limita el mazo al usuario |
| `obtenerDashboard` | Llama a `obtenerResumenInventario`, que valida sesión; el resto solo cuenta cartas del catálogo público |
| `registrarPrecios` | Es `server-only`, no es una acción ni una ruta: solo la llaman páginas del servidor con ids que entregó la base. Ver hallazgo F6 |

Ningún dato del usuario se arma concatenando texto (regla 5) ni se confía en un `id`
de usuario enviado por el navegador: las inserciones toman `auth.uid()` por defecto
en la columna `usuario_id` y RLS lo exige con `with check`.

## Hallazgo F6: la ficha pública de una carta escribía con la clave de servicio

| | |
|---|---|
| **Qué pasaba** | `/catalogo/[id]` es pública y, al abrirse, llamaba a `registrarPrecios`, que escribe en `precios_historial` con `service_role` (única forma, porque RLS impide escribir a los usuarios). Cualquier visitante sin sesión provocaba una escritura |
| **Riesgo** | Un rastreador que recorra las ~95.000 fichas podría crear hasta una fila por carta, acabado y día, y llenar la tabla del plan gratuito de Supabase, además de forzar consultas a TCGdex. Severidad **baja a media**: acotado por la clave primaria `(carta, acabado, fecha)` y por el cortafuegos de Vercel, pero evitable |
| **Corrección** | `app/catalogo/[id]/page.tsx` solo registra el precio si hay sesión. Quien tiene la carta igual la registra al abrir Mi colección, que es lo que alimenta el gráfico de evolución |
| **Efecto** | La historia de precios deja de crecer por visitas anónimas al catálogo; el gráfico de evolución del valor no cambia, porque solo muestra cartas del inventario del usuario |

## Pendiente (necesita personas y navegador)

La prueba de las tarjetas AB#95 (X28) con **dos cuentas reales**: cambiar ids en la
URL, reenviar peticiones desde la pestaña Red y probar `/admin/*` con una cuenta normal.
La lista de pasos está en la tarjeta y en la conversación del equipo.
