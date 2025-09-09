import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import assemblyScriptPlugin from "vite-plugin-assemblyscript-asc";
import Icons from "unplugin-icons/vite";

// Simple dev-only middleware to set COOP/COEP
function coopCoepDevHeaders() {
  return {
    name: "dev-coop-coep",
    apply: "serve", // dev only
    configureServer(server: import("vite").ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
        next();
      });
    },
  };
}

export default defineConfig({
  server: {
    experimental: {
      websocket: true,
    },
  },
  ssr: false,
  vite: {
    server: {
      allowedHosts: true,
    },
    plugins: [
      coopCoepDevHeaders(),
      tailwindcss(),
      assemblyScriptPlugin(),
      Icons({ compiler: "solid" }),
    ],
  },
  devOverlay: false,
})
  .addRouter({
    name: "connect",
    type: "http",
    handler: "./src/ws/connect.ts",
    target: "server",
    base: "/connect",
  })
  .addRouter({
    name: "discover",
    type: "http",
    handler: "./src/ws/discover.ts",
    target: "server",
    base: "/discover",
  });
