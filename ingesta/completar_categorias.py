"""Completa cartas.categoria, cartas.energia_basica y cartas.stage con datos de TCGdex.

PBI-X14. El catálogo migrado no trae la categoría de la mayoría de las cartas
(ver docs/pendiente-categoria-cartas.md). TCGdex sí la entrega, y permite
filtrar por ella: en lugar de pedir ~30.000 cartas una por una, se piden las
listas de ids de cada categoría (unas pocas decenas de peticiones) y se cruzan
con los id_api de nuestra base.

Qué escribe:
  - categoria: 'Pokemon', 'Trainer' o 'Energy'.
  - energia_basica: true/false, solo en energías (TCGdex energyType = Normal).
  - stage: solo donde está vacío y TCGdex lo da (Basic, Baby, Stage 1, Stage 2).
    Nunca pisa una etapa que ya exista.
Qué NO hace: inferir nada por el nombre. Una carta que TCGdex no trae queda
sin categoría y se reporta.

id_api es igual en todos los idiomas, así que el resultado se copia a todas las
ediciones de un mismo id_api.

Uso (PowerShell):

    python ingesta/completar_categorias.py --dry-run

    $env:SUPABASE_DB_URL = "postgresql://postgres.<ref>@<host>.pooler.supabase.com:5432/postgres"
    python ingesta/completar_categorias.py

Se puede ejecutar más de una vez con el mismo resultado.
"""

import argparse
import getpass
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from dataclasses import dataclass

HOST_API = "api.tcgdex.net"
PAGINA = 1000
REINTENTOS = 7
ESPERA_MAXIMA = 60
PAUSA_ENTRE_PETICIONES = 0.3

CATEGORIAS = ("Pokemon", "Trainer", "Energy")
# Los sets japoneses y chinos (SV4a, S12a, SC1a...) solo existen en la lista de
# TCGdex de su idioma, con ids propios que no chocan con los ingleses.
IDIOMAS_TCGDEX = ("en", "ja", "zh-tw", "zh-cn")
# Etapa de TCGdex -> forma en que el catálogo ya la guarda ('Stage 1', no 'Stage1').
ETAPAS = {"Basic": "Basic", "Baby": "Baby", "Stage1": "Stage 1", "Stage2": "Stage 2"}

# Sets que nuestro catálogo y TCGdex nombran distinto. Solo se traducen familias
# comprobadas una a una contra TCGdex; adivinar otro cruzaría cartas ajenas.
#   Escarlata y Púrpura: sv2 -> sv02, sv4pt5 -> sv04.5   (igual que lib/precios-carta.ts)
#   Mega Evolución:      me1 -> me01, me2pt5 -> me02.5
SET_ESCARLATA_PURPURA = re.compile(r"^(sv|me)(\d)(?:pt(\d))?$")
SET_ESPADA_ESCUDO_MEDIO = re.compile(r"^swsh(\d+)pt5$")  # swsh12pt5 -> swsh12.5
#
# Sets sueltos (PBI-X16). Cada equivalencia se comprobó contra TCGdex por la
# identidad del set y por la cantidad de cartas (la de nuestra base contra la de
# TCGdex). No se traducen los kits de entrenador tk1a/tk1b/tk2a/tk2b: no se sabe
# cuál letra es cuál carta del par, y una a/b invertida cruzaría cartas ajenas.
SETS_FIJOS = {
    "swsh45": "swsh4.5",
    "swsh45sv": "swsh4.5sv",
    "swsh35": "swsh3.5",  # Champion's Path (80)
    "swsh12pt5gg": "swsh12.5gg",  # Crown Zenith Galarian Gallery (70)
    "sm35": "sm3.5",  # Shining Legends
    "sm75": "sm7.5",  # Dragon Majesty
    "pgo": "swsh10.5",  # Pokémon GO (88)
    "base6": "lc",  # Legendary Collection (110)
    # Black Bolt tiene 172 cartas y White Flare 173: la cantidad las distingue.
    "zsv10pt5": "sv10.5b",
    "rsv10pt5": "sv10.5w",
    # Colecciones de McDonald's. mcd13 no existe en TCGdex.
    "mcd11": "2011bw",
    "mcd12": "2012bw",
    "mcd14": "2014xy",
    "mcd15": "2015xy",
    "mcd16": "2016xy",
    "mcd17": "2017sm",
    "mcd18": "2018sm",
    "mcd19": "2019sm",
    "mcd21": "2021swsh",
    "mcd22": "2022swsh",
    "mcd23": "2023sv",
    "mcd24": "2024sv",
    "cel25c": "cel25cc",  # Celebrations Classic Collection (25)
    "fut20": "fut2020",  # Pokémon Futsal 2020 (5)
    "hsp": "hgssp",  # HGSS Black Star Promos (25)
    "bp": "bog",  # Best of Game (9)
}


@dataclass(frozen=True)
class Clasificacion:
    categoria: str
    energia_basica: bool | None
    stage: str | None


