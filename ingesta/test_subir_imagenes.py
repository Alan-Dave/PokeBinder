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
            # Se sube por id_api, no por el nombre original del archivo.
            self.assertEqual(archivos[0].ruta_bucket, "en/bw10-26.webp")
            self.assertEqual(archivos[0].nombre_en_zip, "images/en/abomasnow_bw10-26.webp")
            self.assertEqual(ignorados, [])

    def test_nombre_con_caracteres_fuera_de_ascii_igual_sube_bien(self):
        # Supabase Storage rechaza rutas con caracteres fuera de ASCII
        # (InvalidKey): 'δ' de Delta Species, acentos, japonés y chino. Como
        # se sube por id_api, esos caracteres nunca llegan a la ruta del
        # bucket. Este es el caso real que falló en la subida a producción.
        with tempfile.TemporaryDirectory() as tmp:
            ruta = os.path.join(tmp, "z.zip")
            crear_zip(
                ruta,
                [
                    "images/en/aerodactyl_δ_ex13-35.webp",
                    "images/en/café_master_swsh9-133.webp",
                    "images/ja/かがやくリザードン_svk-001.webp",
                ],
            )
            archivos, ignorados = listar_archivos(ruta)
            rutas = {a.ruta_bucket for a in archivos}
            self.assertEqual(rutas, {"en/ex13-35.webp", "en/swsh9-133.webp", "ja/svk-001.webp"})
            self.assertEqual(ignorados, [])

    def test_sin_guion_bajo_no_se_puede_separar_el_id_api(self):
        with tempfile.TemporaryDirectory() as tmp:
            ruta = os.path.join(tmp, "z.zip")
            crear_zip(ruta, ["images/en/bw10-26.webp"])  # sin nombre ni "_"
            archivos, ignorados = listar_archivos(ruta)
            self.assertEqual(archivos, [])
            self.assertEqual(ignorados, ["images/en/bw10-26.webp"])

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
