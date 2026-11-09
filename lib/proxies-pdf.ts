import "server-only";

import { PDFDocument, type PDFFont, type PDFImage, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { urlsImagenesOpcionales } from "@/lib/catalogo";
import { publicEnv } from "@/lib/env";
import { obtenerImagenHd } from "@/lib/imagen-hd";
import { IMAGEN_NO_DISPONIBLE_BASE64 } from "@/lib/imagen-no-disponible-datos";
import { obtenerMazo } from "@/lib/mazos";
import {
  CARTA_ALTO_MM,
  CARTA_ANCHO_MM,
  expandirCopias,
  marcasDeCorte,
  mm,
  paginar,
  PAGINA_ALTO_MM,
  PAGINA_ANCHO_MM,
  posicionesPagina,
  PROXIES_MAX,
  textoSeguro,
} from "@/lib/proxies";
import { generarProxiesSchema } from "@/lib/validators/proxies";

/**
 * PDF de proxies de un mazo (PBI-20), generado siempre en el servidor (regla 8).
 *
 * El navegador solo manda el id del mazo. Qué cartas y cuántas copias salen lo
 * decide obtenerMazo, que ya valida la sesión y deja que RLS limite el acceso
 * al mazo del propio usuario. Las medidas son fijas (lib/proxies.ts).
 *
 * Cada imagen se pasa por sharp antes de incrustarla: pdf-lib solo entiende
 * PNG y JPEG, y volver a codificar descarta cualquier contenido inesperado del
 * archivo original (metadatos, formatos raros) en vez de copiarlo al PDF.
 */

export type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

// 300 ppp a 63 × 88 mm: calidad de impresión sin inflar el PDF.
const PX_ANCHO = 744;
const PX_ALTO = 1039;
// Una imagen de carta real tiene menos de un megapíxel; el tope frena imágenes-bomba.
const PIXELES_MAX_ENTRADA = 16_000_000;

const TIEMPO_MAXIMO_MS = 12_000;
const BYTES_MAXIMOS_BUCKET = 2 * 1024 * 1024;
const CONCURRENCIA = 4;

const FALLO = "No se pudo generar el PDF.";

/** Descarga la imagen del bucket: solo se pide a nuestro propio Supabase. */
async function descargarDelBucket(url: string): Promise<Uint8Array | null> {
  let destino: URL;
  try {
    destino = new URL(url);
  } catch {
    return null;
  }
  // La URL la firmó nuestro servidor, pero se comprueba igualmente: nunca se
  // pide a un host distinto del proyecto (SSRF).
  if (destino.protocol !== "https:" || destino.host !== new URL(publicEnv.NEXT_PUBLIC_SUPABASE_URL).host) return null;

  try {
    const respuesta = await fetch(destino, { redirect: "error", signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS) });
    if (!respuesta.ok) return null;
    const bytes = new Uint8Array(await respuesta.arrayBuffer());
    return bytes.length <= BYTES_MAXIMOS_BUCKET ? bytes : null;
  } catch {
    return null;
  }
}

/** Normaliza cualquier imagen a un PNG de tamaño fijo; null si no se puede leer. */
async function aPng(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const png = await sharp(bytes, { limitInputPixels: PIXELES_MAX_ENTRADA })
      .resize(PX_ANCHO, PX_ALTO, { fit: "cover" })
      .png()
      .toBuffer();
    return new Uint8Array(png);
  } catch {
    return null;
  }
}

async function imagenDeCarta(cartaId: number, urlBucket: string | null | undefined): Promise<Uint8Array | null> {
  const hd = await obtenerImagenHd(cartaId);
  if (hd) {
    const png = await aPng(hd.bytes);
    if (png) return png;
  }
  if (urlBucket) {
    const bytes = await descargarDelBucket(urlBucket);
    if (bytes) return aPng(bytes);
  }
  return null;
}

/** Ejecuta `tarea` sobre cada elemento con como mucho `limite` a la vez. */
async function enParalelo<T, R>(items: readonly T[], limite: number, tarea: (item: T) => Promise<R>): Promise<R[]> {
  const resultados: R[] = new Array(items.length);
  let siguiente = 0;
  const trabajadores = Array.from({ length: Math.min(limite, items.length) }, async () => {
    while (siguiente < items.length) {
      const i = siguiente++;
      resultados[i] = await tarea(items[i]);
    }
  });
  await Promise.all(trabajadores);
  return resultados;
}

/** Último recurso si la ilustración no pudo prepararse: un recuadro con el nombre. */
function dibujarMarcador(pagina: ReturnType<PDFDocument["addPage"]>, fuente: PDFFont, x: number, y: number, nombre: string) {
  const ancho = mm(CARTA_ANCHO_MM);
  const alto = mm(CARTA_ALTO_MM);
  pagina.drawRectangle({ x, y, width: ancho, height: alto, borderColor: rgb(0.5, 0.5, 0.5), borderWidth: 0.75 });
  const texto = textoSeguro(nombre);
  // Se acorta hasta que quepa con margen: pdf-lib no recorta por su cuenta.
  let recortado = texto;
  while (recortado.length > 1 && fuente.widthOfTextAtSize(recortado, 10) > ancho - 12) recortado = recortado.slice(0, -1);
  pagina.drawText(recortado, { x: x + 6, y: y + alto / 2, size: 10, font: fuente, color: rgb(0.2, 0.2, 0.2) });
  pagina.drawText("Sin imagen", { x: x + 6, y: y + alto / 2 - 14, size: 8, font: fuente, color: rgb(0.45, 0.45, 0.45) });
}

