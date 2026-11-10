import { z } from "zod";
import { IDIOMAS } from "@/lib/validators/catalogo";

// Un campo vacío (o solo espacios) de un formulario o de la URL equivale a «sin filtro».
export const opcional = <T extends z.ZodType>(esquema: T) =>
  z.preprocess((valor) => (typeof valor === "string" && valor.trim() === "" ? undefined : valor), esquema.optional());

// Id de set tal como lo guarda el catálogo (sv1, swsh12pt5, base1, TG...):
// letras, dígitos y separadores comunes, hasta el límite de public.sets.id.
export const setId = z
  .string({ error: "El set debe ser texto." })
  .trim()
  .min(1, { error: "Se requiere el set." })
  .max(30, { error: "El set es demasiado largo." })
  .regex(/^[A-Za-z0-9._-]+$/, { error: "El set solo puede tener letras, números, punto, guion y guion bajo." });

export const idioma = z.enum(IDIOMAS, { error: "El idioma no es válido." });

// La rareza es texto libre del catálogo («Rare Holo», «Común»...): solo se
// acota el largo. Se usa como prefijo escapado, nunca como patrón del usuario.
export const rareza = z
  .string({ error: "La rareza debe ser texto." })
  .trim()
  .max(60, { error: "La rareza es demasiado larga." });

/** Filtros opcionales sobre el inventario del usuario. */
export const filtrosInventarioSchema = z.object({
  idioma: opcional(idioma),
  setId: opcional(setId),
  rareza: opcional(rareza),
});

export type FiltrosInventario = z.infer<typeof filtrosInventarioSchema>;
