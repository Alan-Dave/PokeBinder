# Qué se guarda, dónde, cuándo y quién accede (PBI-27 · PBI-X30)

Revisión hecha el 11 de noviembre de 2026 leyendo el código y las migraciones del
repositorio. Responde a la pregunta de PBI-27 («qué se guarda, cómo se guarda,
cuándo se guarda») y sirve de inventario para la Ley 21.719 de protección de datos
personales. **No se revisaron los registros reales de Vercel ni el contenido de las
tablas en Supabase**: eso necesita acceso a los paneles y está pendiente (ver al final).

## 1. Datos que guarda el sistema

| Dato | Dónde | Cuándo se guarda | Quién puede leerlo | ¿Personal? |
|---|---|---|---|---|
| Correo y contraseña (la contraseña solo como hash) | Supabase Auth (`auth.users`) | Al registrarse; la contraseña, también al cambiarla o recuperarla | Solo el servicio de Auth. La aplicación nunca lee ni guarda la contraseña | Sí |
| Nombre visible y rol | `perfiles` | Al registrarse (el trigger deja siempre `usuario_normal`); el rol, solo con `asignar_rol` | Cada usuario ve el suyo; el superusuario lista todos con `listar_perfiles` (queda en la bitácora) | Sí |
| Cartas de la colección (variante, cantidad) | `inventario` | Cuando el usuario agrega, edita o elimina | Solo su dueño (RLS) | Sí (hábitos del usuario) |
| Categorías propias y qué cartas contienen | `categorias_coleccion`, `categoria_cartas` | Cuando el usuario las crea o asigna | Solo su dueño (RLS) | Sí |
| Mazos y sus cartas | `mazos`, `mazo_cartas` | Cuando el usuario los arma | Solo su dueño (RLS) | Sí |
| Binders y su contenido | `binders`, `binder_casillas` | Cuando el usuario los arma | Solo su dueño (RLS) | Sí |
| Reportes de errores del catálogo (motivo y **texto libre** de 10 a 500 caracteres) | `reportes_catalogo` | Cuando el usuario lo envía; máximo 20 por día | Su autor; administradores y superusuarios ven todos | Puede serlo: el texto lo escribe la persona |
| Bitácora: cambios de rol, consultas de la lista de perfiles y de la propia bitácora | `auditoria` | Automáticamente, por trigger o dentro de la función SQL | Solo un superusuario, por `listar_auditoria`. Nadie la modifica ni la borra | Sí (identifica a quien actuó) |
| Precio de mercado por carta, acabado y día | `precios_historial` | Cuando un usuario con sesión abre su colección; un valor por carta y día | Cualquier usuario con sesión; escribe solo el servidor | No: no lleva usuario |
| Catálogo (cartas, sets) | `cartas`, `sets` | Por la ingesta, fuera de la aplicación | Público | No |
| Sesión (token de acceso y de renovación) | Cookies `sb-…-auth-token` | Al iniciar sesión; se renuevan en cada petición (`proxy.ts`) | El navegador del usuario y el servidor | Sí |
| Preferencia de sonido (sí/no) | `localStorage` del navegador | Al activarla | Solo ese navegador; nunca viaja al servidor | No |
| Miniaturas de TCGdex | Carpeta temporal del servidor | La primera vez que alguien pide una carta; vence a los 7 días | Quien pida esa imagen | No |

Imágenes del catálogo: bucket privado `Images`; el navegador recibe una URL firmada
que caduca a las 3 horas, generada en el servidor.

## 2. Qué NO se guarda

- La contraseña en claro, en ninguna tabla ni en los registros.
- Fecha de nacimiento ni edad (decisión pendiente en CLAUDE.md; no se construyó).
- Direcciones IP, huellas del navegador ni datos de pago. El límite de peticiones de
  las rutas de imágenes y del panel usa la IP **solo en memoria** y no la guarda.
- Contenido de las peticiones: ninguna ruta lo escribe en los registros.

## 3. Registros del servidor (`console.error`)

Hay 43 llamadas a `console.error` en `app/`, `lib/` y `proxy.ts`; no hay ningún
`console.log`, `console.info` ni `console.warn`. Qué escribe cada grupo:

| Grupo | Qué se registra | Valoración |
|---|---|---|
| `lib/auth.ts` (8 llamadas) | Solo un texto fijo y el **código** del error de Supabase Auth. Nunca el correo, la contraseña, el token ni el mensaje completo | Correcto: lo más sensible queda fuera por diseño |
| Módulos de datos (`inventario`, `mazos`, `binders`, `categorias`, `reportes`, `roles`, `catalogo`, `evolucion`, `exportar`, …) | El objeto de error que devuelve Supabase (código, mensaje, detalle) y, en algunos, solo el código | Aceptable, con un matiz: el campo «detalle» de PostgreSQL puede incluir identificadores (por ejemplo el UUID del usuario y el id de una carta en un error de clave duplicada). Son identificadores pseudónimos, no contraseñas ni claves |
| `lib/imagenes.ts` | La ruta del archivo de imagen que no se pudo firmar | No personal |
| `app/estado`, `proxy.ts`, `lib/imagen-hd.ts` | Fallos de red o de caché | No personal |

Hacia el navegador, los errores inesperados salen siempre con un mensaje genérico
(«No se pudo completar la operación.»); el detalle se queda en el servidor. La única
excepción es `lib/catalogo.ts`, que registra el motivo de falta de configuración
(nombres de variables de entorno, nunca sus valores).

Ninguna página inyecta HTML sin escapar (`dangerouslySetInnerHTML` no aparece en
`app/` ni `components/`).

## 4. Observaciones

| # | Observación | Severidad | Qué hacer |
|---|---|---|---|
| D1 | La bitácora solo registra cambios de rol y las consultas de perfiles y de la propia bitácora. **No** registra inicios de sesión, cambios de contraseña, descargas de la colección ni eliminaciones | Baja | Decidir con Alan si hace falta ampliarla. Cada evento nuevo es un PBI aparte (trigger o función SQL) |
| D2 | No hay una política escrita de **retención**: los reportes de errores del catálogo, los precios y la bitácora no se purgan | Baja | Definir cuánto tiempo se conservan y documentarlo (la Ley 21.719 pide que el tratamiento no exceda lo necesario) |
| D3 | El texto libre de `reportes_catalogo` puede contener datos personales si el usuario los escribe | Informativa | Mostrar un aviso en el formulario de reporte: «No incluyas datos personales» |
| D4 | El «detalle» de los errores de PostgreSQL llega a los registros con identificadores | Informativa | Aceptado: son pseudónimos y los registros de Vercel solo los ve el equipo |
| D5 | No hay flujo formal de eliminación de cuenta por solicitud (derecho de supresión) | Media para la Ley 21.719 | Ya figura en `docs/seguridad.md` como pendiente; borrar la cuenta en Supabase Auth arrastra por cascada perfil, inventario, mazos, binders y reportes. La bitácora conserva `usuario_id` a propósito |

## 5. Pendiente de comprobar con acceso a los paneles

1. **Registros de Vercel** (Logs): repetir acciones fallidas (contraseña equivocada,
   ids inválidos, `/admin/*` sin permiso) y confirmar que no aparece ninguna
   contraseña, token, clave ni correo.
2. **Tablas en Supabase** tras un recorrido: `precios_historial` solo con precios,
   `reportes_catalogo` solo con lo enviado, `auditoria` con los cambios de rol y las
   consultas esperadas, `perfiles` con todos en `usuario_normal` salvo los asignados.
3. **Retención de los registros de Vercel** según el plan contratado.
