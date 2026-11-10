# Despliegue a producción

Guía para publicar PokeBinder. La aplicación corre en **Azure App Service** (Node 22 LTS) y usa **Supabase** como base de datos, autenticación y almacenamiento. El pipeline de CI/CD se explica en [cicd.md](cicd.md).

> Esta guía describe el procedimiento; no lo ejecuta. Crear el App Service y el Service Connection se hace en el portal de Azure con una cuenta que tenga permisos.

## 1. Supabase

1. Crear el proyecto (PostgreSQL 15+).
2. Aplicar las migraciones de `supabase/migrations/` **en orden de nombre** (el prefijo es la fecha). Crean tablas, RLS, triggers, funciones y los buckets `Images` y `Assets`.
3. Migrar el catálogo desde `PokeDatabase.db` con los scripts de `ingesta/` (`migrar_catalogo.py`, luego `emparejar_imagenes.py` y `subir_imagenes.py`). Las imágenes son ~300 MB: caben en Storage.
4. Registrar la primera cuenta desde la aplicación y promoverla a superusuario **desde el editor SQL de Supabase** (la aplicación no puede crear al primero, y es lo esperado):

   ```sql
   update public.perfiles set rol = 'superusuario' where id = '<uuid del usuario>';
   ```

   El trigger lo deja en la bitácora con usuario vacío (cambio hecho desde consola).
5. Comprobar que toda tabla con datos de usuario tiene RLS activada (`inventario`, `mazos`, `mazo_cartas`, `binders`, `binder_casillas`, `perfiles`, `auditoria`).

Nunca se aplican migraciones de prueba ni se escriben datos de prueba en el proyecto de producción.

## 2. Variables de entorno

Se cargan en el App Service → *Settings → Environment variables*. No van en el repositorio ni en el pipeline.

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable. |
| `SUPABASE_SECRET_KEY` | Clave secreta (`service_role`). Solo en el servidor. |

`NEXT_PUBLIC_*` se incrusta en el JavaScript al **compilar**: si cambia la URL o la clave publicable, hay que volver a compilar. La clave secreta se lee en tiempo de ejecución y la aplicación se niega a arrancar si aparece en una variable pública.

## 3. Azure App Service y pipeline

1. Crear un App Service Linux con runtime **Node 22 LTS**. Su nombre va en `webAppName` de `azure-pipelines.yml`.
2. En Azure DevOps → *Project settings → Service connections*, crear una de tipo **Azure Resource Manager** llamada `pokebinder-azure`.
3. En *Pipelines → Environments*, crear `pokebinder-prod` y agregar *Approvals*: producción exige aprobación manual.
4. Cambiar `enableDeploy` a `'true'` en `azure-pipelines.yml` (mediante PR, como cualquier cambio).
5. El despliegue solo corre desde `main`, después de que CI y Build terminen en verde.

Flujo de ramas: `feature/*` → PR a `develop` (aprobado por el otro integrante) → PR de `develop` a `main` cuando se entrega una versión.

## 4. Lista de comprobación posterior

- [ ] `/estado` responde y confirma la conexión con Supabase.
- [ ] Registro e inicio de sesión funcionan; el correo de confirmación llega.
- [ ] El catálogo muestra cartas con imagen (URLs firmadas).
- [ ] Un usuario normal **no** accede a `/admin/usuarios` ni a `/admin/auditoria` (ve un error de permiso).
- [ ] Un usuario no ve el inventario, binders ni mazos de otro.
- [ ] El PDF de proxies de un mazo se imprime al 100 % y la carta mide 63 × 88 mm.
- [ ] El pipeline de `main` quedó en verde y la aprobación manual quedó registrada.

## 5. Operación

- **Pausa del plan gratuito.** Supabase pausa el proyecto tras 7 días sin actividad. Una tarea programada lo evita; si ya se pausó, se reactiva desde el panel.
- **Sin respaldos automáticos.** `PokeDatabase.db` y el script de migración son el respaldo del catálogo. Los datos de usuarios no tienen respaldo en el plan gratuito: exportar periódicamente si importan.
- **Rotar secretos.** Si una clave se filtra, se regenera en Supabase, se actualiza en el App Service y se reinicia. Nunca se pega en el chat, en un issue ni en un commit; gitleaks vigila el repositorio.
- **Mejora pendiente.** `output: "standalone"` en `next.config.ts` reduciría el artefacto (hoy ~500 MB por `node_modules`) a una fracción.
