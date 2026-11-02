import { beforeEach, describe, expect, it, vi } from "vitest";

// La autorización la hacen las funciones SQL. Estas pruebas verifican el orden
// de los pasos: nada se sube ni se copia con la clave secreta sin sesión o sin
// que la base haya aceptado, y nada queda huérfano si la base rechaza.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/imagen-propuesta", () => ({ recodificarAWebp: vi.fn() }));
vi.mock("@/lib/correo", async (original) => ({
  ...(await original<typeof import("@/lib/correo")>()),
  enviarCorreo: vi.fn(),
}));

import { enviarCorreo } from "@/lib/correo";
import { recodificarAWebp } from "@/lib/imagen-propuesta";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { aprobarPropuesta, crearPropuesta, listarPendientes, rechazarPropuesta } from "./propuestas";

const USUARIO = "3f2b8c1e-5d4a-4b7e-9c2d-1a0f6e8b7c95";
const WEBP = Buffer.from("webp-de-prueba");

type Rpc = { data?: unknown; error?: { code?: string } | null };

function preparar({ rpc = [] as Rpc[], usuario = { id: USUARIO } as { id: string } | null } = {}) {
  const base = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: usuario } }) },
    rpc: vi.fn(),
  };
  for (const r of rpc) base.rpc.mockResolvedValueOnce({ data: null, error: null, ...r });

  const bucket = {
    upload: vi.fn().mockResolvedValue({ error: null }),
    copy: vi.fn().mockResolvedValue({ error: null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
    createSignedUrls: vi.fn().mockResolvedValue({ data: [{ signedUrl: "https://firmada" }], error: null }),
  };
  const admin = {
    storage: { from: vi.fn(() => bucket) },
    auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "carla@correo.cl" } }, error: null }) } },
  };
  vi.mocked(createClient).mockResolvedValue(base as never);
  vi.mocked(createAdminClient).mockReturnValue(admin as never);
  return { base, bucket, admin };
}

