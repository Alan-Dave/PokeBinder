import { beforeEach, describe, expect, it, vi } from "vitest";

// La validación del archivo vive en lib/propuestas.ts (probada aparte). Aquí
// solo se verifica que la acción pasa los campos tal como llegan y refresca la ficha.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/propuestas", () => ({ crearPropuesta: vi.fn() }));

import { revalidatePath } from "next/cache";
import { crearPropuesta } from "@/lib/propuestas";
import { proponerAccion } from "./acciones";

const INICIAL = { error: null, exito: false };

function formulario() {
  const datos = new FormData();
  datos.set("cartaId", "7");
  datos.set("descripcion", "Una carta");
  datos.set("detalles", "Texto libre");
  datos.set("archivo", new File([new Uint8Array(4)], "carta.png"));
  return datos;
}

beforeEach(() => {
  vi.mocked(crearPropuesta).mockReset();
  vi.mocked(revalidatePath).mockReset();
});

describe("proponerAccion", () => {
  it("pasa los campos a crearPropuesta y refresca la ficha", async () => {
    vi.mocked(crearPropuesta).mockResolvedValue({ ok: true, datos: null });

    expect(await proponerAccion(INICIAL, formulario())).toEqual({ error: null, exito: true });
    const entrada = vi.mocked(crearPropuesta).mock.calls[0][0] as Record<string, unknown>;
    expect(entrada).toMatchObject({ cartaId: 7, descripcion: "Una carta", detalles: "Texto libre" });
    expect(entrada.archivo).toBeInstanceOf(File);
    expect(revalidatePath).toHaveBeenCalledWith("/catalogo/7");
  });

  it("devuelve el error sin refrescar", async () => {
    vi.mocked(crearPropuesta).mockResolvedValue({ ok: false, error: "La carta ya tiene imagen." });

    expect(await proponerAccion(INICIAL, formulario())).toEqual({ error: "La carta ya tiene imagen.", exito: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
