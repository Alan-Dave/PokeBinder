import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { cambiarCantidad } from "./inventario";

// El update termina en .select().maybeSingle(); solo importa lo que devuelve.
function clienteFalso(resultado: { data?: unknown; error?: { code?: string } | null }) {
  const respuesta = { data: null, error: null, ...resultado };
  const consulta: Record<string, unknown> = {};
  for (const metodo of ["update", "eq", "select"]) consulta[metodo] = () => consulta;
  consulta.maybeSingle = () => Promise.resolve(respuesta);

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    from: vi.fn(() => consulta),
  } as never);
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
});

describe("cambiarCantidad con cartas en un binder", () => {
  it("explica que primero hay que sacar la carta del binder", async () => {
    clienteFalso({ error: { code: "PB002" } });
    const r = await cambiarCantidad({ id: 5, cantidad: 1 });
    expect(r).toEqual({
      ok: false,
      error:
        "Esa carta está en más casillas de tus binders que la cantidad indicada. Quítala del binder antes de bajar la cantidad.",
    });
  });

  it("sigue confirmando el cambio cuando la base lo acepta", async () => {
    clienteFalso({ data: { id: 5 } });
    expect(await cambiarCantidad({ id: 5, cantidad: 3 })).toEqual({ ok: true, datos: null });
  });
});
