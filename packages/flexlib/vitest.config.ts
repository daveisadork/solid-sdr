import { defineConfig } from "vitest/config";

// Unit tests only. Integration tests (tests/integration/**/*.itest.ts) run
// against a real radio and have their own config: vitest.integration.config.ts.
export default defineConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    exclude: ["tests/integration/**"],
  },
});
