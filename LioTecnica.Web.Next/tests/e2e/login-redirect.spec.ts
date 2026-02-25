import { test, expect } from "@playwright/test";

test("/dashboard redireciona para /Account/Login quando anon", async ({ page }) => {
  await page.goto("/app/dashboard");

  // SSR redirect on the server component.
  await page.waitForURL(/\/Account\/Login/);
  await expect(page).toHaveURL(/returnUrl=.*%2Fapp%2Fdashboard/);
});
