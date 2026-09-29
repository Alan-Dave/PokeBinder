"""Pruebas del emparejado imagen-carta: python -m unittest discover ingesta"""

import unittest

from emparejar_imagenes import buscar_colisiones, emparejar, separar_id_api, Emparejado

CARTAS = {
    ("en", "bw10-26"): 1,
    ("fr", "pl3-1"): 2,
    ("fr", "ex11-1"): 3,
    ("es", "tk-xy-su-1"): 4,
}


class SepararIdApi(unittest.TestCase):
    def test_caso_simple(self):
        self.assertEqual(separar_id_api("abomasnow_bw10-26.webp"), "bw10-26")

    def test_nombre_con_varias_palabras(self):
        self.assertEqual(separar_id_api("aarons_collection_pl2-88.webp"), "pl2-88")

    def test_guion_bajo_doble_por_formato_del_origen(self):
        # El nombre real es "Absol", pero el archivo trae un guion bajo de más.
        # No importa: separar_id_api solo mira lo que sigue al ÚLTIMO guion bajo.
        self.assertEqual(separar_id_api("absol__pl3-1.webp"), "pl3-1")

    def test_id_api_con_varios_guiones_medios(self):
        self.assertEqual(separar_id_api("energia_agua_tk-xy-su-1.webp"), "tk-xy-su-1")

    def test_sin_guion_bajo_no_se_puede_separar(self):
        self.assertIsNone(separar_id_api("bw10-26.webp"))

    def test_extension_distinta_se_ignora(self):
        self.assertIsNone(separar_id_api("abomasnow_bw10-26.png"))


class Emparejar(unittest.TestCase):
    def test_empareja_por_idioma_e_id_api(self):
        emparejados, sin_emparejar = emparejar(["en/abomasnow_bw10-26.webp"], CARTAS)
        self.assertEqual(emparejados, [Emparejado(carta_id=1, path="en/abomasnow_bw10-26.webp")])
        self.assertEqual(sin_emparejar, [])

    def test_mismo_id_api_en_otro_idioma_no_es_el_mismo(self):
        # bw10-26 solo existe en "en" dentro de CARTAS; en "es" no debe emparejar.
        _, sin_emparejar = emparejar(["es/abomasnow_bw10-26.webp"], CARTAS)
        self.assertEqual(len(sin_emparejar), 1)

    def test_idioma_desconocido_queda_sin_emparejar(self):
        _, sin_emparejar = emparejar(["de/abomasnow_bw10-26.webp"], CARTAS)
        self.assertEqual(len(sin_emparejar), 1)

    def test_ruta_sin_carpeta_de_idioma_queda_sin_emparejar(self):
        _, sin_emparejar = emparejar(["abomasnow_bw10-26.webp"], CARTAS)
        self.assertEqual(len(sin_emparejar), 1)

    def test_id_api_que_no_existe_en_el_catalogo_queda_sin_emparejar(self):
        _, sin_emparejar = emparejar(["en/abomasnow_bw99-1.webp"], CARTAS)
        self.assertEqual(len(sin_emparejar), 1)

    def test_guion_bajo_doble_igual_se_empareja(self):
        emparejados, sin_emparejar = emparejar(["fr/absol__pl3-1.webp"], CARTAS)
        self.assertEqual(emparejados, [Emparejado(carta_id=2, path="fr/absol__pl3-1.webp")])
        self.assertEqual(sin_emparejar, [])


class BuscarColisiones(unittest.TestCase):
    def test_sin_colisiones(self):
        emparejados = [Emparejado(1, "en/a.webp"), Emparejado(2, "fr/b.webp")]
        self.assertEqual(buscar_colisiones(emparejados), [])

    def test_dos_archivos_a_la_misma_carta_es_colision(self):
        emparejados = [Emparejado(1, "en/a.webp"), Emparejado(1, "en/b.webp")]
        colisiones = buscar_colisiones(emparejados)
        self.assertEqual(len(colisiones), 1)
        self.assertIn("en/a.webp", colisiones[0])
        self.assertIn("en/b.webp", colisiones[0])


if __name__ == "__main__":
    unittest.main()
