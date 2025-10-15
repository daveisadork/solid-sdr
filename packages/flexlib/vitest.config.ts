import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    clearMocks: true,
    coverage: {
      all: true,
      include: ["src"],
      reporter: ["html", "lcov"],
    },
    exclude: ["lib", "node_modules"],
    setupFiles: ["console-fail-test/setup"],
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
      "@vita": path.resolve(__dirname, "src", "vita"),
      "@util": path.resolve(__dirname, "src", "util"),
      "@flex": path.resolve(__dirname, "src", "flex"),
    },
  },
});
