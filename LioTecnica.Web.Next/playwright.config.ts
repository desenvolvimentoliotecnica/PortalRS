import { defineConfig } from "@playwright/test";

// Se apontar para um front externo (QA/prod), pula o webServer local.
const baseURL = process.env.PORTALRH_E2E_BASE_URL ?? process.env.E2E_BASE_URL ?? "http://localhost:3000";
const isLocal = baseURL.includes("localhost") || baseURL.includes("127.0.0.1");

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: process.env.PLAYWRIGHT_UAT_VIDEO === "1"
      ? { mode: "on", size: { width: 1440, height: 950 } }
      : "retain-on-failure",
    launchOptions: {
      slowMo: process.env.PLAYWRIGHT_UAT_VIDEO === "1" ? 250 : 0,
    },
  },
  webServer: isLocal
    ? {
        command: "pnpm dev",
        url: "http://localhost:3000/app/login",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      }
    : undefined,
});
