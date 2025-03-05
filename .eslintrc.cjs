module.exports = {
  extends: ['prettier'],
  globals: {},
  settings: {
    react: {
      version: '999.999.999',
    },
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  parser: '@typescript-eslint/parser',
  rules: {
    'no-var': 'warn',
    'prefer-const': 'warn',
    'no-console': 'warn',
    'prettier/prettier': 'warn',
    'arrow-body-style': 'off',
    'prefer-arrow-callback': 'off',
    'curly': 'warn',
    "testing-library/no-debugging-utils" : 'off',
  },
  plugins: ["prettier", "react", "jest", "import"],
  overrides: [
    {
      files: ['**/*.ts?(x)'],
      rules: {},
    },
  ],
  env: {
    "jest/globals": true,
    "node": true,
    "es6": true
  },
  settings: {
    "import/resolver": {
      "typescript": {}
    }
  },
};
