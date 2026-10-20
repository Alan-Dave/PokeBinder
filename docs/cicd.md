# CI/CD y Desarrollo Seguro

Prueba real del pipeline de PokeBinder: qué funcionalidades se validan, qué
controla cada etapa y cómo se demuestra con un cambio **con errores** y otro
**sin errores**, todo automatizado en Azure Pipelines.

## 1. Funcionalidades representativas

Se eligió el **binder (inventario)** porque recorre todas las capas: formulario
en el navegador, Server Action, validación con zod, consulta a Supabase y RLS.

| # | Funcionalidad | Criterio de aceptación (100 % verificable) | Dónde se prueba |
|---|---|---|---|
| F1 | Agregar carta al inventario | Entrada válida → se inserta solo `carta_id`, `variante`, `cantidad`. `usuario_id` nunca viaja desde la app (lo pone `auth.uid()`) | `lib/inventario.test.ts`, `app/coleccion/acciones.test.ts` |
| F2 | Listar inventario | Paginado de 30 en 30; página inválida se rechaza | `lib/inventario.test.ts` |
| F3 | Cambiar cantidad | Entero entre 1 y 9999; fuera de rango no llega a la base | `lib/inventario.test.ts`, `app/coleccion/acciones.test.ts` |
| F4 | Eliminar del inventario | Id entero positivo; si no existe o es ajeno, el mismo mensaje (no revela ids ajenos) | `lib/inventario.test.ts` |
| F5 | Sesión obligatoria | Sin sesión → `Se requiere una sesión iniciada.` y ninguna consulta | `lib/inventario.test.ts` |
| F6 | Errores sin filtrar detalles | Códigos esperados de Postgres → mensaje en español; cualquier otro → mensaje genérico (el detalle solo va al log del servidor) | `lib/inventario.test.ts` |
| F7 | Búsqueda en el catálogo | Texto ≤ 50, idioma del catálogo cerrado, comodines de `LIKE` escapados | `lib/validators/catalogo.test.ts` |
| F8 | Registro, inicio y cierre de sesión | Correo normalizado; contraseña de 12 a 72 caracteres; un `rol` enviado en el formulario se ignora; mismo mensaje si el correo ya existe; el log no lleva correo ni contraseña | `lib/validators/auth.test.ts`, `app/registro/acciones.test.ts`, `app/login/acciones.test.ts`, `app/auth/acciones.test.ts` |

### Validaciones por capa

| Capa | Validación | Por qué no basta sola |
|---|---|---|
| **Frontend** (`components/FilaColeccion.tsx`, `AgregarAlInventario.tsx`) | `type="number"`, `min`, `max`, `step=1`, `required` en los inputs | Es solo UX: un atacante envía el formulario sin el navegador |
| **Server Action** (`app/*/acciones.ts`) | Ninguna propia: delega en `lib/` | Es un endpoint público: recibe cualquier `FormData` |
| **Backend** (`lib/inventario.ts` + `lib/validators/*`) | `schema.safeParse(entrada)` **antes** de crear el cliente de Supabase | — Es la validación que manda |
| **Base de datos** | `check` de cantidad, trigger de variantes, RLS `using` + `with check` | Última barrera si la app tuviera un bug |

`app/coleccion/acciones.test.ts` envía lo que mandaría un formulario
manipulado (`cantidad=abc`, `-5`, `1.5`, `10000`, `id=1 OR 1=1`) y comprueba que
ninguno llega a la base.

## 2. Pipeline (`azure-pipelines.yml`)

```
PR o push a develop / main
        │
        ▼
┌──────────────────────── CI (jobs en paralelo) ────────────────────────┐
│ Secretos      gitleaks sobre el historial de HEAD (binario verificado) │
│ Dependencias  npm audit (prod, ≥ high) · pip-audit (ingesta)           │
│ Lint          ESLint, 0 advertencias                                   │
│ SAST          Semgrep: reglas propias + typescript/react/nextjs/OWASP  │
│ Pruebas       Vitest + cobertura mínima · unittest de la ingesta       │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ solo si los cinco pasan
                                ▼
          Build: next build → artefacto zip (solo dependencias de producción)
                                │ solo en main, nunca en un PR
                                ▼
          Deploy: Azure App Service → prueba de humo en /estado
```

