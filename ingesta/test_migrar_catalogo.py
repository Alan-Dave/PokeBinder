"""Pruebas de la limpieza del catálogo: python -m unittest discover ingesta"""

import unittest
from decimal import Decimal

from migrar_catalogo import nombres_de_sets, normalizar_fila

BASE = {
    "id": 1,
    "id_api": "sm9-1",
    "idioma": "en",
    "nombre": "Celebi & Venusaur-GX",
    "type": "Grass",
    "price": 55.19,
    "rarity": "Rare Holo GX",
    "number": "1",
    "set_id": "sm9",
    "set_name": "Team Up",
    "stage": "Basic",
    "especial_type": "TAG TEAM",
    "trainer": "GX",
    "edition": "Ninguno",
    "variantes_disponibles": "normal,reverse,holo",
}


def fila(**cambios):
    return {**BASE, **cambios}


class NormalizarFila(unittest.TestCase):
    def test_une_los_subtipos_repartidos_en_tres_columnas(self):
        carta = normalizar_fila(fila(edition="Ultra Beast"))
        self.assertEqual(carta.subtipos, ["TAG TEAM", "GX", "Ultra Beast"])

    def test_normal_no_es_un_subtipo(self):
        carta = normalizar_fila(fila(especial_type="Normal", trainer="Desconocido"))
        self.assertEqual(carta.subtipos, [])

    def test_marcadores_quedan_en_null(self):
        carta = normalizar_fila(fila(type="Desconocido", rarity="Desconocida", stage="Ninguno", set_name="TCGDex"))
        self.assertIsNone(carta.type)
        self.assertIsNone(carta.rarity)
        self.assertIsNone(carta.stage)
        self.assertIsNone(carta.set_nombre)

    def test_precio_exacto_con_dos_decimales(self):
        self.assertEqual(normalizar_fila(fila(price=0.1)).price, Decimal("0.10"))
        self.assertIsNone(normalizar_fila(fila(price=None)).price)

    def test_recorta_espacios_del_nombre(self):
        self.assertEqual(normalizar_fila(fila(nombre="  Mew ")).nombre, "Mew")

    def test_variantes_como_lista_sin_duplicados(self):
        carta = normalizar_fila(fila(variantes_disponibles="normal, holo,,holo"))
        self.assertEqual(carta.variantes_disponibles, ["normal", "holo"])

    def test_rechaza_filas_de_prueba_sin_formato_de_id_api(self):
        with self.assertRaises(ValueError):
            normalizar_fila(fila(id_api="id123"))

    def test_rechaza_idioma_no_soportado(self):
        with self.assertRaises(ValueError):
            normalizar_fila(fila(idioma="de"))

    def test_rechaza_precio_negativo(self):
        with self.assertRaises(ValueError):
            normalizar_fila(fila(price=-1))


class NombresDeSets(unittest.TestCase):
    def test_ignora_el_marcador_tcgdex(self):
        cartas = [
            normalizar_fila(fila(set_name="TCGDex")),
            normalizar_fila(fila(id_api="sm9-2", set_name="Team Up")),
        ]
        self.assertEqual(nombres_de_sets(cartas), {("sm9", "en"): "Team Up"})

    def test_set_sin_nombre_queda_en_none(self):
        cartas = [normalizar_fila(fila(set_name="TCGDex"))]
        self.assertEqual(nombres_de_sets(cartas), {("sm9", "en"): None})

    def test_el_nombre_depende_del_idioma(self):
        cartas = [
            normalizar_fila(fila()),
            normalizar_fila(fila(idioma="es", set_name="Unión de Aliados")),
        ]
        self.assertEqual(
            nombres_de_sets(cartas),
            {("sm9", "en"): "Team Up", ("sm9", "es"): "Unión de Aliados"},
        )


if __name__ == "__main__":
    unittest.main()
