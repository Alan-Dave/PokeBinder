"""Pruebas del listado/filtrado de archivos del zip: python -m unittest discover ingesta"""

import hashlib
import io
import os
import tempfile
import unittest
import urllib.error
import zipfile
from unittest.mock import patch

from subir_imagenes import (
    IDIOMAS,
    Archivo,
    borrar_objetos,
    confirmar_limpieza,
    descargar_zip,
    hash_coincide,
    limpiar_bucket,
    listar_archivos,
    listar_objetos_bucket,
    subir_archivo,
    subir_todos,
)


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

    def test_sin_guion_bajo_en_el_zip_tambien_se_acepta(self):
        # No pasa con los datos reales (el zip siempre trae <nombre>_<id_api>),
        # pero si pasara, el archivo ya sería su propio id_api.
        with tempfile.TemporaryDirectory() as tmp:
            ruta = os.path.join(tmp, "z.zip")
            crear_zip(ruta, ["images/en/bw10-26.webp"])  # sin nombre ni "_"
            archivos, ignorados = listar_archivos(ruta)
            self.assertEqual(len(archivos), 1)
            self.assertEqual(archivos[0].ruta_bucket, "en/bw10-26.webp")
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


class ListarObjetosBucket(unittest.TestCase):
    def test_pagina_hasta_agotar_y_filtra_el_placeholder(self):
        # "en" trae dos páginas (1000 + 1 => sigue pidiendo), el resto vacío.
        pagina_1 = [{"name": f"x{i}.webp"} for i in range(1000)]
        pagina_2 = [{"name": "x1000.webp"}, {"name": ".emptyFolderPlaceholder"}]

        def falso(url, secret_key, cuerpo, metodo):
            if cuerpo["prefix"] != "en/":
                return []
            return pagina_1 if cuerpo["offset"] == 0 else pagina_2

        with patch("subir_imagenes.peticion_json", side_effect=falso) as mock:
            claves = listar_objetos_bucket("https://x.supabase.co", "clave")

        self.assertEqual(len(claves), 1001)  # sin el placeholder
        self.assertIn("en/x0.webp", claves)
        self.assertIn("en/x1000.webp", claves)
        self.assertNotIn("en/.emptyFolderPlaceholder", claves)
        # Una llamada por idioma sin archivos + dos para "en" (paginado).
        self.assertEqual(mock.call_count, len(IDIOMAS) - 1 + 2)


class BorrarObjetos(unittest.TestCase):
    def test_agrupa_en_lotes_de_a_lo_mas_500(self):
        claves = [f"en/{i}.webp" for i in range(1201)]

        with patch("subir_imagenes.peticion_json") as mock:
            borrar_objetos("https://x.supabase.co", "clave", claves)

        self.assertEqual(mock.call_count, 3)  # 500 + 500 + 201
        tamaños = [len(llamada.args[2]["prefixes"]) for llamada in mock.call_args_list]
        self.assertEqual(tamaños, [500, 500, 201])
        self.assertEqual(mock.call_args_list[0].args[3], "DELETE")

    def test_no_llama_a_nada_si_no_hay_claves(self):
        with patch("subir_imagenes.peticion_json") as mock:
            borrar_objetos("https://x.supabase.co", "clave", [])
        mock.assert_not_called()


def error_http(codigo: int, cuerpo: bytes = b"") -> urllib.error.HTTPError:
    return urllib.error.HTTPError("https://x", codigo, "err", {}, io.BytesIO(cuerpo))


class SubirArchivo(unittest.TestCase):
    def preparar_zip(self, tmp):
        ruta = os.path.join(tmp, "z.zip")
        crear_zip(ruta, ["images/en/abomasnow_bw10-26.webp"])
        archivos, _ = listar_archivos(ruta)
        return ruta, archivos[0]

    def test_envia_post_con_upsert_y_clave_en_cabeceras(self):
        with tempfile.TemporaryDirectory() as tmp:
            ruta, archivo = self.preparar_zip(tmp)
            with patch("subir_imagenes.urllib.request.urlopen") as mock:
                resultado = subir_archivo(ruta, archivo, "https://x.supabase.co", "clave")

        self.assertEqual(resultado, (archivo, None))
        peticion = mock.call_args.args[0]
        self.assertEqual(peticion.get_method(), "POST")
        self.assertTrue(peticion.full_url.endswith("/object/Images/en/bw10-26.webp"))
        self.assertEqual(peticion.get_header("X-upsert"), "true")
        self.assertEqual(peticion.get_header("Content-type"), "image/webp")
        self.assertEqual(peticion.get_header("Authorization"), "Bearer clave")

    def test_devuelve_el_motivo_si_supabase_responde_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            ruta, archivo = self.preparar_zip(tmp)
            with patch(
                "subir_imagenes.urllib.request.urlopen", side_effect=error_http(400, b"InvalidKey")
            ):
                _, motivo = subir_archivo(ruta, archivo, "https://x.supabase.co", "clave")

        self.assertIn("HTTP 400", motivo)
        self.assertIn("InvalidKey", motivo)

    def test_devuelve_el_motivo_si_no_hay_conexion(self):
        with tempfile.TemporaryDirectory() as tmp:
            ruta, archivo = self.preparar_zip(tmp)
            with patch(
                "subir_imagenes.urllib.request.urlopen",
                side_effect=urllib.error.URLError("sin red"),
            ):
                _, motivo = subir_archivo(ruta, archivo, "https://x.supabase.co", "clave")

        self.assertEqual(motivo, "sin red")


