# PBI-29 (AB#63): precios del mercado secundario

RF-07. Fuente: **TCGdex**, campo `pricing.tcgplayer` de cada carta (precio de
mercado de TCGplayer, en **dólares**). TCGdex ya se usa para la imagen en alta
definición, así que no se suma ningún proveedor ni ninguna clave.

## Qué se muestra

- **Ficha de la carta** (`/catalogo/[id]`): precio de mercado por acabado
  (normal, holo, reverse holo...) con la fecha que informa la fuente.
- **Mi colección** (`/coleccion`): precio unitario por fila y valor estimado de
  la página (precio × cantidad), contando aparte las filas sin precio.

## Decisiones

- **Sin conversión de moneda.** Se muestra dólares tal como llegan. Pasar a
  pesos chilenos exigiría otra fuente externa para el tipo de cambio; queda como
  mejora futura.
- **Sin migración ni escritura en la base.** Los precios cambian a diario: se
  consultan y se recuerdan en memoria 6 horas (un fallo, 1 minuto).
- **Nunca se muestra 0 como precio.** Sin dato, la pantalla dice «Sin precio
  disponible». Una variante sin acabado equivalente (por ejemplo 1ª edición)
  tampoco recibe precio estimado.
- **Solo viaja el `id_api`** de la carta, que es un identificador público del
  catálogo. Ningún dato del usuario sale del sistema.
- Se reutilizan las defensas de `lib/tcgdex.ts`: host fijo, sin redirecciones,
  tiempo y tamaño máximos, y respuesta validada con zod (precios no numéricos o
  negativos se descartan).
- Máximo 30 cartas distintas por consulta, igual que una página de inventario.

## Límites conocidos

- El valor de la colección es **por página**, no el total del inventario:
  sumar todo exigiría consultar miles de cartas a un tercero.
- Es una referencia orientativa de TCGplayer, no una oferta ni una tasación.
- No se probó contra TCGdex real desde la aplicación; las pruebas usan
  respuestas simuladas (la forma de la respuesta sí se verificó a mano).
- PBI-30 (gráfico de evolución del valor) queda fuera: TCGdex solo informa
  promedios de 1, 7 y 30 días, y una serie histórica requeriría guardar precios
  en una tabla nueva.
