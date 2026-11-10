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
                                              └──* precios_historial
                  │  │              ▲
                  │  ├──* mazos 1──* mazo_cartas *──1 cartas
                  │  ├──* binders 1──* binder_casillas ──► inventario
                  │  ├──* categorias_coleccion 1──* categoria_cartas ──► inventario
                  │  └──* reportes_catalogo *──1 cartas
                  └ auditoria (solo inserción, sin clave foránea al usuario)
```

| Tabla | Contenido | Acceso |
|---|---|---|
| `sets`, `cartas` | Catálogo (~95.000 cartas en `en`, `es`, `fr`, `pt`, `ja`, `zh`). Clave natural `(id_api, idioma)`. Además de nombre, tipo, rareza y variantes, cada carta trae `categoria` (`Pokemon`, `Trainer`, `Energy`) y, en las energías, `energia_basica` (ver [Categoría de las cartas](#categoría-de-las-cartas)). | Lectura pública; escribe solo `service_role` (ingesta). |
| `perfiles` | Un perfil por usuario: nombre visible y rol (`superusuario`, `administrador`, `usuario_normal`). | Cada usuario lee el suyo. El rol solo cambia con `asignar_rol`. |
| `inventario` | Cartas del usuario: variante y cantidad (1–9999). Única por `(usuario, carta, variante)`. | RLS por `usuario_id` con `using` y `with check`. |
| `mazos`, `mazo_cartas` | Mazos y sus líneas (1–60 copias). | RLS por usuario, también en las líneas. |
| `binders`, `binder_casillas` | Binder (cuadrícula fija, 1–100 páginas) y casillas que apuntan a una copia del inventario. La clave `(binder, página, posición)` impide dos cartas en una casilla. | RLS por usuario; triggers limitan las copias colocadas a las poseídas. |
| `categorias_coleccion`, `categoria_cartas` | Categorías propias de la colección («Mis Sylveon», máx. 100 por usuario, nombre único sin distinguir mayúsculas) y qué filas del inventario contiene cada una. Una carta puede estar en varias. | RLS por usuario; `with check` exige que categoría e inventario sean del mismo usuario. |
| `precios_historial` | Un precio de mercado por carta, acabado y día, para el gráfico de evolución del valor. Solo precios; nada personal. | Sin política de escritura: solo el servidor la llena, con `service_role`. |
| `reportes_catalogo` | Errores del catálogo que informa un usuario (nombre, imagen, número, rareza, variantes u otro). Máximo 20 por usuario cada 24 horas; un reporte abierto por carta y motivo. | Cada usuario crea y ve los suyos; administradores y superusuarios ven todos y solo pueden cambiar `estado`. Nadie borra por la API. |
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

## Categoría de las cartas

El catálogo migrado no traía la categoría de la mayoría de las cartas, y sin ella las reglas de mazo no pueden saber qué es una energía básica ni qué carta puede ser un Pokémon Básico. Dos columnas nuevas (migración `20261108140000_categoria_cartas.sql`, con su prueba en `supabase/tests/`):

| Columna | Valores | Restricción |
|---|---|---|
| `cartas.categoria` | `Pokemon`, `Trainer`, `Energy`; `null` si aún no se completó | `check` por lista de valores |
| `cartas.energia_basica` | `true` básica, `false` especial; `null` si no es energía | `check`: solo puede tener valor si `categoria = 'Energy'` |

`ingesta/completar_categorias.py` las llena consultando TCGdex (fuente externa, no se infiere por el nombre). Es un proceso aparte de la aplicación: se ejecuta a mano, admite `--dry-run`, reintenta ante errores 503, no escribe si clasifica menos de la mitad del catálogo y lee la conexión de `SUPABASE_DB_URL` pidiendo la contraseña sin eco. Prueba cuatro idiomas (`en`, `ja`, `zh-tw`, `zh-cn`) y traduce los identificadores propios a los de TCGdex (relleno a 3 dígitos, `sv4pt5` → `sv04.5`, y una tabla de sets sueltos comprobados). Lo que TCGdex no tiene queda en `null` y se informa; no se inventa. Resultado actual: ~98 % del catálogo con categoría. Los pendientes y su motivo están en [pendiente-categoria-cartas.md](pendiente-categoria-cartas.md).

## Reglas del mazo

`lib/reglas-mazo.ts` (lógica pura, sin base de datos) valida un mazo según las reglas oficiales: 60 cartas, máximo 4 copias por nombre (las energías básicas no tienen límite), una carta ACE SPEC, una Radiant y al menos un Pokémon Básico. **No** limita cuántas Energías ni Partidarios lleva. Distingue dos resultados:

- **Errores**: incumplimientos comprobados (de más, repetidas, prohibidas). El mazo no es válido mientras haya alguno.
- **Advertencias**: lo que no se pudo comprobar porque a una carta le falta categoría o etapa. El aviso nombra las cartas (hasta tres y «y N más»). Una advertencia nunca cuenta como aprobado.

Un mazo con menos de 60 cartas no es un error del usuario sino un mazo a medio armar: `separarProgreso` lo muestra como contador («N de 60 cartas · te faltan M cartas») y deja la lista en rojo solo para errores reales.

## Imágenes de cartas

Solo ~22 % del catálogo tiene imagen en el bucket `Images`. Cada imagen se resuelve en este orden:

1. **Bucket**: URL firmada con vencimiento, generada en el servidor (`lib/imagenes.ts`, la única que usa la clave de servicio para esto).
2. **TCGdex**: miniatura que sirve `/api/cartas/[id]/imagen-hd?tam=min`. El navegador solo envía el id numérico, nunca una URL; el servidor fija el host, limita tiempo y tamaño, guarda una caché temporal y limita las peticiones por IP.
3. **Ilustración «Imagen no disponible»** (`public/imagen-no-disponible.webp`, 630×880): se muestra si no hay imagen o ninguna carga. La usan el catálogo, Mi colección, el binder, el mazo y el visor.

Un detalle del cliente: las `<img>` llegan dibujadas desde el servidor y, si una falla antes de que React termine de cargar, el evento `onError` ya pasó. `components/useImagenFallida.ts` revisa el estado de la imagen al montar para no perder ese fallo y mostrar igualmente la ilustración.

## Proxies en PDF

`lib/proxies-pdf.ts` genera el PDF siempre en el servidor (regla 8): hojas A4 con 3×3 cartas de 63 × 88 mm exactos y marcas de corte. Cada imagen pasa por `sharp`, que la recodifica a PNG con tope de píxeles, antes de incrustarla con `pdf-lib`. Las imágenes del bucket solo se descargan desde el propio host de Supabase, sin seguir redirecciones. Una carta sin imagen no deja un hueco: se dibuja la ilustración «Imagen no disponible» (incrustada en base64 en `lib/imagen-no-disponible-datos.ts`, para no depender de `public/` en Vercel) con el nombre de la carta, y si ni eso es posible, un marcador de texto. El nombre se escribe en inglés cuando existe (`nombreParaProxy`), porque la fuente estándar del PDF no cubre kanji ni hanzi.

## Cabeceras de seguridad y CSP

`proxy.ts` renueva la sesión de Supabase en cada petición y genera la política de contenido (`lib/csp.ts`) con un nonce nuevo por petición: `script-src 'self' 'nonce-…' 'strict-dynamic'`, sin `unsafe-inline` en scripts. Solo se admiten recursos del propio sitio y las imágenes firmadas del bucket; se prohíben iframes, `<base>` ajeno y formularios hacia otros sitios. Queda `style-src 'unsafe-inline'` por Tailwind. Todas las páginas se renderizan al pedirse (`connection()` en el layout) porque el nonce cambia en cada respuesta. La verificación está en [qa-seguridad.md](qa-seguridad.md).

## Más información

- Controles de seguridad y RLS por tabla: [seguridad.md](seguridad.md)
- QA y pruebas de seguridad (incluido el aislamiento entre usuarios): [qa-seguridad.md](qa-seguridad.md)
- Pipeline y etapas: [cicd.md](cicd.md) y [pipelines.md](pipelines.md)
- Alineación con ISO/IEC 27001: [iso27001.md](iso27001.md)
