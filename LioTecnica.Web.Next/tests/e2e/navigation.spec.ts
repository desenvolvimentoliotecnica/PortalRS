import { test, expect } from "@playwright/test";

test.skip("home redireciona para /dashboard (com basePath /app)", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-mock-auth": "1" });
  await page.goto("/app");

  await expect(page).toHaveURL(/\/app\/dashboard\/?$/);
  await expect(page.getByText("Portal RH").first()).toBeVisible();
});
