import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import Icons from "unplugin-icons/vite";

export default defineConfig({
  plugins: [solidPlugin(), tailwindcss(), Icons({ compiler: "solid" })],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    allowedHosts: true,
    proxy: {
      "/ws": {
        target: "ws://localhost:8080",
        ws: true,
        rewriteWsOrigin: true,
      },
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
