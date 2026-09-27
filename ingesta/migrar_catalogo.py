"""Migra el catálogo de cartas de PokeDatabase.db (SQLite) a PostgreSQL (Supabase).

Uso (PowerShell):

    # 1. Revisar la limpieza sin conectarse a la base de datos
    python ingesta/migrar_catalogo.py C:\\ruta\\PokeDatabase.db --dry-run

    # 2. Cargar. La cadena de conexión es la del Session pooler de Supabase
    #    (Connect -> Session pooler) y se pasa por variable de entorno para
    #    que la contraseña no quede en el historial ni en un archivo.
    $env:SUPABASE_DB_URL = "postgresql://..."
    python ingesta/migrar_catalogo.py C:\\ruta\\PokeDatabase.db

Se puede ejecutar más de una vez: las cartas existentes se actualizan y no se
duplican. Toda la carga ocurre en una transacción; si algo falla, no queda nada
a medias.
"""

import argparse
import os
import sqlite3
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

IDIOMAS = {"en", "es", "fr", "pt", "ja", "zh"}

# Valores de relleno del origen que significan "sin dato".
MARCADORES = {"", "Desconocido", "Desconocida", "Ninguno", "TCGDex"}

# En especial_type, 'Normal' significa "sin subtipo especial".
SIN_SUBTIPO = MARCADORES | {"Normal"}


@dataclass(frozen=True)
class Carta:
    id_api: str
    idioma: str
    nombre: str
    type: str | None
    price: Decimal | None
    rarity: str | None
    number: str
    set_id: str
    set_nombre: str | None
    stage: str | None
    subtipos: list[str]
    variantes_disponibles: list[str]


def limpiar(valor: object) -> str | None:
    texto = str(valor).strip() if valor is not None else ""
    return None if texto in MARCADORES else texto


def normalizar_fila(fila: sqlite3.Row) -> Carta:
    """Convierte una fila de SQLite en una Carta válida o lanza ValueError."""
    id_api = limpiar(fila["id_api"])
    idioma = limpiar(fila["idioma"])
    nombre = limpiar(fila["nombre"])
    number = limpiar(fila["number"])
    set_id = limpiar(fila["set_id"])

    if not id_api or "-" not in id_api or len(id_api) > 50:
        raise ValueError(f"id_api inválido: {fila['id_api']!r}")
    if idioma not in IDIOMAS:
        raise ValueError(f"idioma no soportado: {fila['idioma']!r}")
    if not nombre or len(nombre) > 200:
        raise ValueError("nombre vacío o demasiado largo")
    if not number or len(number) > 20:
        raise ValueError(f"number inválido: {fila['number']!r}")
    if not set_id or len(set_id) > 30:
        raise ValueError(f"set_id inválido: {fila['set_id']!r}")

    price = None
    if fila["price"] is not None:
        # Pasar por str evita arrastrar el error binario del float (0.1 -> 0.1000000000000000055...).
        price = Decimal(str(fila["price"])).quantize(Decimal("0.01"))
        if price < 0:
            raise ValueError(f"price negativo: {fila['price']!r}")

    # La lista de subtipos quedó repartida por posición en tres columnas.
    subtipos: list[str] = []
    for columna in ("especial_type", "trainer", "edition"):
        valor = fila[columna].strip() if fila[columna] else ""
        if valor not in SIN_SUBTIPO and valor not in subtipos:
            subtipos.append(valor)

    variantes: list[str] = []
    for variante in (fila["variantes_disponibles"] or "").split(","):
        variante = variante.strip()
        if variante and variante not in variantes:
            variantes.append(variante)

    return Carta(
        id_api=id_api,
        idioma=idioma,
        nombre=nombre,
        type=limpiar(fila["type"]),
        price=price,
        rarity=limpiar(fila["rarity"]),
        number=number,
        set_id=set_id,
        set_nombre=limpiar(fila["set_name"]),
        stage=limpiar(fila["stage"]),
        subtipos=subtipos,
        variantes_disponibles=variantes,
    )


def nombres_de_sets(cartas: list[Carta]) -> dict[tuple[str, str], str | None]:
    """Elige un nombre por (set_id, idioma): el más frecuente que no sea un marcador."""
    conteo: dict[tuple[str, str], Counter] = defaultdict(Counter)
    for carta in cartas:
        clave = (carta.set_id, carta.idioma)
        conteo[clave]  # registra el set aunque no tenga nombre
        if carta.set_nombre:
            conteo[clave][carta.set_nombre] += 1
    return {
        clave: (nombres.most_common(1)[0][0] if nombres else None)
        for clave, nombres in conteo.items()
    }


