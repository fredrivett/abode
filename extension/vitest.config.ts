import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["**/*.{test,spec}.ts"],
    // e2e/ is Playwright (own runner); vitest must not pick up *.e2e.spec.ts.
    exclude: ["node_modules/**", ".output/**", ".wxt/**", "e2e/**"],
  },
});
