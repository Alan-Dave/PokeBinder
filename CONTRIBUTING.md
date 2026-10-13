# Guía de contribución

Convenciones de trabajo del equipo DevSecure para el repositorio PokeBinder.

- **Gestión:** Azure DevOps — organización `devsecure`, proyecto `PokeBinder` (`dev.azure.com/devsecure/PokeBinder`)
- **Repositorio:** GitHub — `github.com/Alan-Dave/PokeBinder`

---

## Identificadores de trabajo

Cada tarjeta del backlog tiene dos identificadores con funciones distintas:

| Identificador | Ejemplo | Uso |
|---|---|---|
| Código PBI | `PBI-02` | Referencia humana: Wiki, ramas, títulos de tarjeta y de commit. Es la numeración oficial y no cambia aunque la tarjeta cambie de sprint. |
| ID de Azure Boards | `AB#6` | Referencia de máquina: vincula commits y Pull Requests con la tarjeta. Lo asigna Azure y no se puede cambiar. |

El título de cada tarjeta en Azure Boards empieza con su código:

```
PBI-02 · Establecer repositorio, ramas y políticas de PR
```

Cada PBI es la unidad de trabajo. Si algo no tiene PBI, no se programa: primero se crea la tarjeta en Azure Boards.

---

## Ramas

| Rama | Propósito |
|---|---|
| `main` | Solo código desplegado en producción. |
| `develop` | Integración. Todo llega aquí mediante Pull Request. |
| `feature/PBI-XX-descripcion-corta` | Trabajo de un PBI. Se crea desde `develop`. |
| `legacy/desktop-pyqt6` | Versión anterior de escritorio, archivada. No se toca. |

---

## Commits

Formato: `PBI-XX: qué hace el cambio AB#<id>`, en presente.

```
PBI-02: agrega plantilla de variables de entorno AB#6
```

El `AB#<id>` es obligatorio. El repositorio vive en GitHub y Azure Boards solo vincula un commit a su tarjeta mediante esa mención (requiere la app *Azure Boards* instalada en el repositorio). Sin él no se cumple el criterio de la Definition of Done que exige el work item vinculado al commit.

---

## Pull Requests

- Obligatorios hacia `develop`, con aprobación del otro integrante. **Nadie aprueba lo propio.**
- El título sigue el formato de commit.
- La descripción incluye `AB#<id>`. Si el PR completa la tarjeta, usar `Fixes AB#<id>` para cerrarla al fusionar.
- El pipeline debe terminar en verde antes de fusionar.

---

## Roles del sistema

Los nombres oficiales son los de RT-02 (Tarea 1). Su equivalencia con RF-01 (Formulario de inscripción):

| Nombre en el sistema | Equivalente en RF-01 |
|---|---|
| Superusuario | Super Administrador |
| Administrador | Moderador |
| Usuario Normal | Usuario Estándar |
