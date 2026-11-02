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

    $env:SUPABASE_URL = "https://<ref>.supabase.co"
    $env:SUPABASE_SECRET_KEY = "sb_secret_..."

    # 2. Si el bucket ya tiene archivos de una corrida anterior con otro
    #    esquema de nombres, hay que vaciarlo primero (termina ahí, no sube).
    #    Pide confirmación; --yes la omite.
    python ingesta/subir_imagenes.py --limpiar

    # 3. Probar con pocos archivos antes de subir todo
    python ingesta/subir_imagenes.py --limit 20

    # 4. Subir todo. Cada corrida imprime el SHA-256 del zip; para verificar
    #    que no cambió, pásalo con --sha256 o IMAGES_ZIP_SHA256.
    python ingesta/subir_imagenes.py --sha256 <hash>
"""

import argparse
import hashlib
import json
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
LOTE_BORRADO = 500  # objetos por llamada al borrar; la API no documenta un máximo


@dataclass(frozen=True)
class Archivo:
    ruta_bucket: str  # "en/abomasnow_bw10-26.webp"
    nombre_en_zip: str  # "images/en/abomasnow_bw10-26.webp"


def descargar_zip(destino: str) -> str:
    """Descarga el zip y devuelve su SHA-256 en hexadecimal."""
    print(f"Descargando {RELEASE_URL} ...")
    total = 0
    hash_zip = hashlib.sha256()
    with urllib.request.urlopen(RELEASE_URL, timeout=60) as resp, open(destino, "wb") as f:
        while chunk := resp.read(1024 * 1024):
            f.write(chunk)
            hash_zip.update(chunk)
            total += len(chunk)
            if total % (50 * 1024 * 1024) < len(chunk):
                print(f"  {total / (1024 * 1024):.0f} MB")
    print(f"Descarga completa: {total / (1024 * 1024):.0f} MB")
    return hash_zip.hexdigest()


def hash_coincide(obtenido: str, esperado: str) -> bool:
    return obtenido.lower() == esperado.strip().lower()


def confirmar_limpieza(cantidad: int, sin_preguntar: bool) -> bool:
    """Pide escribir el nombre del bucket antes de borrar, salvo con --yes."""
    if sin_preguntar:
        return True
    respuesta = input(f"Se borrarán {cantidad} objetos del bucket. Escribe '{BUCKET}' para confirmar: ")
    return respuesta.strip() == BUCKET


def credenciales() -> tuple[str, str] | None:
    supabase_url = os.environ.get("SUPABASE_URL")
    secret_key = os.environ.get("SUPABASE_SECRET_KEY")
    if not supabase_url or not secret_key:
        print(
            "Faltan las variables de entorno SUPABASE_URL y/o SUPABASE_SECRET_KEY.",
            file=sys.stderr,
        )
        return None
    return supabase_url, secret_key


def limpiar_bucket(supabase_url: str, secret_key: str, sin_preguntar: bool) -> int:
    try:
        print("Listando lo que hay en el bucket...")
        claves = listar_objetos_bucket(supabase_url, secret_key)
        print(f"Objetos a borrar: {len(claves)}")
        if not claves:
            return 0
        if not confirmar_limpieza(len(claves), sin_preguntar):
            print("Cancelado, no se borró nada.")
            return 1
        borrar_objetos(supabase_url, secret_key, claves)
    except urllib.error.HTTPError as error:
        detalle = error.read().decode(errors="replace")[:200]
        print(f"Supabase respondió HTTP {error.code}: {detalle}", file=sys.stderr)
        return 1
    except urllib.error.URLError as error:
        print(f"No se pudo conectar con Supabase: {error.reason}", file=sys.stderr)
        return 1
    print("Bucket vacío. Corre el script de nuevo sin --limpiar para subir las imágenes.")
    return 0


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


def peticion_json(url: str, secret_key: str, cuerpo: dict, metodo: str) -> object:
    datos = json.dumps(cuerpo).encode()
    peticion = urllib.request.Request(
        url,
        data=datos,
        method=metodo,
        headers={
            "Authorization": f"Bearer {secret_key}",
            "apikey": secret_key,
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(peticion, timeout=30) as resp:
        return json.loads(resp.read())


def listar_objetos_bucket(supabase_url: str, secret_key: str) -> list[str]:
    """Todas las rutas (<idioma>/<archivo>) que hoy existen en el bucket."""
    claves: list[str] = []
    for idioma in sorted(IDIOMAS):
        offset = 0
        encontrados_idioma = 0
        while True:
            url = f"{supabase_url}/storage/v1/object/list/{BUCKET}"
            cuerpo = {
                "prefix": f"{idioma}/",
                "limit": 1000,
                "offset": offset,
                "sortBy": {"column": "name", "order": "asc"},
            }
            pagina = peticion_json(url, secret_key, cuerpo, "POST")
            for objeto in pagina:
                # Los "placeholder" de carpeta vacía no son imágenes reales.
                if objeto["name"] != ".emptyFolderPlaceholder":
                    claves.append(f"{idioma}/{objeto['name']}")
            encontrados_idioma += len(pagina)
            print(f"  {idioma}: {encontrados_idioma} revisados hasta ahora")
            if len(pagina) < 1000:
                break
            offset += 1000
    return claves


def borrar_objetos(supabase_url: str, secret_key: str, claves: list[str]) -> None:
    url = f"{supabase_url}/storage/v1/object/{BUCKET}"
    for i in range(0, len(claves), LOTE_BORRADO):
        lote = claves[i : i + LOTE_BORRADO]
        peticion_json(url, secret_key, {"prefixes": lote}, "DELETE")
        print(f"  borrados {min(i + LOTE_BORRADO, len(claves))}/{len(claves)}")


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
    parser.add_argument(
        "--limpiar",
        action="store_true",
        help="borra todo el contenido del bucket y termina, sin subir nada",
    )
    parser.add_argument(
        "--yes", action="store_true", help="con --limpiar, no pide confirmación antes de borrar"
    )
    parser.add_argument(
        "--sha256",
        default=os.environ.get("IMAGES_ZIP_SHA256"),
        help="SHA-256 esperado del zip (o variable IMAGES_ZIP_SHA256); si no coincide, aborta",
    )
    args = parser.parse_args()

    if args.limpiar:
        claves_acceso = credenciales()
        if claves_acceso is None:
            return 1
        return limpiar_bucket(*claves_acceso, sin_preguntar=args.yes)

    with tempfile.TemporaryDirectory() as tmp:
        ruta_zip = os.path.join(tmp, "Images.zip")
        hash_obtenido = descargar_zip(ruta_zip)
        print(f"SHA-256 del zip: {hash_obtenido}")
        if args.sha256:
            if not hash_coincide(hash_obtenido, args.sha256):
                print("El SHA-256 del zip no coincide con el esperado. No se sube nada.", file=sys.stderr)
                return 1
            print("SHA-256 verificado.")
        else:
            print("Aviso: no se indicó --sha256, la integridad del zip no se verificó.")

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

        claves_acceso = credenciales()
        if claves_acceso is None:
            return 1
        supabase_url, secret_key = claves_acceso

        fallos = subir_todos(ruta_zip, archivos, supabase_url, secret_key, args.workers)

        print(f"Subidos: {len(archivos) - len(fallos)}")
        print(f"Fallos: {len(fallos)}")
        for archivo, motivo in fallos[:20]:
            print(f"  - {archivo.ruta_bucket}: {motivo}")

    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
