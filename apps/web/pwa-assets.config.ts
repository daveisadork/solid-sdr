import {
  defineConfig,
  minimal2023Preset,
} from "@vite-pwa/assets-generator/config";

const background = "#011d2d";

export default defineConfig({
  headLinkOptions: {
    preset: "2023",
  },
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background, fit: "cover" },
      padding: 0.2,
    },
    apple: {
      ...minimal2023Preset.apple,
      sizes: [180, 512],
      padding: 0,
    },
  },
  images: ["public/favicon.svg"],
});
