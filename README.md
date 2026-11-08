# PokeBinder — TCG Inventory

Plataforma web para gestionar colecciones físicas de Pokémon TCG: catálogo de ~95.000 cartas en seis idiomas, inventario personal, binder virtual, constructor de mazos y proxies imprimibles.

Proyecto académico (INACAP) del equipo **DevSecure**, desarrollado bajo criterios de **desarrollo seguro**: la seguridad es el eje del proyecto, no un extra.

- **Gestión:** Azure DevOps — `dev.azure.com/devsecure/PokeBinder`
- **Repositorio:** GitHub — `github.com/Alan-Dave/PokeBinder`
- **Equipo:** Macarena (backend, base de datos, seguridad, infraestructura) · Alan (frontend, binder, deckbuilder, reportes)

## Qué hace

| Función | Descripción | PBI |
|---|---|---|
| Registro e inicio de sesión | Supabase Auth; el rol nunca viaja desde el cliente. | 06, 07 |
| Catálogo | Búsqueda y filtros sobre 95.000 cartas, paginado de 30 en 30, ficha con zoom e inclinación. | 09, 10 |
| Inventario | Cartas que posee cada usuario, con variante, cantidad y precio. Exportación a CSV y Excel. | 12, 13, 22 |
| Binder virtual | Cuadrículas de 2x2, 3x3, 3x4 y 4x4; colocar, mover (arrastrar y soltar) y quitar cartas. | 14, 15 |
| Mazos | Constructor con validación de reglas y cruce contra el inventario. | 16, 17 |
| Proxies | PDF de un mazo, generado en el servidor, cartas de 63 × 88 mm, 9 por hoja A4. | 20 |
| Reportes | Resumen del inventario y faltantes por set, con filtros y exportación. | 21, 24 |
| Administración | Panel de usuarios y roles del Superusuario y bitácora de auditoría. | 25 |

## Stack

| Capa | Tecnología |
|---|---|
| Aplicación | Next.js 16 (App Router) · React 19 · TypeScript 5 |
| Estilos | Tailwind CSS 4 |
| Base de datos y auth | Supabase (PostgreSQL 15+, RLS) |
| Validación | zod |
| Arrastrar y soltar | @dnd-kit |
| PDF de proxies | pdf-lib + sharp |
| Exportación | exceljs (XLSX) y CSV propio |
| Pruebas | Vitest |
| Ingesta del catálogo | Python 3.10+ (proceso separado, fuera de la app) |

## Ejecutar en local

Requisitos: Node 22 LTS y un proyecto de Supabase con las migraciones aplicadas (ver [docs/despliegue.md](docs/despliegue.md)).

```bash
npm install
cp .env.example .env.local   # completa los valores desde el panel de Supabase
npm run dev                  # http://localhost:3000
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Desarrollo local. |
| `npm run build` | Compila; falla con errores de TypeScript. |
| `npm run test` | Pruebas con Vitest. |
| `npm run test:ci` | Pruebas con cobertura (umbral 90/90/90/85) e informe JUnit. |
| `npm run lint` | ESLint, sin advertencias permitidas. |

### Variables de entorno

| Variable | Dónde puede llegar | Nota |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Navegador | URL del proyecto. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Navegador | Clave pública; RLS limita lo que permite. |
| `SUPABASE_SECRET_KEY` | **Solo servidor** | Se salta RLS. Nunca con prefijo `NEXT_PUBLIC_`; la app se niega a arrancar si detecta una clave secreta en una variable pública. |

Nunca se escriben valores reales en archivos versionados. `.env.local` está ignorado por git.

## Estructura

```
/app              rutas y páginas de Next.js (Server Actions en acciones.ts)
/components       componentes de interfaz
/lib              lógica compartida, cliente de Supabase, reglas de negocio
/lib/validators   esquemas zod de validación de entrada
/supabase         migraciones SQL y políticas RLS
/ingesta          scripts Python del catálogo (proceso separado)
/docs             documentación del proyecto
```

La arquitectura y el modelo de datos están en [docs/arquitectura.md](docs/arquitectura.md).

## Seguridad

Reglas no negociables, derivadas del documento de aseguramiento técnico y de la Ley 21.719:

1. Ningún secreto en el código: las credenciales vienen de variables de entorno.
2. La clave `service_role` jamás llega al navegador.
3. Toda tabla con datos de usuario tiene RLS con política `using` **y** `with check`.
4. Toda entrada se valida con zod en el límite de la aplicación, antes de la lógica de negocio.
5. Ninguna consulta se arma concatenando texto del usuario.
6. El rol se verifica en el servidor y en la base, no solo en la interfaz.
7. La bitácora de auditoría es de solo inserción.
8. El PDF de proxies se genera en el servidor con dimensiones fijas de 63 × 88 mm.

El pipeline ejecuta en cada PR: escaneo de secretos (gitleaks), dependencias vulnerables (`npm audit`), análisis estático (ESLint y Semgrep con reglas propias), pruebas y compilación. Detalle en [docs/cicd.md](docs/cicd.md) y [docs/seguridad.md](docs/seguridad.md).

## Roles

| Rol | Puede |
|---|---|
| Usuario Normal | Gestionar su propio inventario, binders y mazos. |
| Administrador | Lo anterior, con la gestión que defina RT-02. |
| Superusuario | Asignar roles, listar usuarios y consultar la bitácora de auditoría. |

La asignación de roles vive en funciones SQL (`asignar_rol`, `listar_perfiles`) que verifican al llamante en la base: nadie cambia su propio rol y el sistema siempre conserva al menos un Superusuario.

## Flujo de trabajo

Una rama por tarjeta (`feature/PBI-XX-descripcion`) desde `develop`, commits `PBI-XX: qué hace AB#<id>` y Pull Request obligatorio con aprobación del otro integrante. Ver [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentación

| Documento | Contenido |
|---|---|
| [docs/arquitectura.md](docs/arquitectura.md) | Las tres capas, el patrón del código y el modelo de datos. |
| [docs/despliegue.md](docs/despliegue.md) | Puesta en producción: Supabase, variables de entorno, Azure App Service y lista de comprobación. |
| [docs/seguridad.md](docs/seguridad.md) | Clasificación de datos críticos y políticas RLS por tabla. |
| [docs/cicd.md](docs/cicd.md) | Pipeline, reglas SAST propias y activación del despliegue. |
| [docs/pipelines.md](docs/pipelines.md) | Resumen de las etapas del pipeline. |
| [docs/iso27001.md](docs/iso27001.md) | Adopción proporcional de ISO/IEC 27001:2022. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Convenciones de ramas, commits y Pull Requests. |

## Notas operativas

- **El catálogo se migra, no se descarga:** las 95.000 cartas salen de `PokeDatabase.db` (SQLite) hacia PostgreSQL con los scripts de `/ingesta`. Ese archivo y los scripts son el respaldo: no hay respaldos automáticos.
- **Supabase gratuito** se pausa tras 7 días sin actividad; una tarea programada lo evita.
- **Menores de edad:** decisión pendiente; la aplicación no recolecta fecha de nacimiento.
