import { defineConfig } from "@playwright/test";

// Se apontar para um front externo (QA/prod), pula o webServer local.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const isLocal = baseURL.includes("localhost") || baseURL.includes("127.0.0.1");

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
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