def set_de_tcgdex(set_id: str) -> str:
    if set_id in SETS_FIJOS:
        return SETS_FIJOS[set_id]
    m = SET_ESPADA_ESCUDO_MEDIO.match(set_id)
    if m:
        return f"swsh{m.group(1)}.5"
    m = SET_ESCARLATA_PURPURA.match(set_id)
    if not m:
        return set_id
    base = f"{m.group(1)}0{m.group(2)}"
    return f"{base}.{m.group(3)}" if m.group(3) else base


def variantes_de_id(id_api: str) -> list[str]:
    """Formas en que TCGdex puede escribir un id de nuestro catálogo (igual que variantesDeId en TS)."""
    corte = id_api.rfind("-")
    if corte < 0:
        return [id_api]
    set_id = set_de_tcgdex(id_api[:corte])
    numero = id_api[corte + 1 :]
    relleno = numero.zfill(3) if re.fullmatch(r"\d{1,2}", numero) else numero
    return list(dict.fromkeys([id_api, f"{set_id}-{numero}", f"{set_id}-{relleno}"]))


def encontrar_id_tcgdex(id_api: str, conocidos: set[str]) -> str | None:
    for candidato in variantes_de_id(id_api):
        if candidato in conocidos:
            return candidato
    return None


def clasificar(
    ids_db: list[str],
    por_categoria: dict[str, set[str]],
    energias_basicas: set[str],
    por_etapa: dict[str, set[str]],
) -> tuple[dict[str, Clasificacion], list[str]]:
    """Cruza los id_api de la base con las listas de TCGdex.

    Devuelve (clasificaciones por id_api, id_api sin encontrar). Si un id aparece
    en dos categorías (no debería), se deja sin clasificar: es mejor un hueco que
    un dato dudoso.
    """
    todos = set().union(*por_categoria.values()) if por_categoria else set()
    resultado: dict[str, Clasificacion] = {}
    sin_encontrar: list[str] = []

    for id_api in ids_db:
        id_t = encontrar_id_tcgdex(id_api, todos)
        if id_t is None:
            sin_encontrar.append(id_api)
            continue
        categorias = [c for c in CATEGORIAS if id_t in por_categoria.get(c, set())]
        if len(categorias) != 1:
            sin_encontrar.append(id_api)
            continue
        categoria = categorias[0]
        basica = (id_t in energias_basicas) if categoria == "Energy" else None
        stage = None
        if categoria == "Pokemon":
            for etapa_t, ids in por_etapa.items():
                if id_t in ids:
                    stage = ETAPAS[etapa_t]
                    break
        resultado[id_api] = Clasificacion(categoria, basica, stage)

    return resultado, sin_encontrar


def resumen_por_set(sin_encontrar: list[str], todos: list[str]) -> list[tuple[str, int, int]]:
    """(set, sin encontrar, total) de más a menos faltantes. Sirve para ver si faltan sets enteros."""

    def set_de(id_api: str) -> str:
        return id_api.rsplit("-", 1)[0]

    faltan = Counter(set_de(i) for i in sin_encontrar)
    totales = Counter(set_de(i) for i in todos)
    return [(set_id, n, totales[set_id]) for set_id, n in faltan.most_common()]


def pedir_json(url: str) -> list[dict]:
    """GET con tiempo máximo y reintentos. Solo https hacia el host de TCGdex."""
    if not url.startswith(f"https://{HOST_API}/"):
        raise ValueError(f"URL fuera del host permitido: {url}")
    ultimo: Exception | None = None
    for intento in range(REINTENTOS):
        try:
            with urllib.request.urlopen(url, timeout=60) as r:  # noqa: S310 (host fijo, validado arriba)
                datos = json.load(r)
            if not isinstance(datos, list):
                raise ValueError("respuesta inesperada de TCGdex")
            return datos
        except (urllib.error.URLError, TimeoutError, ValueError) as e:
            ultimo = e
            # TCGdex responde 503 de forma intermitente: se espera cada vez más.
            if intento < REINTENTOS - 1:
                espera = min(2 ** (intento + 1), ESPERA_MAXIMA)
                print(f"    TCGdex no respondió ({e}); reintento {intento + 2}/{REINTENTOS} en {espera} s...", flush=True)
                time.sleep(espera)
    raise RuntimeError(f"TCGdex no respondió tras {REINTENTOS} intentos: {ultimo}")


def traer_ids(filtro: str, idioma: str = "en") -> set[str]:
    """Todos los ids de TCGdex (en el idioma dado) que cumplen el filtro, paginando."""
    ids: set[str] = set()
    pagina = 1
    while True:
        url = (
            f"https://{HOST_API}/v2/{idioma}/cards?{filtro}"
            f"&pagination:page={pagina}&pagination:itemsPerPage={PAGINA}"
        )
        lote = pedir_json(url)
        ids.update(c["id"] for c in lote if isinstance(c, dict) and isinstance(c.get("id"), str))
        if len(lote) < PAGINA:
            return ids
        pagina += 1
        time.sleep(PAUSA_ENTRE_PETICIONES)


