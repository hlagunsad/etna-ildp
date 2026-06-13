import { defineConfig } from "vitest/config";

// Vitest runs the unit tests only (the pure engine). Playwright owns the e2e/ specs.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
});
