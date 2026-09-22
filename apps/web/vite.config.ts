import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";
import Icons from "unplugin-icons/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import solidPlugin from "vite-plugin-solid";

const coiHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Resource-Policy": "same-origin",
};

function getVersion(): string {
  if (process.env.APP_VERSION) {
    return process.env.APP_VERSION;
  }
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
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeManifestIcons: false,
      devOptions: {
        enabled: true,
        // generateSW globs dist, which does not exist in `vite`. Give workbox a dummy file.
        suppressWarnings: true,
      },
      manifest: {
        name: "SolidSDR",
        short_name: "SolidSDR",
        description: "Web client for FlexRadio SmartSDR radios.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#011d2d",
        theme_color: "#000000",
      },
      pwaAssets: {
        config: true,
      },
      workbox: {
        // Workbox-generated responses omit COOP/COEP. This app needs those
        // headers on documents for SharedArrayBuffer, so do not precache HTML
        // or intercept navigations.
        globPatterns: ["**/*.{js,css,wasm,svg,png,ico}"],
        navigateFallback: "",
        cleanupOutdatedCaches: true,
        inlineWorkboxRuntime: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "~": path.resolve(import.meta.dirname, "src"),
      "@repo/flexlib": path.resolve(
        import.meta.dirname,
        "../../packages/flexlib/src",
      ),
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
    headers: coiHeaders,
  },
  preview: {
    headers: coiHeaders,
  },
  build: {
    target: "esnext",
  },
});
