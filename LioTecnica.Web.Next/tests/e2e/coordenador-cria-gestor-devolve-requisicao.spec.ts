import { expect, test, type Page } from "@playwright/test";
import { UatReport } from "./utils/uat-report";

const coordenadorEmail = process.env.PORTALRH_E2E_COORDENADOR_USER;
const coordenadorPassword = process.env.PORTALRH_E2E_COORDENADOR_PASSWORD;
const gestorEmail = process.env.PORTALRH_E2E_GESTOR_USER;
const gestorPassword = process.env.PORTALRH_E2E_GESTOR_PASSWORD;

test.setTimeout(240_000);

async function login(page: Page, email: string | undefined, password: string | undefined, papel: string) {
  test.skip(!email || !password, `Credenciais do ${papel} não configuradas.`);

  await page.goto("/app/login");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.locator("#email").fill(email!);
  await page.locator("#password").fill(password!);
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

async function criarRequisicaoComoCoordenador(page: Page) {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const justificativa = `E2E devolução para ajuste ${stamp}`;

  await login(page, coordenadorEmail, coordenadorPassword, "coordenador");
  await page.goto("/app/gestao/solicitacoes");

  await page.locator('[data-testid="btn-nova-posicao"]').click();
  await expect(page.getByRole("dialog", { name: /Requisição de Pessoal/i })).toBeVisible();
  await page.waitForTimeout(1_000);

  await selecionarPrimeiraOpcaoAutocomplete(page, /Buscar empresa/i);
  await selecionarPrimeiraOpcaoAutocomplete(page, /Buscar filial/i);
  await selecionarPrimeiraOpcaoAutocomplete(page, /Buscar seção/i);
  await selecionarPrimeiraOpcaoAutocomplete(page, /Buscar função RM/i);

  const faixaSalarial = page.getByPlaceholder("R$ 0,00");
  await faixaSalarial.nth(0).fill("500000");
  await faixaSalarial.nth(1).fill("700000");

  await selecionarMotivoSemDesligamento(page);
  await page.locator('[data-testid="radio-decisao-consumir"]').check();
  await page.getByPlaceholder(/Justifique a necessidade/i).fill(justificativa);

  await selecionarTurnoOuHorarioLegado(page);

  const createResponsePromise = page.waitForResponse((response) => {
    return response.request().method() === "POST" && /\/api\/solicitacoes-vaga\/?$/.test(response.url());
  }, { timeout: 30_000 });

  await page.getByRole("button", { name: /Solicitar aprovação/i }).click();

  const createResponse = await createResponsePromise;
  const createText = await createResponse.text();
  expect(createResponse.ok(), `POST /api/solicitacoes-vaga falhou: ${createText}`).toBe(true);

  const created = JSON.parse(createText) as { id?: string };
  expect(created.id, "API deve retornar o id da requisição criada").toBeTruthy();

  return { id: created.id!, justificativa };
}

async function buscarSolicitacao(page: Page, id: string) {
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

test("gestor direto devolve a requisição para ajuste", async ({ page }, testInfo) => {
  const report = await UatReport.create("UAT - Gestor devolve requisição para ajuste", testInfo);
  let requisicao: { id: string; justificativa: string } | null = null;
  let createResponseText = "";
  const observacao = `E2E gestor devolveu para ajuste ${new Date().toISOString()}`;
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const justificativa = `E2E devolução para ajuste ${stamp}`;

  await page.setViewportSize({ width: 1440, height: 950 });
  await report.installVisualCursor(page);

  await report.step(page, "Coordenador acessa a tela de login", async () => {
    test.skip(!coordenadorEmail || !coordenadorPassword, "Credenciais do coordenador não configuradas.");
    await page.goto("/app/login");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator("#email")).toBeVisible({ timeout: 20_000 });
  });

  await report.step(page, "Coordenador informa as credenciais", async () => {
    await page.locator("#email").fill(coordenadorEmail!);
    await page.locator("#password").fill(coordenadorPassword!);
  });

  await report.step(page, "Coordenador autentica e acessa o dashboard", async () => {
    await page.locator("#loginSubmit").click();
    await page.waitForURL(/\/app\/dashboard/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  await report.step(page, "Coordenador acessa a tela de solicitações", async () => {
    await page.goto("/app/gestao/solicitacoes");
    await expect(page.locator('[data-testid="btn-nova-posicao"]')).toBeVisible({ timeout: 20_000 });
  });

  await report.step(page, "Coordenador abre o formulário de nova posição", async () => {
    await page.locator('[data-testid="btn-nova-posicao"]').click();
    await expect(page.getByRole("dialog", { name: /Requisição de Pessoal/i })).toBeVisible();
    await page.waitForTimeout(1_000);
  });

  await report.step(page, "Sistema carrega Empresa, Filial e Seção do coordenador", async () => {
    await selecionarPrimeiraOpcaoAutocomplete(page, /Buscar empresa/i);
    await selecionarPrimeiraOpcaoAutocomplete(page, /Buscar filial/i);
    await selecionarPrimeiraOpcaoAutocomplete(page, /Buscar seção/i);
    await expect(page.getByText(/Empresa \*/i)).toBeVisible();
    await expect(page.getByText(/Seção \*/i)).toBeVisible();
  });

  await report.step(page, "Coordenador seleciona a função RM da requisição", async () => {
    await selecionarPrimeiraOpcaoAutocomplete(page, /Buscar função RM/i);
    await expect(page.getByPlaceholder(/Buscar função RM/i).first()).not.toHaveValue("", { timeout: 5_000 });
  });

  await report.step(page, "Coordenador preenche faixa salarial", async () => {
    const faixaSalarial = page.getByPlaceholder("R$ 0,00");
    await faixaSalarial.nth(0).fill("500000");
    await faixaSalarial.nth(1).fill("700000");
  });

  await report.step(page, "Coordenador seleciona motivo e decisão de headcount", async () => {
    await selecionarMotivoSemDesligamento(page);
    await page.locator('[data-testid="radio-decisao-consumir"]').check();
  });

  await report.step(page, "Coordenador informa a justificativa da requisição", async () => {
    await page.getByPlaceholder(/Justifique a necessidade/i).fill(justificativa);
  });

  await report.step(page, "Coordenador acessa a aba Horário", async () => {
    await page.getByRole("button", { name: /Horário/i }).click();
    await expect(page.getByPlaceholder(/Buscar turno/i).first()).toBeVisible({ timeout: 10_000 });
  });

  await report.step(page, "Coordenador seleciona turno ou informa horário legado", async () => {
    const turnoInput = page.getByPlaceholder(/Buscar turno/i).first();
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
  });

  await report.step(page, "Coordenador envia a requisição para aprovação", async () => {
    const createResponsePromise = page.waitForResponse((response) => {
      return response.request().method() === "POST" && /\/api\/solicitacoes-vaga\/?$/.test(response.url());
    }, { timeout: 30_000 });

    await page.getByRole("button", { name: /Solicitar aprovação/i }).click();

    const createResponse = await createResponsePromise;
    createResponseText = await createResponse.text();
    expect(createResponse.ok(), `POST /api/solicitacoes-vaga falhou: ${createResponseText}`).toBe(true);

    const created = JSON.parse(createResponseText) as { id?: string };
    expect(created.id, "API deve retornar o id da requisição criada").toBeTruthy();
    requisicao = { id: created.id!, justificativa };
  });

  await report.step(page, "Sistema confirma a requisição pendente de aprovação", async () => {
    if (!requisicao) throw new Error("Requisição não foi criada.");
    const detail = await buscarSolicitacao(page, requisicao.id);
    expect(detail.status, `GET requisição criada falhou: ${detail.text}`).toBe(200);

    const solicitacao = JSON.parse(detail.text) as { status?: string; justificativa?: string | null };
    expect(solicitacao.status).toBe("PendenteAprovacao");
    expect(solicitacao.justificativa).toBe(requisicao.justificativa);
  });

  await report.step(page, "Gestor direto acessa a tela de login", async () => {
    test.skip(!gestorEmail || !gestorPassword, "Credenciais do gestor direto não configuradas.");
    if (!requisicao) throw new Error("Requisição não foi criada.");

    await page.goto("/app/login");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator("#email")).toBeVisible({ timeout: 20_000 });
  });

  await report.step(page, "Gestor direto informa as credenciais", async () => {
    await page.locator("#email").fill(gestorEmail!);
    await page.locator("#password").fill(gestorPassword!);
  });

  await report.step(page, "Gestor direto autentica e acessa o dashboard", async () => {
    await page.locator("#loginSubmit").click();
    await page.waitForURL(/\/app\/dashboard/, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  await report.step(page, "Gestor direto acessa a tela de aprovações", async () => {
    await page.goto("/app/gestao/aprovacoes");
    await expect(page.getByPlaceholder("Buscar...")).toBeVisible({ timeout: 20_000 });
  });

  await report.step(page, "Gestor filtra a pendência pela requisição criada", async () => {
    if (!requisicao) throw new Error("Requisição não foi criada.");
    await page.getByPlaceholder("Buscar...").fill(requisicao.id);
    const row = page.locator("tbody tr").filter({ hasText: /ANALISTA DE INFRAESTRUTURA SR/i }).first();
    await expect(row).toBeVisible({ timeout: 20_000 });
  });

  await report.step(page, "Gestor abre o detalhe da pendência", async () => {
    const row = page.locator("tbody tr").filter({ hasText: /ANALISTA DE INFRAESTRUTURA SR/i }).first();
    await row.click();

    await expect(page.getByRole("dialog", { name: /Detalhes da Solicitação de Contratação/i })).toBeVisible({ timeout: 20_000 });
  });

  await report.step(page, "Gestor informa a observação para devolução", async () => {
    if (!requisicao) throw new Error("Requisição não foi criada.");

    await page.getByPlaceholder(/Observação/i).fill(observacao);
  });

  await report.step(page, "Gestor solicita ajustes na requisição", async () => {
    if (!requisicao) throw new Error("Requisição não foi criada.");

    const requestChangesPromise = page.waitForResponse((response) => {
      return response.request().method() === "POST" && response.url().includes(`/api/solicitacoes-vaga/${requisicao!.id}/request-changes`);
    }, { timeout: 30_000 });

    await page.getByRole("button", { name: /Solicitar ajustes/i }).click();

    const requestChangesResponse = await requestChangesPromise;
    const requestChangesText = await requestChangesResponse.text();
    expect(requestChangesResponse.ok(), `request-changes falhou: ${requestChangesText}`).toBe(true);
  });

  await report.step(page, "Sistema registra a requisição como AjustesNecessarios", async () => {
    if (!requisicao) throw new Error("Requisição não foi criada.");

    const detail = await buscarSolicitacao(page, requisicao.id);
    expect(detail.status, `GET requisição devolvida falhou: ${detail.text}`).toBe(200);

    const solicitacao = JSON.parse(detail.text) as {
      status?: string;
      observacaoAprovador?: string | null;
      justificativa?: string | null;
    };

    expect(solicitacao.justificativa).toBe(requisicao.justificativa);
    expect(solicitacao.status).toBe("AjustesNecessarios");
    expect(solicitacao.observacaoAprovador).toBe(observacao);
  });

  await report.attachVideo(page);
  await report.writeHtml();
});
