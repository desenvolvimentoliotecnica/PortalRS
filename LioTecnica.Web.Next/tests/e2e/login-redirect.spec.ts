import { test, expect } from "@playwright/test";

test("/dashboard redireciona para /app/login quando anon", async ({ page }) => {
  await page.goto("/app/dashboard");

  // AuthGuard redireciona para /app/login com returnUrl
  await page.waitForURL(/\/app\/login/);
  await expect(page).toHaveURL(/returnUrl=.*%2Fapp%2Fdashboard/);
});
