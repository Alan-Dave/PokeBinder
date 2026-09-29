"""Empareja los archivos del bucket Images con sus cartas y llena cartas.imagen_path.

Se conecta directo a Postgres (igual que migrar_catalogo.py) y lee storage.objects,
así que no necesita la clave secreta de la API de Storage.

Cómo empareja: el nombre de archivo es <nombre_slug>_<id_api>.webp. nombre_slug
puede no coincidir exactamente con la columna nombre (mayúsculas, acentos,
puntuación del origen), así que no se reconstruye. En cambio, id_api nunca
tiene guion bajo (siempre lleva guion medio, ver migrar_catalogo.normalizar_fila),
así que lo que queda después del ÚLTIMO guion bajo del archivo es el id_api
exacto. Con eso se busca la carta por (idioma, id_api), sin tocar el nombre.

Uso (PowerShell):

    python ingesta/emparejar_imagenes.py --dry-run

    $env:SUPABASE_DB_URL = "postgresql://postgres.<ref>@<host>.pooler.supabase.com:5432/postgres"
    python ingesta/emparejar_imagenes.py

Se puede ejecutar más de una vez: dos pasadas seguidas producen el mismo
resultado. Si un archivo deja de existir en el bucket, la siguiente pasada le
quita la ruta a la carta que lo tenía.
"""

import argparse
import getpass
import os
import sys
from collections import Counter
from dataclasses import dataclass

BUCKET = "Images"
IDIOMAS = {"en", "es", "fr", "pt", "ja", "zh"}


@dataclass(frozen=True)
class Emparejado:
    carta_id: int
    path: str


def separar_id_api(nombre_archivo: str) -> str | None:
    """De 'abomasnow_bw10-26.webp' devuelve 'bw10-26'.

    id_api nunca lleva guion bajo, así que no importa cuántos traiga el resto
    del nombre (por espacios o por una carta con nombre repetido): el id_api
    es siempre lo que queda después del último guion bajo.
    """
    if not nombre_archivo.endswith(".webp"):
        return None
    sin_extension = nombre_archivo[: -len(".webp")]
    if "_" not in sin_extension:
        return None
    return sin_extension.rsplit("_", 1)[1]


def emparejar(
    objetos: list[str], cartas: dict[tuple[str, str], int]
) -> tuple[list[Emparejado], list[str]]:
    """objetos: rutas tal como están en storage.objects.name, ej. 'en/x.webp'.
    cartas: (idioma, id_api) -> id de la carta, ya cargado desde la base.
    """
    emparejados: list[Emparejado] = []
    sin_emparejar: list[str] = []

    for path in objetos:
        partes = path.split("/", 1)
        if len(partes) != 2:
            sin_emparejar.append(f"{path}: no tiene la forma <idioma>/<archivo>")
            continue

        idioma, archivo = partes
        if idioma not in IDIOMAS:
            sin_emparejar.append(f"{path}: idioma desconocido '{idioma}'")
            continue

        id_api = separar_id_api(archivo)
        if id_api is None:
            sin_emparejar.append(f"{path}: no se pudo extraer el id_api")
            continue

        carta_id = cartas.get((idioma, id_api))
        if carta_id is None:
            sin_emparejar.append(f"{path}: ninguna carta con id_api '{id_api}' en '{idioma}'")
            continue

        emparejados.append(Emparejado(carta_id=carta_id, path=path))

    return emparejados, sin_emparejar


def buscar_colisiones(emparejados: list[Emparejado]) -> list[str]:
    """Dos archivos distintos no deberían apuntar a la misma carta."""
    por_carta: dict[int, list[str]] = {}
    for e in emparejados:
        por_carta.setdefault(e.carta_id, []).append(e.path)
    return [
        f"carta {carta_id}: {', '.join(paths)}"
        for carta_id, paths in por_carta.items()
        if len(paths) > 1
    ]


def leer_origen(url: str, password: str) -> tuple[list[str], dict[tuple[str, str], int]]:
    import psycopg

    with psycopg.connect(url, password=password, sslmode="require") as con, con.cursor() as cur:
        cur.execute("select name from storage.objects where bucket_id = %s", (BUCKET,))
        objetos = [fila[0] for fila in cur.fetchall() if not fila[0].endswith("/")]

        cur.execute("select id, idioma, id_api from public.cartas")
        cartas = {(idioma, id_api): id for id, idioma, id_api in cur.fetchall()}

    return objetos, cartas


def aplicar(emparejados: list[Emparejado], url: str, password: str) -> None:
    import psycopg

    with psycopg.connect(url, password=password, sslmode="require") as con, con.cursor() as cur:
        cur.execute("create temp table staging_imagenes (carta_id bigint, path text) on commit drop")
        with cur.copy("copy staging_imagenes (carta_id, path) from stdin") as copy:
            for e in emparejados:
                copy.write_row((e.carta_id, e.path))

        cur.execute("""
            update public.cartas
            set imagen_path = staging_imagenes.path
            from staging_imagenes
            where cartas.id = staging_imagenes.carta_id
              and cartas.imagen_path is distinct from staging_imagenes.path;
        """)
        cur.execute("""
            update public.cartas
            set imagen_path = null
            where imagen_path is not null
              and id not in (select carta_id from staging_imagenes);
        """)
        # commit implícito al salir del `with` sin errores.


def main() -> int:
    parser = argparse.ArgumentParser(description="Empareja imágenes del bucket con sus cartas.")
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

    objetos, cartas = leer_origen(url, password)
    emparejados, sin_emparejar = emparejar(objetos, cartas)
    colisiones = buscar_colisiones(emparejados)

    print(f"Archivos en el bucket: {len(objetos)}")
    print(f"Cartas en el catálogo: {len(cartas)}")
    print(f"Emparejados: {len(emparejados)}")
    print("Por idioma:", dict(sorted(Counter(p.split('/', 1)[0] for p in objetos).items())))
    print(f"Sin emparejar: {len(sin_emparejar)}")
    for motivo in sin_emparejar:
        print(f"  - {motivo}")
    if colisiones:
        # No debería pasar nunca: id_api es único por idioma. Si aparece, es
        # una carta duplicada en la base o dos archivos con el mismo sufijo.
        print(f"Colisiones (revisar a mano, no se aplican): {len(colisiones)}")
        for c in colisiones:
            print(f"  - {c}")
        return 1

    if args.dry_run:
        return 0

    aplicar(emparejados, url, password)
    print(f"Listo. {len(emparejados)} cartas quedaron con imagen_path.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
