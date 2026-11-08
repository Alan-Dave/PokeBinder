import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { registrarPrecios } from "./historial-precios";
import { createAdminClient } from "@/lib/supabase/admin";

function clienteFalso(resultado: { error: { code?: string } | null } = { error: null }) {
  const upsert = vi.fn().mockResolvedValue(resultado);
  const from = vi.fn(() => ({ upsert }));
  vi.mocked(createAdminClient).mockReturnValue({ from } as never);
  return { from, upsert };
}

beforeEach(() => {
  vi.mocked(createAdminClient).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("registrarPrecios", () => {
  it("guarda un precio por carta y acabado, ignorando los repetidos del día", async () => {
    const { from, upsert } = clienteFalso();

    await registrarPrecios([
      {
        cartaId: 7,
        acabados: [
          { acabado: "normal", mercado: 1.256 },
          { acabado: "holofoil", mercado: 9 },
        ],
      },
    ]);

    expect(from).toHaveBeenCalledWith("precios_historial");
    expect(upsert).toHaveBeenCalledWith(
      [
        { carta_id: 7, acabado: "normal", mercado: 1.26 },
        { carta_id: 7, acabado: "holofoil", mercado: 9 },
      ],
      { onConflict: "carta_id,acabado,fecha", ignoreDuplicates: true },
    );
  });

  it.each([
    ["algo que no es lista", "x"],
    ["un id de carta inválido", [{ cartaId: -1, acabados: [{ acabado: "normal", mercado: 1 }] }]],
    ["un precio negativo", [{ cartaId: 1, acabados: [{ acabado: "normal", mercado: -1 }] }]],
    ["un precio que no es número", [{ cartaId: 1, acabados: [{ acabado: "normal", mercado: "caro" }] }]],
    ["demasiadas cartas", Array.from({ length: 101 }, (_, i) => ({ cartaId: i + 1, acabados: [] }))],
  ])("rechaza %s sin tocar la base", async (_, entrada) => {
    clienteFalso();

    await registrarPrecios(entrada);

    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("no hace nada si no hay acabados que guardar", async () => {
    clienteFalso();

    await registrarPrecios([{ cartaId: 1, acabados: [] }]);

    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("no lanza si la base devuelve un error, y no registra el detalle", async () => {
    clienteFalso({ error: { code: "42501" } });

    await expect(
      registrarPrecios([{ cartaId: 1, acabados: [{ acabado: "normal", mercado: 1 }] }]),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(expect.any(String), "42501");
  });

  it("no lanza si falla el cliente de servicio", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("falta la clave");
    });

    await expect(
      registrarPrecios([{ cartaId: 1, acabados: [{ acabado: "normal", mercado: 1 }] }]),
    ).resolves.toBeUndefined();
  });
});
