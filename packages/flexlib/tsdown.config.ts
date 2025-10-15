import { defineConfig } from "tsdown";

export default defineConfig({
  platform: "neutral",
  dts: true,
  entry: ["src/**/*.ts", "!src/**/*.test.*"],
  outDir: "lib",
  unbundle: true,
  alias: {
    "~": "./src",
  },
});
