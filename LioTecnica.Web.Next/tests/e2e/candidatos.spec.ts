import { test, expect } from "@playwright/test";

test("candidatos renderiza UI básica (modo mock)", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-mock-auth": "1" });
  await page.goto("/app/candidatos");

  await expect(page.getByRole("heading", { name: "Candidatos" })).toBeVisible({ timeout: 10000 });
});
