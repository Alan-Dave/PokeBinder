import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { avisoEstadoCuenta } from "./avisos";

describe("avisoEstadoCuenta", () => {
  it.each([
    [false, "Tu cuenta de PokeBinder fue deshabilitada"],
    [true, "Tu cuenta de PokeBinder fue habilitada"],
  ])("habilitada=%s usa el asunto correcto", (habilitada, asunto) => {
    expect(avisoEstadoCuenta({ habilitada, motivo: "Revisión" }).asunto).toBe(asunto);
  });

  it("incluye el motivo en el texto y en el HTML", () => {
    const aviso = avisoEstadoCuenta({ habilitada: false, motivo: "Abuso del sistema" });

    expect(aviso.texto).toContain("Motivo: Abuso del sistema");
    expect(aviso.html).toContain("Abuso del sistema");
  });

  it("escapa el motivo en el HTML para que no inyecte enlaces ni etiquetas", () => {
    const aviso = avisoEstadoCuenta({
      habilitada: false,
      motivo: '<a href="https://phishing.test">Reactiva tu cuenta aquí</a>',
    });

    expect(aviso.html).not.toContain("<a href");
    expect(aviso.html).toContain("&lt;a href=&quot;https://phishing.test&quot;&gt;");
  });
});
