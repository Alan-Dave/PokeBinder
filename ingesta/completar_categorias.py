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
PAGINA = 5000
REINTENTOS = 4
PAUSA_ENTRE_PETICIONES = 0.3

CATEGORIAS = ("Pokemon", "Trainer", "Energy")
# Etapa de TCGdex -> forma en que el catálogo ya la guarda ('Stage 1', no 'Stage1').
ETAPAS = {"Basic": "Basic", "Baby": "Baby", "Stage1": "Stage 1", "Stage2": "Stage 2"}

# Mismos sets de Escarlata y Púrpura que lib/precios-carta.ts: sv2 -> sv02,
# sv4pt5 -> sv04.5. Solo se traducen estos; adivinar otro cruzaría cartas ajenas.
SET_ESCARLATA_PURPURA = re.compile(r"^sv(\d)(?:pt(\d))?$")


@dataclass(frozen=True)
class Clasificacion:
    categoria: str
    energia_basica: bool | None
    stage: str | None


def set_de_tcgdex(set_id: str) -> str:
    m = SET_ESCARLATA_PURPURA.match(set_id)
    if not m:
        return set_id
    return f"sv0{m.group(1)}.{m.group(2)}" if m.group(2) else f"sv0{m.group(1)}"


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
            time.sleep(2**intento)
    raise RuntimeError(f"TCGdex no respondió tras {REINTENTOS} intentos: {ultimo}")


def traer_ids(filtro: str) -> set[str]:
    """Todos los ids de TCGdex (en) que cumplen el filtro, paginando."""
    ids: set[str] = set()
    pagina = 1
    while True:
        url = (
            f"https://{HOST_API}/v2/en/cards?{filtro}"
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


def descargar_listas() -> tuple[dict[str, set[str]], set[str], dict[str, set[str]]]:
    por_categoria = {}
    for c in CATEGORIAS:
        por_categoria[c] = traer_ids(f"category={c}")
        print(f"  TCGdex {c}: {len(por_categoria[c])} cartas")
        time.sleep(PAUSA_ENTRE_PETICIONES)
    basicas = traer_ids("category=Energy&energyType=Normal")
    print(f"  TCGdex energías básicas: {len(basicas)}")
    por_etapa = {}
    for etapa in ETAPAS:
        por_etapa[etapa] = traer_ids(f"stage={etapa}")
        print(f"  TCGdex etapa {etapa}: {len(por_etapa[etapa])} cartas")
        time.sleep(PAUSA_ENTRE_PETICIONES)
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
    for id_api in sin_encontrar[:30]:
        print(f"  - {id_api}")
    if len(sin_encontrar) > 30:
        print(f"  ... y {len(sin_encontrar) - 30} más")

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
