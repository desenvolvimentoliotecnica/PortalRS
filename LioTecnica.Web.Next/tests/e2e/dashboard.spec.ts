import { test, expect } from "@playwright/test";

test("dashboard renderiza UI básica (modo mock)", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-mock-auth": "1" });
  await page.goto("/app/dashboard");

  await expect(page.getByText("Bem-vindo(a)")).toBeVisible();
  await expect(page.getByText("Dev User")).toBeVisible();
});
