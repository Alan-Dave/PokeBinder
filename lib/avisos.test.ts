import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { avisoEstadoCuenta, avisoPropuesta } from "./avisos";

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

describe("avisoPropuesta", () => {
  it("aprobada: sin motivo", () => {
    const aviso = avisoPropuesta({ aprobada: true, motivo: null });
    expect(aviso.asunto).toBe("Tu propuesta para el catálogo fue aprobada");
    expect(aviso.texto).not.toContain("Motivo");
  });

  it("rechazada: con el motivo escapado en el HTML", () => {
    const aviso = avisoPropuesta({ aprobada: false, motivo: "<b>borrosa</b>" });
    expect(aviso.texto).toContain("Motivo: <b>borrosa</b>");
    expect(aviso.html).toContain("&lt;b&gt;borrosa&lt;/b&gt;");
  });
});
