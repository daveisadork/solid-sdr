import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    node: "src/node.ts",
    bridge: "src/bridge.ts",
    flex: "src/flex/index.ts",
    vita: "src/vita/index.ts",
    util: "src/util/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
});
