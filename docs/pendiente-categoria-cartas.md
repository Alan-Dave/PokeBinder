# PBI-16 (AB#40): reglas de mazo que el catálogo no permite comprobar

## Qué pedía la tarjeta

Un constructor de mazos con las reglas básicas: número máximo de cartas, límites
de energías y de partidarios, y que el usuario sepa qué puede construir.

## Qué se implementó

`lib/reglas-mazo.ts` valida lo que los datos permiten comprobar con certeza:

| Regla | Cómo se comprueba |
|---|---|
| Exactamente 60 cartas | Suma de copias |
| Máximo 4 copias por nombre | Agrupa por el nombre en inglés, así que ediciones e idiomas distintos suman juntos. Las 8 energías básicas están exentas |
| Una sola carta Radiant | Subtipo `Radiant` |
| Una sola carta ACE SPEC | Subtipo `ACE SPEC`, si el catálogo lo marca |
| Al menos un Pokémon Básico | Etapa `Basic` o `Baby`, solo cuando hay datos |

## Qué no se puede comprobar, y por qué

El catálogo migrado no trae la categoría de la mayoría de las cartas. Consulta
de solo lectura sobre `public.cartas`, el 3-11-2026:

| Idioma | Cartas | `stage` nulo | `type` nulo |
|---|---|---|---|
| en | 29.538 | 9.233 (31 %) | 12.246 |
| es | 15.392 | 15.392 (100 %) | 15.392 |
| fr | 21.554 | 21.554 (100 %) | 21.554 |
| pt | 13.845 | 13.845 (100 %) | 13.845 |

- Solo las cartas en inglés traen `stage` y `type`, y aun así faltan en cerca de
  un tercio, incluidos Pokémon (Oricorio, Luxray) y Entrenadores (Rare Candy).
- El `id_api` es el mismo en todos los idiomas, así que `obtenerMazo` completa
  etapa y subtipos con la edición en inglés. Con eso mejora, pero no cierra la
  brecha.
- No existe ninguna categoría «Energía».

Por eso **no se valida** el límite de Partidarios ni de Energías, y la regla del
Pokémon Básico solo se afirma o se niega cuando hay etapa. Si hay cartas sin
etapa y ningún Básico conocido, el mazo muestra una **advertencia** («no se pudo
comprobar…»), nunca una aprobación. Inferir la categoría por el nombre o rellenar
valores a mano mostraría como cierto algo que podría ser falso.

## Qué se necesitaría para completarlo

1. Una fuente de la categoría (Pokémon, Entrenador, Energía) y la etapa de cada
   carta. TCGdex, que ya se usa para la imagen en alta definición
   (`lib/tcgdex.ts`), la entrega por carta.
2. Un script de ingesta separado, al estilo de `ingesta/migrar_catalogo.py`, que
   complete esas columnas para todas las ediciones. No se debe cargar a mano.
3. Con eso, ampliar `lib/reglas-mazo.ts` con las reglas de categoría y retirar la
   advertencia.
