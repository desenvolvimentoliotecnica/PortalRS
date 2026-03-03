import { test, expect } from "@playwright/test";

test("Owner Tenants renderiza UI básica (modo mock)", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-mock-auth": "1" });
  await page.goto("/app/Owner/Tenants");

  await expect(page.getByText("Tenants", { exact: false }).first()).toBeVisible({ timeout: 10000 });
});
