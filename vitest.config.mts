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
      // Toda la lógica de lib/ y los Server Actions se mide por patrón: un
      // módulo nuevo entra solo, sin editar esta lista (editarla en cada PR
      // provocaba conflictos entre ramas).
      include: ["lib/**/*.ts", "app/**/acciones.ts"],
      // Fuera quedan solo los archivos que necesitan una base real, un
      // navegador o variables de entorno para ejecutarse. Agregar un archivo
      // aquí exige justificarlo en el PR: es una excepción a la cobertura.
      exclude: [
        "**/*.test.ts",
        "lib/supabase/**",
        "lib/{auditoria,auth,binders,catalogo,env,etiquetas-idioma,etiquetas-rol,imagen-hd,imagenes,mazos}.ts",
      ],
      reporter: ["text", "cobertura", "html"],
      // Bajar de estos valores deja el pipeline en rojo.
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
