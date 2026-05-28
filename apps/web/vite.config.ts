import { execSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import Icons from "unplugin-icons/vite";
import { visualizer } from "rollup-plugin-visualizer";

function getVersion(): string {
  try {
    return execSync("git describe --tags", { encoding: "utf8" }).trim();
  } catch {
    const pkg = JSON.parse(readFileSync("./package.json", "utf8")) as {
      version: string;
    };
    return `v${pkg.version}`;
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(getVersion()),
  },
  plugins: [
    solidPlugin(),
    tailwindcss(),
    Icons({ compiler: "solid" }),
    visualizer(),
  ],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
      "@repo/flexlib": path.resolve(__dirname, "../../packages/flexlib/src"),
    },
  },
  server: {
    port: 3003,
    allowedHosts: true,
    proxy: {
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
        rewriteWsOrigin: true,
      },
      "/defaults.json": { target: "http://localhost:8080" },
    },
    headers: {
      // cross-origin isolation for SAB in dev
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  },
  build: {
    target: "esnext",
  },
});
