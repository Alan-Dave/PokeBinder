import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      // Lógica que valida y decide: validadores, capa de servidor y Server
      // Actions. Las páginas y los clientes de Supabase quedan fuera porque
      // necesitan un navegador o una base real para ejecutarse.
      include: ["lib/validators/**/*.ts", "lib/cobertura.ts", "lib/inventario.ts", "app/**/acciones.ts"],
      exclude: ["**/*.test.ts"],
      reporter: ["text", "cobertura", "html"],
      // Bajar de estos valores deja el pipeline en rojo.
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
