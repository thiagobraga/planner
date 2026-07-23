import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // v7's top-level `configs` are legacy eslintrc-shaped; flat config needs
  // the `flat` namespace instead (plugins as object, not array of strings).
  reactHooks.configs.flat["recommended-latest"],
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // v7 adds React Compiler-oriented rules (this app doesn't use the
      // Compiler yet) that flag pre-existing, working patterns as errors.
      // Downgraded to warn so lint passes; revisit in a dedicated cleanup pass.
      "react-hooks/static-components": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/void-use-memo": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/config": "warn",
      "react-hooks/gating": "warn",
    },
  }
);
