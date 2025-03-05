import prettierPlugin from "eslint-plugin-prettier";
import jestPlugin from "eslint-plugin-jest";
import importPlugin from "eslint-plugin-import";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";
import js from "@eslint/js";

export default [
  // Base configuration for all files
  {
    ignores: [
      "**/node_modules/**", 
      "test/exploratory/**", 
      "**/reports/**", 
      "**/.yarn/**",
      "utils/globalSetup.js",
      "utils/globalTeardown.js"
    ],
  },
  
  // JavaScript files
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
  
  // TypeScript files
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tseslint,
      prettier: prettierPlugin,
      jest: jestPlugin,
      import: importPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...jestPlugin.environments.globals.globals,
      },
    },
    settings: {
      "import/resolver": {
        typescript: {},
      },
    },
    rules: {
      // Base rules
      "no-var": "warn",
      "prefer-const": "warn",
      "no-console": "warn",
      "curly": "warn",
      
      // Prettier integration
      "prettier/prettier": "warn",
      "arrow-body-style": "off",
      "prefer-arrow-callback": "off",
      
      // Disable specific rules
      "testing-library/no-debugging-utils": "off",
      
      // TypeScript specific rules
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];