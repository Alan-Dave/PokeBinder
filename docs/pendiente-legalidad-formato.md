# PBI-19 (AB#62): validación de legalidad por formato

## Estado: implementado

La tarjeta pedía marcar si un mazo es legal en el formato elegido (RF-08). Estuvo
bloqueada porque el catálogo migrado (`PokeDatabase.db`) no trae ningún dato de
legalidad por set o formato, y inventarlo habría sido peor que no tener la
función.

El bloqueo se resolvió con una fuente real que el proyecto ya usa para las
imágenes en alta definición: **TCGdex** informa en cada carta el campo
`legal: { standard, expanded }` (además de `regulationMark`).

## Cómo funciona

- `/mazos/[id]` tiene un selector de formato (Standard o Expanded). Solo al
  elegirlo se consulta a TCGdex.
- `lib/legalidad-mazo.ts` pide la legalidad de cada carta distinta del mazo
  (como máximo 100) y la recuerda en memoria 24 horas (un fallo, 1 minuto).
  No se guarda en la base: los formatos rotan y no hay migración que mantener.
- `lib/legalidad.ts` (lógica pura) decide el veredicto:
  - **Legal:** TCGdex confirmó todas las cartas.
  - **No legal:** al menos una carta no está permitida; se listan.
  - **No verificable:** alguna carta no tiene información. Nunca se muestra
    como legal.
- A TCGdex solo viaja el `id_api` de cada carta (identificador público del
  catálogo). Se reutilizan las defensas de `lib/tcgdex.ts`: host fijo, sin
  redirecciones, tiempo y tamaño máximos y respuesta validada con zod.

## Límites conocidos

- Solo Standard y Expanded, los formatos que TCGdex informa por carta.
- El chino (`zh`) no existe en TCGdex: esas cartas se buscan en inglés con el
  mismo `id_api` y, si no aparecen, quedan como no verificables.
- Los id de otros idiomas no siempre coinciden con el nuestro (el japonés usa
  `PMCG1` donde nosotros `base1`): se prueba el idioma de la carta y luego el
  inglés.
- Si TCGdex no responde, el veredicto es «no verificable», no «legal».
- La caché vive en la memoria del servidor: se vacía al reiniciar.
- Es legalidad por carta. Reglas del mazo como el máximo de copias las valida
  `lib/reglas-mazo.ts` (PBI-16).
- No se probó contra TCGdex real desde la aplicación; las pruebas usan
  respuestas simuladas.
