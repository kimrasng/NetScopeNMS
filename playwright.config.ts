import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./apps/web/e2e", fullyParallel: false, workers: 1,
  retries: process.env.CI ? 1 : 0,
  outputDir: process.env.TEST_OUTPUT_DIR ? `${process.env.TEST_OUTPUT_DIR}/browser-results` : "test-results",
  reporter: [["list"], ["html", { open: "never" }], ["json", { outputFile: process.env.TEST_OUTPUT_DIR ? `${process.env.TEST_OUTPUT_DIR}/browser-summary.json` : "test-results/browser-summary.json" }]],
  use: { baseURL: process.env.TEST_WEB_URL ?? "http://127.0.0.1:3000", browserName: "chromium", screenshot: "only-on-failure", trace: "off" },
});
