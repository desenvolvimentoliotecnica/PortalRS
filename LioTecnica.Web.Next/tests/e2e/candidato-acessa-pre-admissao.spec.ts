import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { UatReport } from "./utils/uat-report";

const portalVagasUrl = process.env.PORTALRH_E2E_PORTAL_VAGAS_URL ?? "http://10.0.0.80:3050";
const portalRhUrl = process.env.PORTALRH_E2E_BASE_URL ?? "http://10.0.0.80:3000";
const tenantId = process.env.PORTALRH_E2E_TENANT ?? "liotecnica";

const candidatoEmail = process.env.PORTALRH_E2E_CANDIDATO_USER;
const candidatoPassword = process.env.PORTALRH_E2E_CANDIDATO_PASSWORD;

const rhEmail =
  process.env.PORTALRH_E2E_RH_ANALISTA_USER ??
  process.env.PORTALRH_E2E_RH_ESPECIALISTA_USER ??
  process.env.PORTALRH_E2E_OWNER_USER;
const rhPassword =
  process.env.PORTALRH_E2E_RH_ANALISTA_PASSWORD ??
  process.env.PORTALRH_E2E_RH_ESPECIALISTA_PASSWORD ??
  process.env.PORTALRH_E2E_OWNER_PASSWORD;

test.setTimeout(180_000);

function gerarCpf(): string {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  for (let i = 0; i < 2; i += 1) {
    const soma = base.reduce((acc, digit, index) => acc + (base.length + 1 - index) * digit, 0);
    const dv = (soma * 10) % 11;
    base.push(dv === 10 ? 0 : dv);
  }
  return base.join("");
}

function portalPath(path: string) {
  return `${portalVagasUrl.replace(/\/$/, "")}${path}`;
}

async function loginRhViaApi(request: APIRequestContext) {
  test.skip(!rhEmail || !rhPassword, "Credenciais RH/owner não configuradas para preparar a pré-admissão.");

  const res = await request.post("/api/auth/auto-login", {
    data: { email: rhEmail, password: rhPassword },
  });
  const text = await res.text();
  expect(res.ok(), `Login RH falhou: ${text}`).toBe(true);

  const body = JSON.parse(text) as { accessToken?: string; tenantId?: string };
  expect(body.accessToken, "Login RH deve retornar accessToken").toBeTruthy();
  return body.accessToken!;
}

async function portalAuthLogin(request: APIRequestContext) {
  test.skip(!candidatoEmail || !candidatoPassword, "Credenciais do candidato não configuradas.");

  const res = await request.post("/api/public/portal-auth/login", {
    headers: { "X-Tenant-Id": tenantId },
    data: { email: candidatoEmail, password: candidatoPassword },
  });
  const text = await res.text();
  expect(res.ok(), `Login candidato via API falhou: ${text}`).toBe(true);

  const body = JSON.parse(text) as { id?: string; nome?: string; email?: string };
  expect(body.id, "Login candidato deve retornar id").toBeTruthy();
  return body;
}

async function prepararPreAdmissao(request: APIRequestContext) {
  const token = await loginRhViaApi(request);
  const candidato = await portalAuthLogin(request);
  const cpf = gerarCpf();

  const createRes = await request.post("/api/pre-admissao", {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Tenant-Id": tenantId,
    },
    data: {
      preenchidoPor: "Candidato",
      candidatoId: candidato.id,
      nome: candidato.nome ?? "Candidato E2E",
      cpf,
    },
  });
  const createText = await createRes.text();
  expect(createRes.ok(), `Criação da pré-admissão falhou: ${createText}`).toBe(true);

  const created = JSON.parse(createText) as { id?: string };
  expect(created.id, "Pré-admissão deve retornar id").toBeTruthy();

  const linkRes = await request.post(`/api/pre-admissao/${created.id}/gerar-link`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Tenant-Id": tenantId,
    },
    data: {
      cpf,
      enviarEmail: false,
      enviarWhatsapp: false,
    },
  });
  const linkText = await linkRes.text();
  expect(linkRes.ok(), `Geração do link de pré-admissão falhou: ${linkText}`).toBe(true);

  const link = JSON.parse(linkText) as { publicUrl?: string };
  const url = new URL(
    link.publicUrl ?? `/app/DocumentoAdmissao?tenantId=${tenantId}&preAdmissaoId=${created.id}`,
    portalRhUrl,
  );

  return {
    candidato,
    cpf,
    preAdmissaoId: created.id!,
    publicUrl: url.toString(),
  };
}

test("candidato acessa o formulário de pré-admissão", async ({ page, request }, testInfo) => {
  const report = await UatReport.create("UAT - Candidato acessa formulário de pré-admissão", testInfo);
  await page.setViewportSize({ width: 1440, height: 950 });
  await report.installVisualCursor(page);

  let setup: Awaited<ReturnType<typeof prepararPreAdmissao>> | null = null;

  await report.step(page, "Preparar pré-admissão de teste para o candidato", async () => {
    setup = await prepararPreAdmissao(request);
  });

  await report.step(page, "Candidato acessa a tela de login do Portal de Vagas", async () => {
    await page.goto(portalPath(`/app/PortalVagas/Acesso?tenantId=${encodeURIComponent(tenantId)}`));
    await expect(page.getByRole("heading", { name: /Acesse sua conta/i })).toBeVisible({ timeout: 20_000 });
  });

  await report.step(page, "Candidato informa e-mail e senha", async () => {
    await page.getByPlaceholder(/voce@empresa\.com/i).fill(candidatoEmail!);
    await page.getByPlaceholder(/Mínimo 8 caracteres/i).fill(candidatoPassword!);
  });

  await report.step(page, "Candidato entra no workspace do Portal de Vagas", async () => {
    await page.getByRole("button", { name: /Entrar no portal/i }).click();
    await expect(page.getByText(/Minhas candidaturas|Meu perfil|Vagas abertas|Olá|Leonardo/i).first()).toBeVisible({ timeout: 20_000 });
  });

  await report.step(page, "Candidato abre o link público da pré-admissão", async () => {
    if (!setup) throw new Error("Pré-admissão não foi preparada.");
    await page.goto(setup.publicUrl);
    await expect(page.getByRole("heading", { name: /Portal de Admissao/i })).toBeVisible({ timeout: 20_000 });
  });

  await report.step(page, "Candidato informa CPF para acessar o formulário", async () => {
    if (!setup) throw new Error("Pré-admissão não foi preparada.");
    await page.getByPlaceholder("000.000.000-00").fill(setup.cpf);
  });

  await report.step(page, "Sistema abre o wizard/formulário de pré-admissão", async () => {
    await page.getByRole("button", { name: /Acessar Portal/i }).click();
    await expect(page.getByText(/Bem-vindo|Documentos|Dados pessoais|Revisão/i).first()).toBeVisible({ timeout: 20_000 });
  });

  await report.step(page, "Validar que o candidato está no formulário correto", async () => {
    if (!setup) throw new Error("Pré-admissão não foi preparada.");
    await expect(page).toHaveURL(new RegExp(`preAdmissaoId=${setup.preAdmissaoId}`));
    await expect(page.getByText(setup.candidato.nome ?? "Candidato").first()).toBeVisible({ timeout: 20_000 });
  });

  await report.attachVideo(page);
  await report.writeHtml();
});
