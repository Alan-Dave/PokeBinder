import { beforeEach, describe, expect, it, vi } from "vitest";

// La validación vive en lib/propuestas.ts y la autorización en la base (ambas
// probadas aparte). Aquí se verifica que las acciones pasan los campos y refrescan.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/propuestas", () => ({ aprobarPropuesta: vi.fn(), rechazarPropuesta: vi.fn() }));

import { revalidatePath } from "next/cache";
import { aprobarPropuesta, rechazarPropuesta } from "@/lib/propuestas";
import { aprobarAccion, rechazarAccion } from "./acciones";

const INICIAL = { error: null, exito: false };

function formulario(campos: Record<string, string>) {
  const datos = new FormData();
  for (const [campo, valor] of Object.entries(campos)) datos.set(campo, valor);
  return datos;
}

beforeEach(() => {
  vi.mocked(aprobarPropuesta).mockReset().mockResolvedValue({ ok: true, datos: null });
  vi.mocked(rechazarPropuesta).mockReset().mockResolvedValue({ ok: true, datos: null });
  vi.mocked(revalidatePath).mockReset();
});

describe("acciones de /admin/propuestas", () => {
  it("aprobar convierte el id y refresca la bandeja", async () => {
    expect(await aprobarAccion(INICIAL, formulario({ propuestaId: "3" }))).toEqual({ error: null, exito: true });
    expect(aprobarPropuesta).toHaveBeenCalledWith({ propuestaId: 3 });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/propuestas");
  });

  it("rechazar pasa el motivo", async () => {
    await rechazarAccion(INICIAL, formulario({ propuestaId: "3", motivo: "Imagen borrosa" }));
    expect(rechazarPropuesta).toHaveBeenCalledWith({ propuestaId: 3, motivo: "Imagen borrosa" });
  });

  it("devuelve el error de la capa de servidor sin refrescar", async () => {
    vi.mocked(aprobarPropuesta).mockResolvedValue({ ok: false, error: "No tienes permiso para realizar esta acción." });

    expect(await aprobarAccion(INICIAL, formulario({ propuestaId: "3" }))).toEqual({
      error: "No tienes permiso para realizar esta acción.",
      exito: false,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
