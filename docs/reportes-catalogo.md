# PBI-31 (AB#65): reporte de errores del catálogo por usuarios

Mejora no exigida por los requerimientos. Un usuario avisa que una carta tiene un
dato mal; un administrador lo revisa y lo cierra.

## Qué hay

- **Ficha de la carta** (`/catalogo/[id]`): formulario plegable «¿Hay un error en
  esta carta? Reportarlo», con motivo (lista fija) y detalle de 10 a 500 caracteres.
- **Revisión** (`/admin/reportes`): lista de reportes por estado (abiertos,
  resueltos, descartados) con los botones «Marcar resuelto» y «Descartar».
- **Tabla** `public.reportes_catalogo` (migración `20261105140000_reportes_catalogo.sql`,
  prueba con `ROLLBACK` en `supabase/tests/reportes_catalogo.test.sql`).

## Seguridad

Es dato de usuario, así que las reglas viven en la base (RLS con `using` y
`with check`), no en la interfaz:

| Quién | Qué puede |
|---|---|
| Usuario autenticado | Crear reportes **a su nombre y siempre en estado `abierto`**; ver solo los suyos. No edita ni borra. |
| Administrador / Superusuario | Ver todos y cambiar **solo la columna `estado`** a `resuelto` o `descartado`. |
| Anónimo | Nada. |

- `usuario_id` sale de `auth.uid()` por defecto: el código nunca lo recibe ni lo
  envía, así que no se puede crear un reporte a nombre de otro.
- El permiso de `update` está limitado a la columna `estado`: un administrador no
  reescribe lo que dijo el usuario.
- Anti-abuso: un solo reporte abierto por usuario, carta y motivo (índice único
  parcial) y un máximo de 20 reportes por usuario cada 24 horas (trigger).
- Toda entrada pasa por zod (`lib/validators/reportes-catalogo.ts`) antes de tocar la base.
  Los mismos límites están como `check` en la tabla.
- El rol se verifica en la base (RLS). `puedeRevisarReportes` solo decide qué
  pantalla mostrar; si alguien llamara a la acción directamente, RLS no le deja
  ver reportes ajenos ni cambiar estados.
- El texto del reporte lo escribió un usuario: React lo escapa al mostrarlo y
  nunca se inserta como HTML.

## Límites conocidos

- Al administrador no se le muestra quién reportó: la política de `perfiles` solo
  deja leer el perfil propio. Se ve la carta, el motivo, el detalle y la fecha.
- Un administrador no puede reabrir un reporte. Y el usuario no puede repetir uno
  abierto igual, pero sí uno nuevo cuando el anterior se cierre.
- No hay aviso al usuario cuando se cierra su reporte, ni pantalla «mis reportes».
- Se listan hasta 100 reportes por estado.
- Los reportes no corrigen el catálogo: la corrección de datos es manual.
- Probado con clientes simulados y con la prueba SQL; no probado en el navegador.
