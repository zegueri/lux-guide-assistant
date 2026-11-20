import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Même alias que tsconfig.json : "@/lib/..." -> "src/lib/..."
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // PGlite démarre un Postgres complet en WebAssembly : on laisse un peu de marge.
    testTimeout: 30_000,
  },
});
