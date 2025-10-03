import globals from "globals";
import * as tseslint from "typescript-eslint";
import solid from "eslint-plugin-solid";
import turboConfig from "eslint-config-turbo/flat"; // flat config array

const config = [
  {
    ignores: ["**/build", "**/dist", "**/.turbo", "**/node_modules", "**/out"],
  },
  ...turboConfig,
  ...tseslint.configs.recommended,
  solid.configs["flat/recommended"],
];

export default config;
