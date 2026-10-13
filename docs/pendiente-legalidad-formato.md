# PBI-19 (AB#62): validación de legalidad por formato — pendiente

## Qué pedía la tarjeta

El título del backlog es "Validación de legalidad por formato" (por ejemplo,
que una carta o un set sean legales en el formato competitivo Standard o
Expanded). No hay un documento de requerimientos más detallado en el repo:
el título es toda la especificación formal disponible.

## Por qué no se implementó

Para validar legalidad hace falta saber, para cada set, en qué formato(s) es
legal y desde/hasta cuándo (los formatos rotan: un set deja de ser legal en
Standard después de cierto tiempo). **Esa información no existe en el
catálogo migrado.**

Se revisó:

- `supabase/migrations/20260926213011_catalogo.sql`: ni `cartas` ni `sets`
  tienen una columna de formato, legalidad o rotación.
- `ingesta/migrar_catalogo.py`: el `Carta` de origen (desde
  `PokeDatabase.db`) tampoco trae ese dato — no se perdió en la migración,
  nunca estuvo en el origen.

Agregar una tabla de legalidad con datos inventados o de memoria violaría la
misma regla que ya aplicamos en otros lados del proyecto: no fabricar datos
que se presenten como reales. Una tabla así, mal alimentada, sería peor que
no tener la función: le diría a un usuario que su mazo es legal cuando no lo
es, o al revés.

## Qué se necesitaría para implementarlo

1. Una fuente de datos de legalidad por set y formato (por ejemplo, el mismo
   tipo de fuente que ya usa la app oficial de Pokémon TCG Live, o el
   histórico de rotaciones publicado por Play! Pokémon).
2. Una tabla nueva, por ejemplo `formatos_legalidad (set_id, idioma, formato,
   legal_desde, legal_hasta)`, cargada por un script de ingesta separado
   (siguiendo el estilo de `ingesta/migrar_catalogo.py`), no a mano.
3. Recién con eso, una función de validación análoga a
   `lib/mazos.ts` (PBI-17): dado un mazo y un formato, qué cartas no son
   legales.

## Qué sigue

Mientras no se resuelva el punto 1 (de dónde sale el dato), esta tarjeta no
se puede programar sin inventar información. Queda para cuando el equipo
decida una fuente concreta.
