module.exports = {
  extends: ["eslint-config-mangata/eslint.config-jest", "prettier"],
  globals: {},
  rules: {},
  plugins: [
      "prettier",
      "cypress"
  ],
  env: {
    "cypress/globals": true
  }
};
