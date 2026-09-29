"""Pruebas del listado/filtrado de archivos del zip: python -m unittest discover ingesta"""

import os
import tempfile
import unittest
import zipfile

from subir_imagenes import listar_archivos


def crear_zip(ruta: str, nombres: list[str]) -> None:
    with zipfile.ZipFile(ruta, "w") as zf:
        for nombre in nombres:
            if nombre.endswith("/"):
                zf.writestr(zipfile.ZipInfo(nombre), "")
            else:
                zf.writestr(nombre, b"contenido")


class ListarArchivos(unittest.TestCase):
    def test_acepta_la_forma_esperada(self):
        with tempfile.TemporaryDirectory() as tmp:
            ruta = os.path.join(tmp, "z.zip")
            crear_zip(ruta, ["images/en/abomasnow_bw10-26.webp"])
            archivos, ignorados = listar_archivos(ruta)
            self.assertEqual(len(archivos), 1)
            self.assertEqual(archivos[0].ruta_bucket, "en/abomasnow_bw10-26.webp")
            self.assertEqual(archivos[0].nombre_en_zip, "images/en/abomasnow_bw10-26.webp")
            self.assertEqual(ignorados, [])

    def test_ignora_las_carpetas(self):
        with tempfile.TemporaryDirectory() as tmp:
            ruta = os.path.join(tmp, "z.zip")
            crear_zip(ruta, ["images/", "images/en/", "images/en/a_bw10-26.webp"])
            archivos, ignorados = listar_archivos(ruta)
            self.assertEqual(len(archivos), 1)
            self.assertEqual(ignorados, [])

    def test_ignora_idioma_desconocido(self):
        with tempfile.TemporaryDirectory() as tmp:
            ruta = os.path.join(tmp, "z.zip")
            crear_zip(ruta, ["images/de/a_bw10-26.webp"])
            archivos, ignorados = listar_archivos(ruta)
            self.assertEqual(archivos, [])
            self.assertEqual(ignorados, ["images/de/a_bw10-26.webp"])

    def test_ignora_extension_distinta(self):
        with tempfile.TemporaryDirectory() as tmp:
            ruta = os.path.join(tmp, "z.zip")
            crear_zip(ruta, ["images/en/a_bw10-26.png"])
            archivos, ignorados = listar_archivos(ruta)
            self.assertEqual(archivos, [])
            self.assertEqual(ignorados, ["images/en/a_bw10-26.png"])

    def test_ignora_ruta_con_profundidad_distinta(self):
        with tempfile.TemporaryDirectory() as tmp:
            ruta = os.path.join(tmp, "z.zip")
            crear_zip(ruta, ["readme.webp", "images/en/sets/a_bw10-26.webp"])
            archivos, ignorados = listar_archivos(ruta)
            self.assertEqual(archivos, [])
            self.assertEqual(len(ignorados), 2)


if __name__ == "__main__":
    unittest.main()
