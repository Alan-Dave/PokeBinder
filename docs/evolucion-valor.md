# PBI-30 (AB#64): evolución del valor de la colección

RF-10. Gráfico del valor estimado de la colección en el tiempo, en `/coleccion/evolucion`
(períodos de 30, 90 y 365 días). Depende de PBI-29 (precios de mercado).

## Cómo funciona

1. **Se guarda un precio por día.** Al abrir la colección o la ficha de una carta,
   el servidor registra en `precios_historial` el precio de mercado de cada
   acabado (una fila por carta, acabado y día; el primero del día queda).
2. **Se calcula en la aplicación.** `lib/evolucion.ts` valúa el inventario ACTUAL
   del usuario con el último precio conocido de cada fecha.
3. **Se dibuja con SVG**, sin dependencias nuevas, con una tabla accesible debajo.

## Seguridad

- `precios_historial` tiene RLS: los usuarios con sesión solo **leen**; no hay
  política de escritura y se revocaron `insert/update/delete/truncate`. Si
  pudieran insertar, falsearían los precios que ven los demás.
- Escribe solo el servidor con `service_role` (`lib/historial-precios.ts`), que
  nunca llega al navegador. Es el único uso de la clave de servicio sobre una
  tabla, y está acotado a datos públicos del mercado. Se documenta en
  `lib/supabase/admin.ts`.
- La tabla no tiene `usuario_id`: no guarda datos personales. El inventario se
  lee con la sesión del usuario, así que RLS le muestra solo el suyo.
- Entradas validadas con zod (período entre 7 y 365 días; precios finitos y no
  negativos). Ninguna consulta se arma con texto del usuario.
- Migración y su prueba (con `ROLLBACK`): `supabase/migrations/20261105120000_historial_precios.sql`
  y `supabase/tests/historial_precios.test.sql`.

## Límites conocidos

- **El historial empieza el día que se aplicó la migración.** Los primeros días
  el gráfico tiene pocos puntos o ninguno (la pantalla lo explica).
- **Solo se guarda lo que alguien consulta.** Una carta que nadie abre no suma
  puntos; no hay una tarea programada que registre toda la colección.
- **Valúa tu inventario de hoy con los precios de cada fecha.** No reconstruye
  qué cartas tenías en el pasado: el inventario no guarda historia.
- **Empieza el día en que todas las cartas valuables tienen precio**, para que el
  gráfico no suba solo porque van apareciendo cartas.
- Las filas sin acabado equivalente (por ejemplo 1ª edición) o sin historial no
  suman ni valen 0: se cuentan aparte.
- Se consideran hasta 500 registros del inventario y 365 días.
- Probado con clientes simulados; no contra el Supabase real desde la aplicación.
