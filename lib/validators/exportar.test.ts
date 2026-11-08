import { describe, expect, it } from "vitest";
import { exportarInventarioSchema } from "./exportar";

describe("exportarInventarioSchema", () => {
  it("usa csv si no se indica formato", () => {
    expect(exportarInventarioSchema.parse({})).toEqual({ formato: "csv" });
    expect(exportarInventarioSchema.parse({ formato: undefined })).toEqual({ formato: "csv" });
  });

  it.each(["csv", "xlsx"])("acepta %s", (formato) => {
    expect(exportarInventarioSchema.parse({ formato })).toEqual({ formato });
  });

  it.each(["pdf", "XLSX", "csv; rm -rf", "", "../etc/passwd", 1, null])("rechaza %j", (formato) => {
    const r = exportarInventarioSchema.safeParse({ formato });
    expect(r.success).toBe(false);
    expect(!r.success && r.error.issues[0].message).toBe("El formato debe ser csv o xlsx.");
  });
});
