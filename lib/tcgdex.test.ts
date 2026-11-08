import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  BYTES_MAXIMOS_IMAGEN,
  descargarImagenAltaDefinicion,
  esWebp,
  urlCarta,
  urlImagenAltaDefinicion,
} from "./tcgdex";

const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1, 2, 3]);
const BASE_IMAGEN = "https://assets.tcgdex.net/en/base/base1/4";

afterEach(() => vi.unstubAllGlobals());

function respuestaJson(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado });
}

// Falsea fetch: la API responde la carta y el host de imágenes responde `imagen`.
function simularTcgdex(imagen: () => Response, image = BASE_IMAGEN) {
  const fetchFalso = vi.fn(async (url: string) =>
    url.startsWith("https://api.tcgdex.net/") ? respuestaJson({ image }) : imagen(),
  );
  vi.stubGlobal("fetch", fetchFalso);
  return fetchFalso;
}

describe("urlCarta", () => {
  it("arma la URL de la API con el idioma y el id", () => {
    expect(urlCarta("en", "base1-4")).toBe("https://api.tcgdex.net/v2/en/cards/base1-4");
  });

  it("devuelve null si el id no tiene el formato esperado", () => {
    expect(urlCarta("en", "../x")).toBeNull();
    expect(urlCarta("en", "base1-4/../../y")).toBeNull();
  });
});

describe("urlImagenAltaDefinicion", () => {
  it("acepta la URL base de TCGdex y agrega la calidad alta", () => {
    expect(urlImagenAltaDefinicion(BASE_IMAGEN)).toBe("https://assets.tcgdex.net/en/base/base1/4/high.webp");
  });

  it("con tamaño min arma la miniatura (low.webp)", () => {
    expect(urlImagenAltaDefinicion(BASE_IMAGEN, "min")).toBe("https://assets.tcgdex.net/en/base/base1/4/low.webp");
  });

  it("valida la URL igual de estricto con el tamaño min", () => {
    expect(urlImagenAltaDefinicion("https://evil.example/en/base/base1/4", "min")).toBeNull();
  });

  it.each([
    "http://assets.tcgdex.net/en/base/base1/4",
    "https://evil.example/en/base/base1/4",
    "https://assets.tcgdex.net.evil.example/en/base/base1/4",
    "https://user:pass@assets.tcgdex.net/en/base/base1/4",
    "https://assets.tcgdex.net:8443/en/base/base1/4",
    "https://assets.tcgdex.net/en/base/base1/4?x=1",
    "https://assets.tcgdex.net/en/base/base1/4#a",
    "https://assets.tcgdex.net/en/base/base1/../../secreto",
    "https://assets.tcgdex.net/en/base/base1",
    "https://assets.tcgdex.net/en/base/base1/4/extra",
    "https://169.254.169.254/latest/meta-data",
    "no es una url",
    "",
  ])("rechaza %j", (url) => {
    expect(urlImagenAltaDefinicion(url)).toBeNull();
  });
});

describe("esWebp", () => {
  it("reconoce la firma RIFF/WEBP", () => {
    expect(esWebp(WEBP)).toBe(true);
  });

  it("rechaza otros formatos y datos cortos", () => {
    expect(esWebp(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(false);
    expect(esWebp(new Uint8Array([1, 2, 3]))).toBe(false);
  });
});

describe("descargarImagenAltaDefinicion", () => {
  it("descarga la carta y luego la imagen, sin seguir redirecciones", async () => {
    const fetchFalso = simularTcgdex(() => new Response(WEBP));

    const bytes = await descargarImagenAltaDefinicion("en", "base1-4");

    expect(bytes).toEqual(WEBP);
    expect(fetchFalso.mock.calls.map(([url]) => url)).toEqual([
      "https://api.tcgdex.net/v2/en/cards/base1-4",
      "https://assets.tcgdex.net/en/base/base1/4/high.webp",
    ]);
    const opciones = fetchFalso.mock.calls.map((llamada) => (llamada as unknown[])[1] as RequestInit);
    expect(opciones.every((o) => o.redirect === "error")).toBe(true);
  });

  it("con tamaño min pide la miniatura", async () => {
    const fetchFalso = simularTcgdex(() => new Response(WEBP));

    expect(await descargarImagenAltaDefinicion("en", "base1-4", "min")).toEqual(WEBP);
    expect(fetchFalso.mock.calls.map(([url]) => url)).toEqual([
      "https://api.tcgdex.net/v2/en/cards/base1-4",
      "https://assets.tcgdex.net/en/base/base1/4/low.webp",
    ]);
  });

  it("no pide la imagen si la API devuelve un host que no es el permitido", async () => {
    const fetchFalso = simularTcgdex(() => new Response(WEBP), "https://evil.example/x/y/z/1");

    expect(await descargarImagenAltaDefinicion("en", "base1-4")).toBeNull();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  it("devuelve null si la carta no existe (404)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respuestaJson({}, 404)),
    );
    expect(await descargarImagenAltaDefinicion("es", "base1-4")).toBeNull();
  });

  it("devuelve null si falla la red o se agota el tiempo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("red caída");
      }),
    );
    expect(await descargarImagenAltaDefinicion("en", "base1-4")).toBeNull();
  });

  it("rechaza una imagen más grande que el tope", async () => {
    simularTcgdex(() => {
      const grande = new Uint8Array(BYTES_MAXIMOS_IMAGEN + 1);
      grande.set(WEBP);
      return new Response(grande);
    });
    expect(await descargarImagenAltaDefinicion("en", "base1-4")).toBeNull();
  });

  it("rechaza un archivo que no es WebP aunque venga del host correcto", async () => {
    simularTcgdex(() => new Response("<html>no soy una imagen</html>"));
    expect(await descargarImagenAltaDefinicion("en", "base1-4")).toBeNull();
  });

  it("no llama a la red si el id_api es inválido", async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal("fetch", fetchFalso);
    expect(await descargarImagenAltaDefinicion("en", "../../x")).toBeNull();
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
