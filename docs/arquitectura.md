# Arquitectura

## Las tres capas

```
Navegador ──► Next.js (servidor) ──► Supabase (PostgreSQL + Auth + Storage)
 interfaz       Server Actions          RLS, triggers y funciones SQL
                y rutas, lib/*.ts       (la última palabra en seguridad)
```

| Capa | Dónde vive | Responsabilidad |
|---|---|---|
| Interfaz | `app/` (páginas) y `components/` | Dibujar y recoger datos. Nada de lo que decide el navegador se da por bueno. |
| Aplicación | `app/**/acciones.ts`, rutas `route.ts` y `lib/` | Validar la entrada con zod, comprobar la sesión y delegar en la base. |
| Datos | `supabase/migrations/` | RLS, restricciones, triggers y funciones SQL: las reglas que nadie puede saltarse llamando directo a la Data API. |

El control de acceso real está en la última capa. Ocultar un botón o redirigir en una página es comodidad; lo que protege es RLS y la verificación de rol dentro de las funciones SQL (regla 6).

## Patrón del código

- **Acciones delgadas.** Una Server Action o ruta solo lee el formulario y llama a una función de `lib/`. Una Server Action es un endpoint público: se asume que recibe datos arbitrarios.
- **Validar antes de consultar.** Toda función exportada de `lib/` que recibe `entrada: unknown` hace `esquema.safeParse(entrada)` antes de cualquier `.from()`. Una regla Semgrep propia lo exige en el pipeline.
- **Supabase solo desde `lib/`.** Ni páginas ni componentes importan el cliente de Supabase.
- **Lógica pura aparte.** Las reglas que se pueden probar sin base (`lib/reglas-mazo.ts`, `lib/resumen.ts`, `lib/csv.ts`, `lib/proxies.ts`) viven separadas de los módulos con `server-only`.
- **Resultado explícito.** Las funciones devuelven `{ ok: true, datos } | { ok: false, error }`. Los errores inesperados se registran en el servidor y el usuario ve un mensaje genérico.
- **Dos paginaciones distintas.** El catálogo pagina de 30 en 30; el binder usa cuadrículas de 2x2, 3x3, 3x4 y 4x4. No comparten componente.

## Modelo de datos

```
auth.users 1──1 perfiles 1──* inventario *──1 cartas *──1 sets
                  │  │              ▲
                  │  ├──* mazos 1──* mazo_cartas *──1 cartas
                  │  ├──* binders 1──* binder_casillas ──► inventario
                  │  └──* categorias_coleccion 1──* categoria_cartas ──► inventario
                  └ auditoria (solo inserción, sin clave foránea al usuario)
```

| Tabla | Contenido | Acceso |
|---|---|---|
| `sets`, `cartas` | Catálogo (~95.000 cartas en `en`, `es`, `fr`, `pt`, `ja`, `zh`). Clave natural `(id_api, idioma)`. | Lectura pública; escribe solo `service_role` (ingesta). |
| `perfiles` | Un perfil por usuario: nombre visible y rol (`superusuario`, `administrador`, `usuario_normal`). | Cada usuario lee el suyo. El rol solo cambia con `asignar_rol`. |
| `inventario` | Cartas del usuario: variante y cantidad (1–9999). Única por `(usuario, carta, variante)`. | RLS por `usuario_id` con `using` y `with check`. |
| `mazos`, `mazo_cartas` | Mazos y sus líneas (1–60 copias). | RLS por usuario, también en las líneas. |
| `binders`, `binder_casillas` | Binder (cuadrícula fija, 1–100 páginas) y casillas que apuntan a una copia del inventario. La clave `(binder, página, posición)` impide dos cartas en una casilla. | RLS por usuario; triggers limitan las copias colocadas a las poseídas. |
| `categorias_coleccion`, `categoria_cartas` | Categorías propias de la colección («Mis Sylveon», máx. 100 por usuario, nombre único sin distinguir mayúsculas) y qué filas del inventario contiene cada una. Una carta puede estar en varias. | RLS por usuario; `with check` exige que categoría e inventario sean del mismo usuario. |
| `auditoria` | Bitácora: quién, cuándo, qué acción, sobre qué registro. | Solo inserción: un trigger bloquea `update` y `delete`. La lee únicamente un superusuario, vía `listar_auditoria`. |

Storage tiene dos buckets privados: `Images` (imágenes WebP del catálogo, ~15 KB c/u) y `Assets`. Sin políticas de acceso: el navegador recibe URLs firmadas con vencimiento generadas en el servidor.

## Funciones SQL expuestas

| Función | Quién puede llamarla |
|---|---|
| `asignar_rol(usuario, rol)` | Solo superusuario; nadie cambia el propio rol; siempre queda al menos un superusuario. |
| `listar_perfiles()` | Solo superusuario; deja registro en la bitácora. |
| `listar_auditoria(...)` | Solo superusuario. |
| `catalogo_filtros()` | Cualquiera: opciones para filtrar el catálogo. |

Son `security definer` con `search_path` vacío; verifican a quien llama con `auth.uid()` dentro de la propia función.

## Proxies en PDF

`lib/proxies-pdf.ts` genera el PDF siempre en el servidor (regla 8): hojas A4 con 3×3 cartas de 63 × 88 mm exactos y marcas de corte. Cada imagen pasa por `sharp`, que la recodifica a PNG con tope de píxeles, antes de incrustarla con `pdf-lib`. Las imágenes del bucket solo se descargan desde el propio host de Supabase, sin seguir redirecciones.

## Más información

- Controles de seguridad y RLS por tabla: [seguridad.md](seguridad.md)
- Pipeline y etapas: [cicd.md](cicd.md) y [pipelines.md](pipelines.md)
- Alineación con ISO/IEC 27001: [iso27001.md](iso27001.md)
