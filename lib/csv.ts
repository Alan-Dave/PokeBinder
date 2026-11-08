/**
 * Serialización a CSV (PBI-22). Función pura: no toca la base ni la red.
 *
 * Dos defensas, porque el archivo lo abre una persona en Excel:
 * - RFC 4180: los campos con coma, comillas o saltos de línea van entre comillas
 *   y las comillas internas se duplican.
 * - Inyección de fórmulas (CWE-1236): una celda de texto que empieza con = + - @
 *   o con tabulación/retorno se ejecutaría como fórmula al abrirla. Se antepone
 *   una comilla simple para que se muestre como texto.
 */

export type CeldaCsv = string | number | null | undefined;

const INICIO_FORMULA = /^[=+\-@\t\r]/;

export function neutralizarFormula(texto: string): string {
  return INICIO_FORMULA.test(texto) ? `'${texto}` : texto;
}

function celda(valor: CeldaCsv): string {
  if (valor === null || valor === undefined) return "";
  // Un número nunca es una fórmula: se escribe tal cual, incluso si es negativo.
  const texto = typeof valor === "number" ? String(valor) : neutralizarFormula(valor);
  return /[",\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

// Excel necesita la marca BOM para leer UTF-8 (tildes y caracteres japoneses).
const BOM = "﻿";

export function aCsv(encabezados: readonly string[], filas: readonly (readonly CeldaCsv[])[]): string {
  const lineas = [encabezados, ...filas].map((fila) => fila.map(celda).join(","));
  return `${BOM}${lineas.join("\r\n")}\r\n`;
}
