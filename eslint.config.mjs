import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    files: ["src/**/*.js", "src/**/*.jsx"],
    ignores: ["src/**/*.test.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    // Existing exhaustive-deps disable comments stay as documentation of
    // deliberately-incomplete dep arrays; the rule itself is off.
    linterOptions: { reportUnusedDisableDirectives: "off" },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      "no-undef": "error",
      "react/jsx-no-undef": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    files: ["src/**/*.test.js", "netlify/functions/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: { "no-undef": "error" },
  },
];
