import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ninguna prueba llama a MailerSend: fetch se reemplaza siempre.
vi.mock("server-only", () => ({}));

import { enviarCorreo, escaparHtml } from "./correo";

const CORREO = { para: "carla@correo.cl", asunto: "Asunto", texto: "Texto", html: "<p>Texto</p>" };

let fetchFalso: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchFalso = vi.fn();
  vi.stubGlobal("fetch", fetchFalso);
  vi.stubEnv("MAILERSEND_API_KEY", "clave-de-prueba");
  vi.stubEnv("CORREO_REMITENTE", "avisos@pokebinder.test");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("enviarCorreo", () => {
  it("envía a la API de MailerSend con la clave como Bearer", async () => {
    fetchFalso.mockResolvedValue(new Response(null, { status: 202 }));

    expect(await enviarCorreo(CORREO)).toBe(true);

    const [url, opciones] = fetchFalso.mock.calls[0];
    expect(url).toBe("https://api.mailersend.com/v1/email");
    expect(opciones.method).toBe("POST");
    expect(opciones.headers.Authorization).toBe("Bearer clave-de-prueba");
    expect(JSON.parse(opciones.body)).toEqual({
      from: { email: "avisos@pokebinder.test", name: "PokeBinder" },
      to: [{ email: "carla@correo.cl" }],
      subject: "Asunto",
      text: "Texto",
      html: "<p>Texto</p>",
    });
    expect(opciones.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([401, 422, 429, 500])("devuelve false si MailerSend responde %s", async (status) => {
    fetchFalso.mockResolvedValue(new Response("{}", { status }));

    expect(await enviarCorreo(CORREO)).toBe(false);
  });

  it("devuelve false si no hay red o se acaba el tiempo, sin lanzar", async () => {
    fetchFalso.mockRejectedValue(new DOMException("tiempo agotado", "TimeoutError"));

    await expect(enviarCorreo(CORREO)).resolves.toBe(false);
  });

  it("sin configuración no llama a la red", async () => {
    vi.stubEnv("MAILERSEND_API_KEY", "");
    vi.stubEnv("CORREO_REMITENTE", "");

    expect(await enviarCorreo(CORREO)).toBe(false);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it("el log no lleva la dirección, el contenido ni la clave", async () => {
    fetchFalso.mockResolvedValue(new Response("{}", { status: 422 }));

    await enviarCorreo(CORREO);

    const log = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(log).toContain("422");
    expect(log).not.toContain("carla@correo.cl");
    expect(log).not.toContain("Texto");
    expect(log).not.toContain("clave-de-prueba");
  });
});

describe("escaparHtml", () => {
  it("neutraliza etiquetas, atributos y entidades", () => {
    expect(escaparHtml(`<a href="https://x.test" onclick='y'>Tom & Jerry</a>`)).toBe(
      "&lt;a href=&quot;https://x.test&quot; onclick=&#39;y&#39;&gt;Tom &amp; Jerry&lt;/a&gt;",
    );
  });
});
