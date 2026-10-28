import { defineConfig, type UserConfig } from "tsdown";

const config: UserConfig = defineConfig({
  entry: {
    index: "src/index.ts",
    node: "src/node.ts",
    bridge: "src/bridge.ts",
    flex: "src/flex/index.ts",
    vita: "src/vita/index.ts",
    util: "src/util/index.ts",
  },
  format: ["esm", "cjs"],
  tsconfig: "tsconfig.build.json",
  dts: true,
  sourcemap: true,
  clean: true,
});

export default config;