def leer_ids_db(url: str, password: str) -> list[str]:
    import psycopg

    with psycopg.connect(url, password=password, sslmode="require") as con, con.cursor() as cur:
        cur.execute("select distinct id_api from public.cartas order by id_api")
        return [fila[0] for fila in cur.fetchall()]


def aplicar(clasificadas: dict[str, Clasificacion], url: str, password: str) -> int:
    import psycopg

    with psycopg.connect(url, password=password, sslmode="require") as con, con.cursor() as cur:
        cur.execute(
            "create temp table staging_categorias "
            "(id_api text primary key, categoria text, energia_basica boolean, stage text) on commit drop"
        )
        with cur.copy("copy staging_categorias (id_api, categoria, energia_basica, stage) from stdin") as copy:
            for id_api, c in clasificadas.items():
                copy.write_row((id_api, c.categoria, c.energia_basica, c.stage))

        # categoria y energia_basica se corrigen siempre (TCGdex es la fuente);
        # stage solo se completa donde está vacío.
        cur.execute("""
            update public.cartas
            set categoria = s.categoria,
                energia_basica = s.energia_basica,
                stage = coalesce(cartas.stage, s.stage)
            from staging_categorias s
            where cartas.id_api = s.id_api
              and (cartas.categoria is distinct from s.categoria
                   or cartas.energia_basica is distinct from s.energia_basica
                   or (cartas.stage is null and s.stage is not null));
        """)
        return cur.rowcount


def traer_en_todos_los_idiomas(filtro: str, etiqueta: str) -> set[str]:
    ids: set[str] = set()
    for idioma in IDIOMAS_TCGDEX:
        lote = traer_ids(filtro, idioma)
        print(f"  TCGdex {etiqueta} ({idioma}): {len(lote)} cartas", flush=True)
        ids |= lote
        time.sleep(PAUSA_ENTRE_PETICIONES)
    return ids


def descargar_listas() -> tuple[dict[str, set[str]], set[str], dict[str, set[str]]]:
    por_categoria = {c: traer_en_todos_los_idiomas(f"category={c}", c) for c in CATEGORIAS}
    basicas = traer_en_todos_los_idiomas("category=Energy&energyType=Normal", "energías básicas")
    por_etapa = {e: traer_en_todos_los_idiomas(f"stage={e}", f"etapa {e}") for e in ETAPAS}
    return por_categoria, basicas, por_etapa


def main() -> int:
    parser = argparse.ArgumentParser(description="Completa categoría y etapa de las cartas con datos de TCGdex.")
    parser.add_argument("--dry-run", action="store_true", help="solo reporta, no escribe en la base")
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        print("Falta la variable de entorno SUPABASE_DB_URL.", file=sys.stderr)
        return 1
    if ":" in url.split("://", 1)[-1].split("@", 1)[0]:
        print(
            "SUPABASE_DB_URL incluye la contraseña. Quítala de la cadena: "
            "el script la pide aparte para que no quede en el historial.",
            file=sys.stderr,
        )
        return 1

    password = getpass.getpass("Contraseña de la base de datos: ")
    if not password.isprintable() or password != password.strip():
        print(
            "La contraseña trae caracteres invisibles o espacios en los extremos. "
            "Escríbela a mano o pégala con clic derecho.",
            file=sys.stderr,
        )
        return 1

    ids_db = leer_ids_db(url, password)
    print(f"id_api distintos en la base: {len(ids_db)}")
    print("Consultando TCGdex...")
    por_categoria, basicas, por_etapa = descargar_listas()

    clasificadas, sin_encontrar = clasificar(ids_db, por_categoria, basicas, por_etapa)
    print(f"Clasificados: {len(clasificadas)}")
    print("Por categoría:", dict(Counter(c.categoria for c in clasificadas.values())))
    print("Con etapa que se completaría:", sum(1 for c in clasificadas.values() if c.stage))
    print(f"Sin encontrar en TCGdex (quedan sin categoría): {len(sin_encontrar)}")
    for id_api in sin_encontrar[:10]:
        print(f"  - {id_api}")
    if sin_encontrar:
        print("Sets con más cartas sin encontrar (set: sin encontrar):")
        for set_id, n, total in resumen_por_set(sin_encontrar, ids_db)[:40]:
            print(f"  {set_id}: {n} de {total}")

    # Cinturón de seguridad: si TCGdex devolviera casi nada (caída parcial), no
    # se escribe, para no dar por válido un cruce vacío.
    if len(clasificadas) < len(ids_db) * 0.5:
        print("Menos de la mitad de las cartas se pudo clasificar: no se escribe nada. Revisa TCGdex y reintenta.", file=sys.stderr)
        return 1

    if args.dry_run:
        return 0

    filas = aplicar(clasificadas, url, password)
    print(f"Listo. {filas} filas de cartas actualizadas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
