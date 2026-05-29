import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { UatReport } from "./utils/uat-report";

const adminEmail = process.env.PORTALRH_E2E_ADMIN_USER ?? process.env.PORTALRH_E2E_RH_ESPECIALISTA_USER;
const adminPassword = process.env.PORTALRH_E2E_ADMIN_PASSWORD ?? process.env.PORTALRH_E2E_RH_ESPECIALISTA_PASSWORD;

type AuthInfo = { accessToken: string };
type TenantConfig = {
  rhDeveAprovarAposGestor: boolean;
  requisicoesVagaOrigemRm: boolean;
  aprovadorRhId: string | null;
};

test.setTimeout(180_000);

function requiredCredentials() {
  const missing = [
    ["PORTALRH_E2E_ADMIN_USER ou PORTALRH_E2E_RH_ESPECIALISTA_USER", adminEmail],
    ["PORTALRH_E2E_ADMIN_PASSWORD ou PORTALRH_E2E_RH_ESPECIALISTA_PASSWORD", adminPassword],
  ].filter(([, value]) => !value);

  test.skip(missing.length > 0, `Variáveis ausentes: ${missing.map(([name]) => name).join(", ")}`);
}

async function loginApi(request: APIRequestContext, email: string, password: string): Promise<AuthInfo> {
  const res = await request.post("/api/auth/auto-login", {
    data: { email, password },
  });
  const text = await res.text();
  expect(res.ok(), `Login API falhou para ${email}: ${text}`).toBe(true);
  return JSON.parse(text) as AuthInfo;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function getTenantConfig(request: APIRequestContext, token: string) {
  const res = await request.get("/api/tenant-configuracao", { headers: authHeaders(token) });
  const text = await res.text();
  expect(res.ok(), `GET tenant-configuracao falhou: ${text}`).toBe(true);
  return JSON.parse(text) as TenantConfig;
}

async function putTenantConfig(request: APIRequestContext, token: string, config: TenantConfig) {
  const res = await request.put("/api/tenant-configuracao", {
    headers: authHeaders(token),
    data: config,
  });
  const text = await res.text();
  expect(res.ok(), `PUT tenant-configuracao falhou: ${text}`).toBe(true);
  return JSON.parse(text) as TenantConfig;
}

async function loginUi(page: Page, email: string, password: string) {
  await page.goto("/app/login");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#loginSubmit").click();
  await page.waitForURL(/\/app\/dashboard/, { timeout: 20_000 });
}

test("flag de requisições RM oculta criação e mantém rastreabilidade", async ({ page, request }, testInfo) => {
  requiredCredentials();

  const report = await UatReport.create("UAT - Requisições aprovadas pelo RM", testInfo);
  await page.setViewportSize({ width: 1440, height: 950 });
  await report.installVisualCursor(page);

  const auth = await loginApi(request, adminEmail!, adminPassword!);
  const originalConfig = await getTenantConfig(request, auth.accessToken);

  try {
    await report.step(page, "Admin ativa origem RM para requisições de vaga", async () => {
      await putTenantConfig(request, auth.accessToken, {
        ...originalConfig,
        requisicoesVagaOrigemRm: true,
      });
      await loginUi(page, adminEmail!, adminPassword!);
      await page.goto("/app/admin/tenant-configuracao");
      await expect(page.getByText(/Requisições de vaga vêm aprovadas do RM/i)).toBeVisible({ timeout: 20_000 });
    });

    await report.step(page, "Portal oculta criação e aprovação de requisições", async () => {
      await page.goto("/app/gestao/solicitacoes");
      await expect(page.getByText(/Requisições vêm aprovadas do RM/i)).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('[data-testid="btn-nova-posicao"]')).toHaveCount(0);
      await expect(page.getByText(/Distribuir para Analista de RH/i).first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Ações/i).first()).toBeVisible({ timeout: 20_000 });
    });

    await report.step(page, "Endpoint de importação respeita a flag ativa", async () => {
      const res = await request.post("/api/rm/solicitacao-vaga/importar-aprovadas", {
        headers: authHeaders(auth.accessToken),
        data: { pageSize: 10 },
      });
      const text = await res.text();
      expect(res.ok(), `Importação RM falhou: ${text}`).toBe(true);
      const body = JSON.parse(text) as { totalLidos: number; criados: number; atualizados: number; ignorados: number };
      expect(body.totalLidos).toBeGreaterThanOrEqual(0);
      await page.goto("/app/integracao-totvs");
      await expect(page.getByText(/Integração TOTVS|Requisições\/Solicitações RM/i).first()).toBeVisible({ timeout: 20_000 });
    });
  } finally {
    await putTenantConfig(request, auth.accessToken, originalConfig).catch(() => undefined);
  }

  await report.attachVideo(page);
  await report.writeHtml();
});
