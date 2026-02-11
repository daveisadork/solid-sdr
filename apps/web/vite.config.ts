import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import Icons from "unplugin-icons/vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
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
      "/rtc": { target: "http://localhost:8080" },
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
