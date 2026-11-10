# Pipelines

Pipeline de integración continua definido en `azure-pipelines.yml`.

## Cuándo se ejecuta

- En cada Pull Request hacia `develop` o `main`.
- En cada push a `develop` o `main`.

Si un paso falla, el pipeline queda en rojo y el PR no debe fusionarse.

## Herramientas por etapa

Las etapas corren en este orden. Los secretos van primero porque es lo más barato de revisar y lo más grave.

| Etapa | Herramienta | Origen |
|---|---|---|
| Entorno | Node.js 22 (`NodeTool@0`) y Python 3.11 (`UsePythonVersion@0`) | Tareas de Azure Pipelines |
| Escaneo de secretos | gitleaks 8.24.0 (`gitleaks git --redact`) | Binario oficial de GitHub Releases, con suma SHA-256 verificada |
| Instalación | `npm ci` | Incluido en npm |
| Dependencias vulnerables | `npm audit --audit-level=high` | Incluido en npm |
| | `pip-audit` 2.7.3 sobre `ingesta/requirements.txt` | Paquete de PyPA (Python) |
| Análisis estático | ESLint (`npm run lint`, cero advertencias) | Configurado en el proyecto |
| Pruebas | Vitest (`npm run test`) | Configurado en el proyecto |
| | `python -m unittest discover ingesta` | Incluido en Python |
| Compilación | Next.js (`npm run build`) | Configurado en el proyecto |

### Detalles que importan

- **Node 22 exacto.** `package.json` exige `>=22 <23` y `.npmrc` tiene `engine-strict`; otra versión hace fallar `npm ci`.
- **gitleaks revisa todo el historial** (`fetchDepth: 0`). Un secreto borrado en un commit posterior sigue expuesto. `--redact` evita que un hallazgo quede impreso en el log.
- **Falsos positivos** revisados se registran en `.gitleaksignore`, uno por huella, con el motivo en un comentario.
- **`npm audit` falla** ante severidad alta o crítica.
- **Versiones de gitleaks y pip-audit fijadas** en `variables` del YAML, como control de cadena de suministro.

## Configuración en Azure DevOps

- Variables del pipeline (ninguna secreta): `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Solo las usa el paso de compilación.
- La clave secreta de Supabase (`SUPABASE_SECRET_KEY`) **no** entra al pipeline.
- Conexión de servicio (service connection) con GitHub, autorizada por el dueño del repositorio.

## Responsables

- Macarena: pipeline, herramientas de seguridad y variables.
- Alan: conectar Azure Pipelines al repositorio (es el dueño en GitHub) y revisar el PR.

## Costo

Sin costo: agente hospedado gratuito y herramientas open source.
