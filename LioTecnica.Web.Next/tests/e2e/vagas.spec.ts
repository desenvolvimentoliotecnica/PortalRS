import { test, expect } from "@playwright/test";

test("vagas renderiza UI básica (modo mock)", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-mock-auth": "1" });
  await page.goto("/app/vagas");

  await expect(page.getByPlaceholder("Buscar por título, código, área...")).toBeVisible({ timeout: 10000 });
});
