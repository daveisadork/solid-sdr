import eslint from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/*.snap", "coverage", "lib", "node_modules", "pnpm-lock.yaml"],
  },
  { linterOptions: { reportUnusedDisableDirectives: "error" } },
  eslint.configs.recommended,
  {
    extends: [
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
    ],
    rules: { "@typescript-eslint/restrict-template-expressions": "off" },
    files: ["**/*.{js,ts}"],
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["*.config.*s"] },
      },
    },
    settings: { vitest: { typecheck: true } },
  },
  {
    extends: [vitest.configs.recommended],
    files: ["**/*.test.*"],
    rules: { "@typescript-eslint/no-unsafe-assignment": "off" },
  },
);
