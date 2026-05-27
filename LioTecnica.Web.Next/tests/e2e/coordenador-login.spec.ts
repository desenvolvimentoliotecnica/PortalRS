import { expect, test } from "@playwright/test";
import { UatReport } from "./utils/uat-report";

const coordenadorEmail = process.env.PORTALRH_E2E_COORDENADOR_USER;
const coordenadorPassword = process.env.PORTALRH_E2E_COORDENADOR_PASSWORD;

test("coordenador consegue fazer login", async ({ page }, testInfo) => {
  const report = await UatReport.create("UAT - Login do coordenador", testInfo);
  await page.setViewportSize({ width: 1440, height: 950 });
  await report.installVisualCursor(page);

  test.skip(!coordenadorEmail || !coordenadorPassword, "Credenciais do coordenador não configuradas.");

  await report.step(page, "Acessar a tela de login", async () => {
    await page.goto("/app/login");
    await expect(page.locator("#email")).toBeVisible();
  });

  await report.step(page, "Informar credenciais do coordenador", async () => {
    await page.getByLabel("Email").fill(coordenadorEmail!);
    await page.locator("#password").fill(coordenadorPassword!);
  });

  await report.step(page, "Enviar login e validar dashboard", async () => {
    await page.locator("#loginSubmit").click();
    await expect(page).not.toHaveURL(/\/app\/login/);
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  await report.attachVideo(page);
  await report.writeHtml();
});
