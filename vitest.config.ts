import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["./test/v2/**/*.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    testTimeout: 3600000,
    hookTimeout: 3600000,
    threads: true,
    reporters: ["verbose"],
    setupFiles: "./utils/v2/setupVitest.ts",
  },
});
