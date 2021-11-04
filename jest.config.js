module.exports = {
  runner: "groups",
  verbose: true,
  bail: false,
  setupFilesAfterEnv: ["jest-allure/dist/setup", "./utils/setupJest.ts"],
  reporters: [
    "default",
    "jest-allure",
    "jest-junit",
    [
      "jest-html-reporters",
      {
        publicPath: "reports/html-report",
        filename: "report.html",
        expand: true,
        openReport: false,
      },
    ],
  ],
  globals: {
    Uint8Array: Uint8Array,
    ArrayBuffer: ArrayBuffer,
  },
};
