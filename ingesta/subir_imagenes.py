"""Sube las imágenes del catálogo al bucket privado Images de Supabase Storage.

Descarga el zip publicado en el release "images" del repositorio de GitHub
(no hace falta tenerlo descargado a mano) y sube cada archivo a
<idioma>/<id_api>.webp, con x-upsert para que se pueda correr más de una vez
sin duplicar nada. Después de esto corre ingesta/emparejar_imagenes.py, que es
quien llena cartas.imagen_path a partir de lo que quedó en el bucket.

Se sube por id_api y no con el nombre original del archivo (que trae el
nombre de la carta) porque Supabase Storage rechaza rutas con caracteres
fuera de ASCII (InvalidKey): hay cartas con 'δ' (Delta Species), acentos, o
el nombre completo en japonés/chino. id_api nunca tiene esos caracteres.

No usa ninguna librería fuera de la estándar: solo urllib, zipfile y
concurrent.futures. No hace falta instalar nada nuevo.

Uso (PowerShell):

    # 1. Revisar qué se subiría, sin tocar el bucket
    python ingesta/subir_imagenes.py --dry-run

    # 2. Probar con pocos archivos antes de subir todo
    $env:SUPABASE_URL = "https://<ref>.supabase.co"
    $env:SUPABASE_SECRET_KEY = "sb_secret_..."
    python ingesta/subir_imagenes.py --limit 20

    # 3. Subir todo
    python ingesta/subir_imagenes.py
"""

import argparse
import os
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass

from emparejar_imagenes import separar_id_api

RELEASE_URL = (
    "https://github.com/Alan-Dave/PokeBinder/releases/download/images/Images.zip"
)
BUCKET = "Images"
IDIOMAS = {"en", "es", "fr", "pt", "ja", "zh"}
CONTENT_TYPE = "image/webp"  # único tipo permitido por el bucket


@dataclass(frozen=True)
class Archivo:
    ruta_bucket: str  # "en/abomasnow_bw10-26.webp"
    nombre_en_zip: str  # "images/en/abomasnow_bw10-26.webp"


def descargar_zip(destino: str) -> None:
    print(f"Descargando {RELEASE_URL} ...")
    total = 0
    with urllib.request.urlopen(RELEASE_URL, timeout=60) as resp, open(destino, "wb") as f:
        while chunk := resp.read(1024 * 1024):
            f.write(chunk)
            total += len(chunk)
            if total % (50 * 1024 * 1024) < len(chunk):
                print(f"  {total / (1024 * 1024):.0f} MB")
    print(f"Descarga completa: {total / (1024 * 1024):.0f} MB")


def listar_archivos(ruta_zip: str) -> tuple[list[Archivo], list[str]]:
    """Separa las entradas del zip que son imágenes válidas de las que no."""
    archivos: list[Archivo] = []
    ignorados: list[str] = []

    with zipfile.ZipFile(ruta_zip) as zf:
        for nombre in zf.namelist():
            if nombre.endswith("/"):
                continue  # carpeta, no un archivo

            partes = nombre.split("/")
            # Se espera "images/<idioma>/<archivo>.webp".
            if len(partes) != 3 or partes[0] != "images" or not partes[2].endswith(".webp"):
                ignorados.append(nombre)
                continue
            if partes[1] not in IDIOMAS:
                ignorados.append(nombre)
                continue

            id_api = separar_id_api(partes[2])
            if id_api is None:
                ignorados.append(nombre)
                continue

            # Se sube como <idioma>/<id_api>.webp, no con el nombre original:
            # Supabase Storage rechaza rutas con caracteres fuera de ASCII
            # (InvalidKey), y hay cartas con 'δ' (Delta Species) o nombre
            # completo en japonés/chino. id_api nunca tiene esos caracteres
            # (lo valida migrar_catalogo.normalizar_fila), y de todos modos
            # es lo único que separar_id_api usa para emparejar después.
            archivos.append(Archivo(ruta_bucket=f"{partes[1]}/{id_api}.webp", nombre_en_zip=nombre))

    return archivos, ignorados


def subir_archivo(
    ruta_zip: str, archivo: Archivo, supabase_url: str, secret_key: str
) -> tuple[Archivo, str | None]:
    """Devuelve (archivo, None) si subió bien, o (archivo, motivo) si falló."""
    with zipfile.ZipFile(ruta_zip) as zf:
        contenido = zf.read(archivo.nombre_en_zip)

    url = f"{supabase_url}/storage/v1/object/{BUCKET}/{urllib.parse.quote(archivo.ruta_bucket)}"
    peticion = urllib.request.Request(
        url,
        data=contenido,
        method="POST",
        headers={
            "Authorization": f"Bearer {secret_key}",
            "apikey": secret_key,
            "Content-Type": CONTENT_TYPE,
            "x-upsert": "true",
        },
    )
    try:
        with urllib.request.urlopen(peticion, timeout=30) as resp:
            resp.read()
        return archivo, None
    except urllib.error.HTTPError as error:
        return archivo, f"HTTP {error.code}: {error.read().decode(errors='replace')[:200]}"
    except urllib.error.URLError as error:
        return archivo, str(error.reason)


def subir_todos(
    ruta_zip: str, archivos: list[Archivo], supabase_url: str, secret_key: str, workers: int
) -> list[tuple[Archivo, str]]:
    fallos: list[tuple[Archivo, str]] = []
    completados = 0

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futuros = {
            pool.submit(subir_archivo, ruta_zip, a, supabase_url, secret_key): a for a in archivos
        }
        for futuro in as_completed(futuros):
            archivo, error = futuro.result()
            completados += 1
            if error:
                fallos.append((archivo, error))
            if completados % 500 == 0 or completados == len(archivos):
                print(f"  {completados}/{len(archivos)} ({len(fallos)} fallos hasta ahora)")

    return fallos


def main() -> int:
    parser = argparse.ArgumentParser(description="Sube las imágenes del catálogo al bucket Images.")
    parser.add_argument("--dry-run", action="store_true", help="solo reporta, no descarga ni sube")
    parser.add_argument("--limit", type=int, help="sube como máximo N archivos (para probar)")
    parser.add_argument("--workers", type=int, default=16, help="subidas en paralelo (default 16)")
    args = parser.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        ruta_zip = os.path.join(tmp, "Images.zip")
        descargar_zip(ruta_zip)

        archivos, ignorados = listar_archivos(ruta_zip)
        print(f"Archivos a subir: {len(archivos)}")
        print(f"Ignorados (no son <idioma>/archivo.webp): {len(ignorados)}")
        for nombre in ignorados[:20]:
            print(f"  - {nombre}")

        if args.limit:
            archivos = archivos[: args.limit]
            print(f"--limit: se sube solo los primeros {len(archivos)}")

        if args.dry_run:
            return 0

        supabase_url = os.environ.get("SUPABASE_URL")
        secret_key = os.environ.get("SUPABASE_SECRET_KEY")
        if not supabase_url or not secret_key:
            print(
                "Faltan las variables de entorno SUPABASE_URL y/o SUPABASE_SECRET_KEY.",
                file=sys.stderr,
            )
            return 1

        fallos = subir_todos(ruta_zip, archivos, supabase_url, secret_key, args.workers)

        print(f"Subidos: {len(archivos) - len(fallos)}")
        print(f"Fallos: {len(fallos)}")
        for archivo, motivo in fallos[:20]:
            print(f"  - {archivo.ruta_bucket}: {motivo}")

    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
