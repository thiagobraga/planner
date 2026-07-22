import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // v5, not v7: v7 bundles the React Compiler rules, which target React 19 and
  // flag 31 pre-existing patterns unrelated to the exhaustive-deps disable
  // comments already in this codebase.
  reactHooks.configs["recommended-latest"],
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  }
);