class SubirTodos(unittest.TestCase):
    def test_junta_solo_los_fallos(self):
        archivos = [Archivo(f"en/{i}.webp", f"images/en/{i}.webp") for i in range(5)]

        def falso(ruta_zip, archivo, url, clave):
            return archivo, ("HTTP 500" if archivo.ruta_bucket == "en/3.webp" else None)

        with patch("subir_imagenes.subir_archivo", side_effect=falso):
            fallos = subir_todos("z.zip", archivos, "https://x", "clave", workers=2)

        self.assertEqual([(a.ruta_bucket, m) for a, m in fallos], [("en/3.webp", "HTTP 500")])


class Integridad(unittest.TestCase):
    def test_hash_coincide_ignora_mayusculas_y_espacios(self):
        self.assertTrue(hash_coincide("abc123", " ABC123\n"))
        self.assertFalse(hash_coincide("abc123", "abc124"))

    def test_descargar_zip_devuelve_el_sha256_del_contenido(self):
        contenido = b"contenido de prueba"
        with tempfile.TemporaryDirectory() as tmp:
            destino = os.path.join(tmp, "Images.zip")
            with patch("subir_imagenes.urllib.request.urlopen", return_value=io.BytesIO(contenido)):
                obtenido = descargar_zip(destino)
            with open(destino, "rb") as f:
                guardado = f.read()

        self.assertEqual(obtenido, hashlib.sha256(contenido).hexdigest())
        self.assertEqual(guardado, contenido)


class Limpieza(unittest.TestCase):
    def test_confirmar_exige_escribir_el_nombre_del_bucket(self):
        with patch("builtins.input", return_value="Images"):
            self.assertTrue(confirmar_limpieza(10, sin_preguntar=False))
        with patch("builtins.input", return_value="si"):
            self.assertFalse(confirmar_limpieza(10, sin_preguntar=False))

    def test_yes_no_pregunta(self):
        with patch("builtins.input") as mock:
            self.assertTrue(confirmar_limpieza(10, sin_preguntar=True))
        mock.assert_not_called()

    def test_no_borra_si_el_usuario_cancela(self):
        with (
            patch("subir_imagenes.listar_objetos_bucket", return_value=["en/a.webp"]),
            patch("subir_imagenes.borrar_objetos") as borrar,
            patch("builtins.input", return_value="no"),
        ):
            codigo = limpiar_bucket("https://x", "clave", sin_preguntar=False)

        self.assertEqual(codigo, 1)
        borrar.assert_not_called()

    def test_borra_con_yes(self):
        with (
            patch("subir_imagenes.listar_objetos_bucket", return_value=["en/a.webp"]),
            patch("subir_imagenes.borrar_objetos") as borrar,
        ):
            codigo = limpiar_bucket("https://x", "clave", sin_preguntar=True)

        self.assertEqual(codigo, 0)
        borrar.assert_called_once()

    def test_error_http_da_mensaje_y_codigo_1_sin_traceback(self):
        with patch("subir_imagenes.listar_objetos_bucket", side_effect=error_http(401, b"bad key")):
            codigo = limpiar_bucket("https://x", "clave", sin_preguntar=True)
        self.assertEqual(codigo, 1)

    def test_error_de_red_da_codigo_1(self):
        with patch(
            "subir_imagenes.listar_objetos_bucket", side_effect=urllib.error.URLError("sin red")
        ):
            codigo = limpiar_bucket("https://x", "clave", sin_preguntar=True)
        self.assertEqual(codigo, 1)


if __name__ == "__main__":
    unittest.main()