### Gates y qué detectan

| Job | Herramienta | Falla cuando |
|---|---|---|
| Secretos | gitleaks | Hay una credencial en cualquier commit del historial de la rama (`--log-opts=HEAD`: un secreto en otra rama no contamina este build) |
| Dependencias | npm audit, pip-audit | Una dependencia de producción tiene una vulnerabilidad alta o crítica |
| Lint | ESLint | Hay un error o una advertencia |
| SAST | Semgrep | Cualquier hallazgo (`--error`) |
| Pruebas | Vitest | Falla una prueba o la cobertura baja de 90 % líneas/funciones/sentencias, 85 % ramas |
| Build | `next build` | Error de TypeScript o variables de entorno inválidas (esquema zod) |
| Deploy | curl | `/estado` no responde "Base de datos: conectada" tras el despliegue |

### Reglas SAST propias (`.semgrep/pokebinder.yml`)

Llevan a verificación automática las reglas que hasta ahora solo estaban en
`docs/seguridad.md` y en los comentarios del código:

| Regla | Qué impide | CWE |
|---|---|---|
| `pokebinder-consulta-sin-validar` | Una función de `lib/` con `entrada: unknown` que consulta Supabase sin `safeParse` previo | CWE-20 |
| `pokebinder-supabase-fuera-de-lib` | Que una página, Server Action o componente importe el cliente de Supabase | CWE-20 |
| `pokebinder-cliente-admin-acotado` | Usar `createAdminClient()` (salta RLS) fuera de `lib/imagenes.ts` | CWE-250 |
| `pokebinder-secreto-en-variable-publica` | Leer un secreto desde una variable `NEXT_PUBLIC_*` | CWE-200 |
| `pokebinder-html-sin-escapar` | `dangerouslySetInnerHTML`, `innerHTML`, `document.write` | CWE-79 |
| `pokebinder-ejecucion-dinamica` | `eval`, `new Function` | CWE-95 |

Ejecución local (requiere `pip install semgrep`):

```bash
semgrep scan --config .semgrep/ --error --metrics=off
npm run test:ci   # pruebas + cobertura + junit-results.xml
```

## 3. Demostración: con errores vs. sin errores

| PR hacia `develop` | Resultado esperado |
|---|---|
| **Sin errores**: el pipeline y las pruebas de este documento | Los cinco jobs de CI en verde → Build en verde |
| **Con errores**: el mismo código + cambios inseguros a propósito | CI en rojo; Build no se ejecuta; el PR no se puede fusionar |

Errores intencionales del PR con errores y qué control los detecta:

| Cambio inseguro | Lo detecta |
|---|---|
| Se quita el máximo de `cantidad` en el validador | Pruebas (Vitest) |
| `eliminarDelInventario` consulta sin validar la entrada | SAST (`pokebinder-consulta-sin-validar`) + Pruebas |
| El nombre de la carta se renderiza con `dangerouslySetInnerHTML` | SAST (`pokebinder-html-sin-escapar`) |
| Una clave de API escrita en el código | Secretos (gitleaks) |

Para que el rojo **bloquee** de verdad la fusión, en GitHub → *Settings →
Branches* la regla de `develop` debe exigir el check de Azure Pipelines
(*Require status checks to pass before merging*).

## 4. Activar el despliegue (CD)

La etapa Deploy está apagada (`enableDeploy: 'false'`) para que el pipeline
funcione sin una suscripción de Azure. Para activarla:

1. Crear un **App Service** Linux con runtime **Node 22 LTS**; su nombre va en
   `webAppName`.
2. En el App Service → *Configuration*, cargar `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY` (esta última
   solo ahí: nunca en el pipeline ni en el repositorio).
3. En Azure DevOps → *Project settings → Service connections*, crear una de
   tipo **Azure Resource Manager** llamada `pokebinder-azure`.
4. En *Pipelines → Environments*, crear `pokebinder-prod` y agregarle
   *Approvals* para exigir aprobación manual antes de producción.
5. Cambiar `enableDeploy` a `'true'`.

Mejora pendiente: `output: "standalone"` en `next.config.ts` reduciría el
artefacto (hoy ~500 MB por `node_modules` de producción) a una fracción.
