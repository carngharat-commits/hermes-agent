import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "node_modules", "server"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Components lifted from the single-file artifact still use loose props.
      "@typescript-eslint/no-explicit-any": "off",
      // Several components keep a prop in their signature for call-site
      // symmetry without reading it yet; unused *locals* still error.
      "@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
    },
  },
]);
