import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.js", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        __app_id: "readonly",
        __firebase_config: "readonly",
        __initial_auth_token: "readonly",
      },
    },
    rules: {
      "no-console": "off",
    },
  },
];