def leer_origen(ruta: Path) -> tuple[list[Carta], list[str]]:
    # mode=ro: el script nunca modifica el archivo de origen, que es el respaldo.
    con = sqlite3.connect(f"file:{ruta.as_posix()}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    try:
        cartas: list[Carta] = []
        descartadas: list[str] = []
        for fila in con.execute("select * from Cartas order by id"):
            try:
                cartas.append(normalizar_fila(fila))
            except ValueError as error:
                descartadas.append(f"fila {fila['id']} ({fila['id_api']}, {fila['idioma']}): {error}")
        return cartas, descartadas
    finally:
        con.close()


def cargar(cartas: list[Carta], sets: dict[tuple[str, str], str | None], url: str) -> int:
    import psycopg  # Solo se necesita al cargar, no en --dry-run.

    # sslmode=require: la contraseña y los datos nunca viajan sin cifrar.
    with psycopg.connect(url, sslmode="require") as con, con.cursor() as cur:
        cur.execute("""
            create temp table staging_sets (id text, idioma text, nombre text) on commit drop;
            create temp table staging_cartas (
              id_api text, idioma text, nombre text, type text, price numeric(10, 2),
              rarity text, number text, set_id text, stage text,
              subtipos text[], variantes_disponibles text[]
            ) on commit drop;
        """)

        with cur.copy("copy staging_sets (id, idioma, nombre) from stdin") as copy:
            for (set_id, idioma), nombre in sets.items():
                copy.write_row((set_id, idioma, nombre))

        with cur.copy(
            "copy staging_cartas (id_api, idioma, nombre, type, price, rarity, number,"
            " set_id, stage, subtipos, variantes_disponibles) from stdin"
        ) as copy:
            for c in cartas:
                copy.write_row((
                    c.id_api, c.idioma, c.nombre, c.type, c.price, c.rarity, c.number,
                    c.set_id, c.stage, c.subtipos, c.variantes_disponibles,
                ))

        # coalesce: una recarga sin nombre no borra un nombre que ya existía.
        cur.execute("""
            insert into public.sets (id, idioma, nombre)
            select id, idioma, nombre from staging_sets
            on conflict (id, idioma) do update
              set nombre = coalesce(excluded.nombre, public.sets.nombre);
        """)
        cur.execute("""
            insert into public.cartas (id_api, idioma, nombre, type, price, rarity, number,
                                       set_id, stage, subtipos, variantes_disponibles)
            select id_api, idioma, nombre, type, price, rarity, number,
                   set_id, stage, subtipos, variantes_disponibles
            from staging_cartas
            on conflict (id_api, idioma) do update set
              nombre = excluded.nombre,
              type = excluded.type,
              price = excluded.price,
              rarity = excluded.rarity,
              number = excluded.number,
              set_id = excluded.set_id,
              stage = excluded.stage,
              subtipos = excluded.subtipos,
              variantes_disponibles = excluded.variantes_disponibles;
        """)
        cur.execute("select count(*) from public.cartas")
        return cur.fetchone()[0]


def main() -> int:
    parser = argparse.ArgumentParser(description="Migra el catálogo de SQLite a PostgreSQL.")
    parser.add_argument("origen", type=Path, help="ruta a PokeDatabase.db")
    parser.add_argument("--dry-run", action="store_true", help="valida y resume sin conectarse")
    args = parser.parse_args()

    if not args.origen.is_file():
        print(f"No existe el archivo {args.origen}", file=sys.stderr)
        return 1

    cartas, descartadas = leer_origen(args.origen)
    sets = nombres_de_sets(cartas)

    print(f"Cartas válidas: {len(cartas)}")
    print(f"Sets: {len(sets)} ({sum(1 for n in sets.values() if n is None)} sin nombre)")
    print("Por idioma:", dict(sorted(Counter(c.idioma for c in cartas).items())))
    print(f"Descartadas: {len(descartadas)}")
    for motivo in descartadas:
        print(f"  - {motivo}")

    if args.dry_run:
        return 0

    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        print("Falta la variable de entorno SUPABASE_DB_URL.", file=sys.stderr)
        return 1

    total = cargar(cartas, sets, url)
    print(f"Carga completa. Cartas en la base de datos: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
