"""Pruebas de completar_categorias: python -m unittest discover ingesta"""

import unittest

from completar_categorias import Clasificacion, clasificar, encontrar_id_tcgdex, resumen_por_set, variantes_de_id

POKEMON = {"swsh1-1", "sv02-011", "sv04.5-101", "base1-4"}
TRAINER = {"swsh1-163", "sv10-060"}
ENERGY = {"base1-98", "sv01-257", "swsh1-230"}
CATEGORIAS = {"Pokemon": POKEMON, "Trainer": TRAINER, "Energy": ENERGY}
BASICAS = {"base1-98", "sv01-257"}
ETAPAS = {"Basic": {"swsh1-1", "sv02-011"}, "Baby": set(), "Stage1": {"sv04.5-101"}, "Stage2": set()}


class VariantesDeId(unittest.TestCase):
    def test_id_sin_cambios_va_primero(self):
        self.assertEqual(variantes_de_id("swsh1-1")[0], "swsh1-1")

    def test_rellena_el_numero_con_ceros(self):
        self.assertIn("sv10-060", variantes_de_id("sv10-60"))
        self.assertIn("swsh11-043", variantes_de_id("swsh11-43"))

    def test_traduce_los_sets_de_escarlata_y_purpura(self):
        self.assertIn("sv02-011", variantes_de_id("sv2-11"))
        self.assertIn("sv04.5-101", variantes_de_id("sv4pt5-101"))

    def test_no_traduce_otros_sets(self):
        self.assertEqual(variantes_de_id("swsh10.5tg-TG01"), ["swsh10.5tg-TG01"])

    def test_id_sin_guion(self):
        self.assertEqual(variantes_de_id("raro"), ["raro"])


class EncontrarId(unittest.TestCase):
    def test_prefiere_el_id_tal_cual(self):
        self.assertEqual(encontrar_id_tcgdex("swsh1-1", {"swsh1-1", "swsh1-001"}), "swsh1-1")

    def test_usa_la_variante_si_el_original_no_existe(self):
        self.assertEqual(encontrar_id_tcgdex("sv10-60", {"sv10-060"}), "sv10-060")

    def test_none_si_ninguna_existe(self):
        self.assertIsNone(encontrar_id_tcgdex("zzz-1", {"swsh1-1"}))


class Clasificar(unittest.TestCase):
    def correr(self, ids):
        return clasificar(ids, CATEGORIAS, BASICAS, ETAPAS)

    def test_pokemon_con_etapa(self):
        res, sin = self.correr(["swsh1-1", "sv4pt5-101"])
        self.assertEqual(res["swsh1-1"], Clasificacion("Pokemon", None, "Basic"))
        self.assertEqual(res["sv4pt5-101"], Clasificacion("Pokemon", None, "Stage 1"))
        self.assertEqual(sin, [])

    def test_pokemon_sin_etapa_en_tcgdex_queda_sin_etapa(self):
        res, _ = self.correr(["base1-4"])
        self.assertEqual(res["base1-4"], Clasificacion("Pokemon", None, None))

    def test_entrenador_no_lleva_etapa_ni_energia_basica(self):
        res, _ = self.correr(["swsh1-163", "sv10-60"])
        self.assertEqual(res["swsh1-163"], Clasificacion("Trainer", None, None))
        self.assertEqual(res["sv10-60"], Clasificacion("Trainer", None, None))

    def test_energia_basica_y_especial(self):
        res, _ = self.correr(["base1-98", "swsh1-230"])
        self.assertEqual(res["base1-98"], Clasificacion("Energy", True, None))
        self.assertEqual(res["swsh1-230"], Clasificacion("Energy", False, None))

    def test_lo_que_tcgdex_no_trae_se_reporta_y_no_se_inventa(self):
        res, sin = self.correr(["nombre-raro-1"])
        self.assertEqual(res, {})
        self.assertEqual(sin, ["nombre-raro-1"])

    def test_id_en_dos_categorias_queda_sin_clasificar(self):
        dudosas = {"Pokemon": {"x-1"}, "Trainer": {"x-1"}, "Energy": set()}
        res, sin = clasificar(["x-1"], dudosas, set(), {})
        self.assertEqual(res, {})
        self.assertEqual(sin, ["x-1"])


class ResumenPorSet(unittest.TestCase):
    def test_agrupa_lo_que_falta_por_set_de_mas_a_menos(self):
        todos = ["a-1", "a-2", "a-3", "b-1", "b-2", "c-1"]
        faltan = ["a-1", "a-2", "b-1"]
        self.assertEqual(resumen_por_set(faltan, todos), [("a", 2, 3), ("b", 1, 2)])

    def test_sets_con_guion_en_el_nombre(self):
        self.assertEqual(resumen_por_set(["2018sm-fr-1"], ["2018sm-fr-1", "2018sm-fr-2"]), [("2018sm-fr", 1, 2)])


if __name__ == "__main__":
    unittest.main()
