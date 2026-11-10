import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/panel-coleccion", () => ({
  listarPanelColeccion: vi.fn(),
  SIN_SESION: "Se requiere una sesión iniciada.",
}));

import { listarPanelColeccion } from "@/lib/panel-coleccion";
import { GET } from "./route";

let n = 0;
// Cada prueba usa otra IP: el límite de peticiones vive en la memoria del módulo.
const pedir = (consulta = "") =>
  GET(new Request(`http://localhost/api/coleccion/panel${consulta}`, { headers: { "x-forwarded-for": `10.0.0.${++n}` } }));

beforeEach(() => {
  vi.mocked(listarPanelColeccion).mockReset().mockResolvedValue({ ok: true, datos: { cartas: [], hayMas: false } });
});

describe("GET /api/coleccion/panel", () => {
  it("devuelve las cartas sin guardarlas en caché", async () => {
    const r = await pedir("?texto=eon&categoria=3&pagina=2");

    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ cartas: [], hayMas: false });
    expect(listarPanelColeccion).toHaveBeenCalledWith({ texto: "eon", categoriaId: 3, pagina: 2 });
  });

  it.each(["?pagina=abc", "?categoria=1%20OR%201=1", "?pagina=0", "?categoria=-4", `?texto=${"x".repeat(51)}`])(
    "rechaza %s con 400 sin tocar la base",
    async (consulta) => {
      const r = await pedir(consulta);

      expect(r.status).toBe(400);
      expect(listarPanelColeccion).not.toHaveBeenCalled();
    },
  );

  it("sin sesión responde 401 y no entrega datos", async () => {
    vi.mocked(listarPanelColeccion).mockResolvedValue({ ok: false, error: "Se requiere una sesión iniciada." });

    const r = await pedir();

    expect(r.status).toBe(401);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("un fallo interno responde 500 con un mensaje genérico", async () => {
    vi.mocked(listarPanelColeccion).mockResolvedValue({ ok: false, error: "No se pudo completar la operación." });

    const r = await pedir();

    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: "No se pudo completar la operación." });
  });

  it("corta con 429 a quien pasa del límite de peticiones", async () => {
    const cabeceras = { "x-forwarded-for": "10.9.9.9" };
    let ultima = 200;
    for (let i = 0; i < 125; i++) {
      ultima = (await GET(new Request("http://localhost/api/coleccion/panel", { headers: cabeceras }))).status;
    }

    expect(ultima).toBe(429);
  });
});
