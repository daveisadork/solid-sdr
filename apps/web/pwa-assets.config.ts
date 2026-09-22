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
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background, fit: "cover" },
    },
  },
  images: ["public/icon-transparent.svg"],
});
