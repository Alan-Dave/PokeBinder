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

## Cómo se completa (PBI-X14, AB#81)

1. `supabase/migrations/20261108140000_categoria_cartas.sql` agrega `cartas.categoria`
   (`Pokemon`, `Trainer`, `Energy`) y `cartas.energia_basica`. La aplica Macarena a mano.
2. `ingesta/completar_categorias.py` consulta TCGdex filtrando por categoría y etapa
   (unas decenas de peticiones, no una por carta), cruza por `id_api` con las mismas
   correcciones de id que `lib/precios-carta.ts` y escribe el resultado en todas las
   ediciones. Con `--dry-run` solo reporta. Lo que TCGdex no trae queda sin dato y se
   lista; no se infiere nada. `stage` solo se completa donde está vacío.
3. `lib/reglas-mazo.ts` usa esos datos:
   - Una energía básica es la que el catálogo marca como tal (TCGdex `energyType = Normal`);
     sin ese dato se sigue reconociendo por el nombre.
   - La advertencia del Pokémon Básico solo cuenta las cartas que podrían ser Pokémon:
     una carta conocida como Entrenador o Energía ya no la dispara.

**Orden obligatorio:** aplicar la migración, correr el script y después desplegar. Si la
aplicación se despliega antes que la migración, la página del mazo falla porque pide
columnas que no existen.

## Reglas que NO se agregan

Las reglas oficiales no limitan cuántas Energías ni cuántos Partidarios lleva un mazo
(el límite de un Partidario por turno es de la partida, no del mazo). Validarlo sería
inventar una regla. El límite de 4 copias ya cubre las energías especiales.

## Qué sigue sin cerrarse

Cartas que TCGdex no tiene (por ejemplo los sets `swsh*.5tg`) y Pokémon con etapa que
TCGdex no entrega (VMAX, VSTAR, etc. no se completan a propósito): conservan la
advertencia «no se pudo comprobar».
