import { expect, test, type Page } from "@playwright/test";
import { UatReport } from "./utils/uat-report";

const coordenadorEmail = process.env.PORTALRH_E2E_COORDENADOR_USER;
const coordenadorPassword = process.env.PORTALRH_E2E_COORDENADOR_PASSWORD;

test.setTimeout(120_000);

async function loginComoCoordenador(page: Page) {
  test.skip(!coordenadorEmail || !coordenadorPassword, "Credenciais do coordenador não configuradas.");

  await page.goto("/app/login");
  await page.locator("#email").fill(coordenadorEmail!);
  await page.locator("#password").fill(coordenadorPassword!);
  await page.locator("#loginSubmit").click();
  await page.waitForURL(/\/app\/dashboard/, { timeout: 20_000 });
}

async function selecionarPrimeiraOpcaoAutocomplete(page: Page, placeholder: RegExp) {
  const initialInput = page.getByPlaceholder(placeholder).first();
  if ((await initialInput.count()) === 0) return;
  await expect(initialInput).toBeVisible({ timeout: 20_000 });

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const input = page.getByPlaceholder(placeholder).first();
    if ((await input.count()) === 0) return;
    try {
      await input.click({ force: true, timeout: 5_000 });
      break;
    } catch (error) {
      if (attempt === 5) throw error;
      await page.waitForTimeout(500);
    }
  }

  const opcao = page.locator(".absolute.z-50 button").first();
  try {
    await expect(opcao).toBeVisible({ timeout: 20_000 });
  } catch (error) {
    if ((await page.getByPlaceholder(placeholder).count()) === 0) return;
    throw error;
  }
  await opcao.click();

  const input = page.getByPlaceholder(placeholder).first();
  await expect(input).not.toHaveValue("", { timeout: 5_000 });
}

async function selecionarMotivoSemDesligamento(page: Page) {
  const motivoSelect = page.locator('[data-testid="select-motivo-requisicao"]');
  await expect(motivoSelect).toBeVisible({ timeout: 20_000 });

  await page.waitForFunction(() => {
    const select = document.querySelector<HTMLSelectElement>('[data-testid="select-motivo-requisicao"]');
    return !!select && select.options.length > 1;
  });

  const motivoValue = await motivoSelect.evaluate((el) => {
    const select = el as HTMLSelectElement;
    const option = Array.from(select.options).find((o) => {
      const text = o.textContent ?? "";
      return o.value && !/demiss|deslig/i.test(text);
    });
    return option?.value ?? "";
  });

  expect(motivoValue, "deve existir um motivo de requisição sem desligamento").toBeTruthy();
  await motivoSelect.selectOption(motivoValue);
}

async function selecionarTurnoOuHorarioLegado(page: Page) {
  await page.getByRole("button", { name: /Horário/i }).click();

  const turnoInput = page.getByPlaceholder(/Buscar turno/i).first();
  await expect(turnoInput).toBeVisible({ timeout: 10_000 });
  await turnoInput.click();

  const primeiraOpcao = page.locator(".absolute.z-50 button").first();
  if (await primeiraOpcao.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await primeiraOpcao.click();
    await expect(turnoInput).not.toHaveValue("", { timeout: 5_000 });
    return;
  }

  await page
    .getByPlaceholder(/Use apenas se ainda não existir turno/i)
    .fill("Segunda a sexta, 08:00 às 17:00, com 1h de intervalo.");
}

async function buscarSolicitacaoCriada(page: Page, id: string) {
  return await page.evaluate(async (solicitacaoId) => {
    const token = localStorage.getItem("renderrh.accessToken");
    const tenantId = localStorage.getItem("renderrh.tenantId");
    const res = await fetch(`/api/solicitacoes-vaga/${encodeURIComponent(solicitacaoId)}`, {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
      },
    });
    const text = await res.text();
    return { status: res.status, text };
  }, id);
}

test("coordenador cria uma requisição de vaga pela UI", async ({ page }, testInfo) => {
  const report = await UatReport.create("UAT - Coordenador cria requisição de vaga", testInfo);
  await page.setViewportSize({ width: 1440, height: 950 });
  await report.installVisualCursor(page);
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const justificativa = `E2E criação de requisição pelo coordenador ${stamp}`;
  let createdId: string | null = null;

  await report.step(page, "Coordenador acessa a tela de solicitações", async () => {
    await loginComoCoordenador(page);
    await page.goto("/app/gestao/solicitacoes");
    await expect(page.locator('[data-testid="btn-nova-posicao"]')).toBeVisible({ timeout: 20_000 });
  });

  await report.step(page, "Abrir formulário de nova posição", async () => {
    await page.locator('[data-testid="btn-nova-posicao"]').click();
    await expect(page.getByRole("dialog", { name: /Requisição de Pessoal/i })).toBeVisible();
  });
  await page.waitForTimeout(1_000);

  await report.step(page, "Preencher identificação e função RM", async () => {
    await selecionarPrimeiraOpcaoAutocomplete(page, /Buscar empresa/i);
    await selecionarPrimeiraOpcaoAutocomplete(page, /Buscar filial/i);
    await selecionarPrimeiraOpcaoAutocomplete(page, /Buscar seção/i);
    await selecionarPrimeiraOpcaoAutocomplete(page, /Buscar função RM/i);
  });

  await report.step(page, "Preencher dados da requisição", async () => {
    const faixaSalarial = page.getByPlaceholder("R$ 0,00");
    await faixaSalarial.nth(0).fill("500000");
    await faixaSalarial.nth(1).fill("700000");

    await selecionarMotivoSemDesligamento(page);
    await page.locator('[data-testid="radio-decisao-consumir"]').check();
    await page.getByPlaceholder(/Justifique a necessidade/i).fill(justificativa);
  });

  await report.step(page, "Preencher horário ou turno", async () => {
    await selecionarTurnoOuHorarioLegado(page);
  });

  await report.step(page, "Enviar requisição para aprovação", async () => {
    const createResponsePromise = page.waitForResponse((response) => {
      const url = response.url();
      return (
        response.request().method() === "POST" &&
        /\/api\/solicitacoes-vaga\/?$/.test(url)
      );
    }, { timeout: 30_000 });

    await page.getByRole("button", { name: /Solicitar aprovação/i }).click();

    const createResponse = await createResponsePromise;
    const createText = await createResponse.text();
    expect(createResponse.ok(), `POST /api/solicitacoes-vaga falhou: ${createText}`).toBe(true);

    const created = JSON.parse(createText) as { id?: string; justificativa?: string | null };
    expect(created.id, "API deve retornar o id da requisição criada").toBeTruthy();
    createdId = created.id!;
  });

  await report.step(page, "Validar requisição criada na API", async () => {
    if (!createdId) throw new Error("Requisição não foi criada.");

    const detail = await buscarSolicitacaoCriada(page, createdId);
    expect(detail.status, `GET requisição criada falhou: ${detail.text}`).toBe(200);

    const solicitacao = JSON.parse(detail.text) as {
      justificativa?: string | null;
      status?: string;
      urgencia?: string;
      solicitanteNome?: string | null;
    };

    expect(solicitacao.justificativa).toBe(justificativa);
    expect(solicitacao.status).toBe("PendenteAprovacao");
    expect(solicitacao.urgencia).toBe("Media");
    expect(solicitacao.solicitanteNome).toBeTruthy();
  });

  await report.attachVideo(page);
  await report.writeHtml();
});
