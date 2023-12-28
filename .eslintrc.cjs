module.exports = {
  extends: ['react-app', 'react-app/jest', 'prettier'],
  globals: {},
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
  plugins: ["prettier"],
  overrides: [
    {
      files: ['**/*.ts?(x)'],
      rules: {},
    },
  ],
};