/**
 * Carta sin imagen: la ilustración de «Imagen no disponible» a tamaño de carta
 * y, encima, el nombre en la franja vacía de abajo. Sin el nombre el proxy no
 * serviría para jugar.
 */
function dibujarSinImagen(
  pagina: ReturnType<PDFDocument["addPage"]>,
  fuente: PDFFont,
  ilustracion: PDFImage,
  x: number,
  y: number,
  nombre: string,
) {
  const ancho = mm(CARTA_ANCHO_MM);
  const alto = mm(CARTA_ALTO_MM);
  pagina.drawImage(ilustracion, { x, y, width: ancho, height: alto });
  pagina.drawRectangle({ x, y, width: ancho, height: alto, borderColor: rgb(0.5, 0.5, 0.5), borderWidth: 0.75 });

  // Se achica la letra hasta que quepa y, si aun así no cabe, se recorta:
  // pdf-lib no ajusta el texto por su cuenta.
  const texto = textoSeguro(nombre);
  const maximo = ancho - 16;
  let tamano = 11;
  while (tamano > 6 && fuente.widthOfTextAtSize(texto, tamano) > maximo) tamano -= 0.5;
  let recortado = texto;
  while (recortado.length > 1 && fuente.widthOfTextAtSize(recortado, tamano) > maximo) recortado = recortado.slice(0, -1);
  const largo = fuente.widthOfTextAtSize(recortado, tamano);
  pagina.drawText(recortado, {
    x: x + (ancho - largo) / 2,
    y: y + alto * 0.07,
    size: tamano,
    font: fuente,
    color: rgb(0.1, 0.1, 0.2),
  });
}

export async function generarProxiesMazo(entrada: unknown): Promise<Resultado<{ pdf: Uint8Array; nombre: string }>> {
  const validado = generarProxiesSchema.safeParse(entrada);
  if (!validado.success) return { ok: false, error: validado.error.issues[0].message };

  // obtenerMazo valida la sesión y deja que RLS acote el mazo al usuario.
  const mazo = await obtenerMazo({ mazoId: validado.data.mazoId });
  if (!mazo.ok) return mazo;

  const cartas = expandirCopias(mazo.datos.lineas);
  if (cartas.length === 0) return { ok: false, error: "El mazo está vacío: no hay nada que imprimir." };
  if (cartas.length > PROXIES_MAX) {
    return { ok: false, error: `Un PDF admite hasta ${PROXIES_MAX} cartas y el mazo tiene ${cartas.length}.` };
  }

  try {
    const ids = [...new Set(cartas.map((c) => c.cartaId))];

    // Las URLs firmadas se piden de 30 en 30 (límite de obtenerUrlsImagenes).
    const urls: Record<number, string | null> = {};
    for (const grupo of paginar(ids, 30)) Object.assign(urls, await urlsImagenesOpcionales(grupo));

    const imagenes = new Map<number, Uint8Array | null>();
    await enParalelo(ids, CONCURRENCIA, async (id) => {
      imagenes.set(id, await imagenDeCarta(id, urls[id]));
    });

    const doc = await PDFDocument.create();
    doc.setTitle(`Proxies · ${textoSeguro(mazo.datos.mazo.nombre)}`);
    doc.setCreator("PokeBinder");
    const fuente = await doc.embedFont(StandardFonts.Helvetica);

    // Una carta repetida incrusta su imagen una sola vez.
    const incrustadas = new Map<number, PDFImage>();
    for (const [id, bytes] of imagenes) if (bytes) incrustadas.set(id, await doc.embedPng(bytes));

    // La ilustración de reemplazo solo se incrusta si alguna carta la necesita.
    let ilustracion: PDFImage | null = null;
    if (cartas.some((c) => !incrustadas.has(c.cartaId))) {
      const png = await aPng(new Uint8Array(Buffer.from(IMAGEN_NO_DISPONIBLE_BASE64, "base64")));
      if (png) ilustracion = await doc.embedPng(png);
    }

    const posiciones = posicionesPagina();
    const marcas = marcasDeCorte();
    for (const hoja of paginar(cartas)) {
      const pagina = doc.addPage([mm(PAGINA_ANCHO_MM), mm(PAGINA_ALTO_MM)]);

      hoja.forEach((carta, i) => {
        const { x, y } = posiciones[i];
        const imagen = incrustadas.get(carta.cartaId);
        if (imagen) pagina.drawImage(imagen, { x, y, width: mm(CARTA_ANCHO_MM), height: mm(CARTA_ALTO_MM) });
        else if (ilustracion) dibujarSinImagen(pagina, fuente, ilustracion, x, y, carta.nombre);
        else dibujarMarcador(pagina, fuente, x, y, carta.nombre);
      });

      for (const m of marcas) {
        pagina.drawLine({ start: { x: m.x1, y: m.y1 }, end: { x: m.x2, y: m.y2 }, thickness: 0.5, color: rgb(0, 0, 0) });
      }
      pagina.drawText("Proxy no oficial · solo para uso personal · 63 x 88 mm, imprimir al 100 %", {
        x: mm(10.5),
        y: mm(8),
        size: 7,
        font: fuente,
        color: rgb(0.4, 0.4, 0.4),
      });
    }

    return { ok: true, datos: { pdf: await doc.save(), nombre: `proxies-mazo-${validado.data.mazoId}.pdf` } };
  } catch (error) {
    console.error("[proxies] Error inesperado al generar el PDF:", error);
    return { ok: false, error: FALLO };
  }
}
