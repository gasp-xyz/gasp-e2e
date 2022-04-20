// babel.config.js
module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    "@babel/preset-typescript",
  ],
  plugins: [
    "syntax-dynamic-import",
    ["@babel/plugin-proposal-decorators", { legacy: true }],
    "@babel/plugin-proposal-object-rest-spread",
  ],
};
