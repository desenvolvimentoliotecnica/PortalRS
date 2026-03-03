import { test, expect } from "@playwright/test";

test("PortalVagas carrega (público, sem auth)", async ({ page }) => {
  await page.goto("/app/PortalVagas?tenantId=liotecnica");

  await expect(page.getByText("Portal de Vagas").first()).toBeVisible({ timeout: 10000 });
});