const entradaValida = () => ({
  cartaId: 7,
  descripcion: "Una carta",
  detalles: "Texto libre",
  archivo: new File([new Uint8Array(10)], "carta.png"),
});

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(createAdminClient).mockReset();
  vi.mocked(recodificarAWebp).mockReset().mockResolvedValue({ ok: true, webp: WEBP });
  vi.mocked(enviarCorreo).mockReset().mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("crearPropuesta", () => {
  it("recodifica, sube con un nombre generado y registra la propuesta", async () => {
    const { base, bucket, admin } = preparar({ rpc: [{ data: 1 }] });

    expect(await crearPropuesta(entradaValida())).toEqual({ ok: true, datos: null });

    expect(admin.storage.from).toHaveBeenCalledWith("Propuestas");
    const [ruta, contenido, opciones] = bucket.upload.mock.calls[0];
    expect(ruta).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/);
    expect(contenido).toBe(WEBP);
    expect(opciones).toEqual({ contentType: "image/webp", upsert: false });
    expect(base.rpc).toHaveBeenCalledWith("crear_propuesta", {
      p_carta_id: 7,
      p_imagen_path: ruta,
      p_descripcion: "Una carta",
      p_detalles: "Texto libre",
    });
  });

  it("el nombre del archivo del usuario nunca llega al bucket", async () => {
    const { bucket } = preparar({ rpc: [{ data: 1 }] });

    await crearPropuesta({ ...entradaValida(), archivo: new File([new Uint8Array(10)], "../../Images/es/x.webp") });

    expect(bucket.upload.mock.calls[0][0]).not.toContain("..");
  });

  it("sin sesión no toca la clave secreta", async () => {
    preparar({ usuario: null });

    expect(await crearPropuesta(entradaValida())).toEqual({ ok: false, error: "Se requiere una sesión iniciada." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("una entrada inválida no llega a Supabase", async () => {
    expect((await crearPropuesta({ ...entradaValida(), archivo: "no-es-archivo" })).ok).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("si la imagen no pasa la revisión, no sube nada", async () => {
    preparar();
    vi.mocked(recodificarAWebp).mockResolvedValue({ ok: false, error: "La imagen debe ser JPEG, PNG o WebP." });

    expect(await crearPropuesta(entradaValida())).toEqual({ ok: false, error: "La imagen debe ser JPEG, PNG o WebP." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it.each([
    ["PB001", "La carta ya tiene imagen."],
    ["PB002", "Ya tienes 5 propuestas pendientes. Espera a que se revisen."],
    ["42501", "No tienes permiso para realizar esta acción."],
  ])("si la base rechaza (%s), borra el archivo subido", async (code, mensaje) => {
    const { bucket } = preparar({ rpc: [{ error: { code } }] });

    expect(await crearPropuesta(entradaValida())).toEqual({ ok: false, error: mensaje });
    expect(bucket.remove).toHaveBeenCalledWith([bucket.upload.mock.calls[0][0]]);
  });
});

describe("listarPendientes", () => {
  it("firma las vistas previas solo después de que la base autorizó", async () => {
    const fila = {
      id: 1, carta_id: 7, carta_nombre: "Pika", carta_idioma: "es", nombre_visible: "carla",
      imagen_path: "a.webp", descripcion: "d", detalles: "t", creada_en: "2026-11-02",
    };
    const { bucket } = preparar({ rpc: [{ data: [fila] }] });

    const resultado = await listarPendientes();

    expect(bucket.createSignedUrls).toHaveBeenCalledWith(["a.webp"], 600);
    expect(resultado.ok && resultado.datos[0].url).toBe("https://firmada");
    // La ruta interna del bucket no sale del servidor.
    expect(resultado.ok && resultado.datos[0]).not.toHaveProperty("imagen_path");
  });

  it("un usuario sin Administración no recibe nada ni se firma nada", async () => {
    preparar({ rpc: [{ error: { code: "42501" } }] });

    expect(await listarPendientes()).toEqual({ ok: false, error: "No tienes permiso para realizar esta acción." });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe("aprobarPropuesta", () => {
  const plan = { data: [{ origen: "a.webp", destino: "es/propuestas/a.webp" }] };
  const aprobada = {
    data: [
      { usuario_id: USUARIO, aprobada: true, imagen_path: "a.webp" },
      { usuario_id: "otro", aprobada: false, imagen_path: "b.webp" },
    ],
  };

  it("autoriza, copia a Images, publica, limpia y avisa a cada autor", async () => {
    const { base, bucket } = preparar({ rpc: [plan, aprobada] });

    expect(await aprobarPropuesta({ propuestaId: 1 })).toEqual({ ok: true, datos: null });

    expect(base.rpc.mock.calls.map((c) => c[0])).toEqual(["preparar_aprobacion", "aprobar_propuesta"]);
    expect(bucket.copy).toHaveBeenCalledWith("a.webp", "es/propuestas/a.webp", { destinationBucket: "Images" });
    expect(bucket.remove).toHaveBeenCalledWith(["a.webp", "b.webp"]);
    expect(enviarCorreo).toHaveBeenCalledTimes(2);
    expect(vi.mocked(enviarCorreo).mock.calls[0][0].asunto).toBe("Tu propuesta para el catálogo fue aprobada");
    expect(vi.mocked(enviarCorreo).mock.calls[1][0].texto).toContain("La carta ya tiene imagen.");
  });

  it("si la base no autoriza, no copia nada", async () => {
    const { bucket } = preparar({ rpc: [{ error: { code: "42501" } }] });

    expect((await aprobarPropuesta({ propuestaId: 1 })).ok).toBe(false);
    expect(bucket.copy).not.toHaveBeenCalled();
  });

  it("si la publicación falla, borra la copia de Images", async () => {
    const { bucket, admin } = preparar({ rpc: [plan, { error: { code: "PB001" } }] });

    expect(await aprobarPropuesta({ propuestaId: 1 })).toEqual({ ok: false, error: "La carta ya tiene imagen." });
    expect(admin.storage.from).toHaveBeenCalledWith("Images");
    expect(bucket.remove).toHaveBeenCalledWith(["es/propuestas/a.webp"]);
    expect(enviarCorreo).not.toHaveBeenCalled();
  });

  it("si la copia falla, no publica", async () => {
    const { base, bucket } = preparar({ rpc: [plan] });
    bucket.copy.mockResolvedValue({ error: { message: "fallo" } });

    expect((await aprobarPropuesta({ propuestaId: 1 })).ok).toBe(false);
    expect(base.rpc).toHaveBeenCalledTimes(1);
  });

  it("rechaza un id manipulado sin tocar Supabase", async () => {
    expect((await aprobarPropuesta({ propuestaId: "1; drop table cartas" })).ok).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("rechazarPropuesta", () => {
  it("registra el rechazo, borra el archivo y avisa con el motivo", async () => {
    const { base, bucket } = preparar({ rpc: [{ data: [{ usuario_id: USUARIO, imagen_path: "a.webp" }] }] });

    expect(await rechazarPropuesta({ propuestaId: 1, motivo: "Imagen borrosa" })).toEqual({ ok: true, datos: null });
    expect(base.rpc).toHaveBeenCalledWith("rechazar_propuesta", { p_propuesta_id: 1, p_motivo: "Imagen borrosa" });
    expect(bucket.remove).toHaveBeenCalledWith(["a.webp"]);
    expect(vi.mocked(enviarCorreo).mock.calls[0][0].texto).toContain("Motivo: Imagen borrosa");
  });

  it("si el aviso no sale, el rechazo queda hecho igual", async () => {
    preparar({ rpc: [{ data: [{ usuario_id: USUARIO, imagen_path: "a.webp" }] }] });
    vi.mocked(enviarCorreo).mockResolvedValue(false);

    expect(await rechazarPropuesta({ propuestaId: 1, motivo: "Imagen borrosa" })).toEqual({ ok: true, datos: null });
  });

  it("exige motivo", async () => {
    expect((await rechazarPropuesta({ propuestaId: 1, motivo: "no" })).ok).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
  });
});
