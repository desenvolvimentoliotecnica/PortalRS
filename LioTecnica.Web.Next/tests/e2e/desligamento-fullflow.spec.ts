import { test, expect, type Page } from "@playwright/test";

/**
 * E2E Desligamento: fluxo 100% Portal — aprovação, entrevista manual,
 * efetivação somente após questionário respondido (sem integração TOTVS).
 */

const FRONT_URL = process.env.E2E_BASE_URL ?? "https://renderrh-qa.qualiit.com.br";
const API_BASE  = process.env.E2E_API_BASE ?? FRONT_URL;
const EMAIL     = process.env.E2E_EMAIL    ?? "admin@consigaz.com";
const PASSWORD  = process.env.E2E_PASSWORD ?? "ChangeThisPassword123!";
const TENANT    = process.env.E2E_TENANT   ?? "consigaz";

test.setTimeout(120_000);

async function loginViaUI(page: Page) {
    await page.goto(`${FRONT_URL}/app/login`);
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#loginSubmit").click();
    await page.waitForURL(/\/app\/(dashboard|home|admissao|gestao)/, { timeout: 20_000 });
    const token = await page.evaluate(() => localStorage.getItem("renderrh.accessToken"));
    expect(token, "token JWT deve estar salvo após login").toBeTruthy();
}

/** Helper: chamada fetch autenticada no contexto da página (usa token do localStorage). */
async function api(page: Page, method: string, path: string, body?: unknown) {
    return await page.evaluate(
        async ({ apiBase, tenant, method, path, body }) => {
            const token = localStorage.getItem("renderrh.accessToken");
            const res = await fetch(`${apiBase}${path}`, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "X-Tenant-Id": tenant,
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            const text = await res.text();
            return { status: res.status, text };
        },
        { apiBase: API_BASE, tenant: TENANT, method, path, body },
    );
}

test("Desligamento: aprovada não entra no Painel TOTVS e efetivar exige entrevista respondida", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);

    await loginViaUI(page);

    const funcBody = {
        name: `QA Desligamento ${stamp}`,
        email: `qa.desl.${stamp}@qualiit-test.com`,
        status: "Active",
        headcount: 1,
    };
    const funcRes = await api(page, "POST", "/api/funcionarios", funcBody);
    expect(funcRes.status, `POST funcionário falhou: ${funcRes.text.slice(0, 400)}`).toBe(201);
    const funcionario = JSON.parse(funcRes.text);

    const deslBody = {
        funcionarioId: funcionario.id,
        dataDesligamento: "2026-04-16",
        tipoDesligamento: "PedidoDemissao",
        motivoDesligamento: `Teste E2E desligamento ${stamp}`,
        tipoAvisoPrevio: "Dispensado",
        diasAvisoPrevio: 30,
        possuiEstabilidade: false,
        elegivelRecontratacao: true,
        substituirPosicao: false,
    };
    const createRes = await api(page, "POST", "/api/solicitacoes-desligamento", deslBody);
    expect(createRes.status).toBeLessThan(300);
    const desligamento = JSON.parse(createRes.text);

    await api(page, "POST", `/api/solicitacoes-desligamento/${desligamento.id}/submit`);
    await api(page, "POST", `/api/solicitacoes-desligamento/${desligamento.id}/approve`, { observacao: "Aprovado via E2E" });

    const detailRes = await api(page, "GET", `/api/solicitacoes-desligamento/${desligamento.id}`);
    expect(detailRes.status).toBe(200);
    const detail = JSON.parse(detailRes.text);
    expect(detail.status).toBe("Aprovada");

    const painelRes = await api(page, "GET", `/api/integracao-totvs/painel?tipo=3`);
    expect(painelRes.status).toBe(200);
    const painel = JSON.parse(painelRes.text);
    const items = painel.items ?? painel;
    const found = items.find((x: { id: string }) => x.id === desligamento.id);
    expect(found, "Desligamento não deve aparecer no Painel Integração TOTVS").toBeFalsy();

    const efetivarRes = await api(page, "POST", `/api/solicitacoes-desligamento/${desligamento.id}/efetivar`);
    expect(efetivarRes.status).toBe(409);
    expect(efetivarRes.text.toLowerCase()).toContain("entrevista");
});

test("Desligamento: entrevista de saída manual — enviar e status na grid", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);

    await loginViaUI(page);

    const funcBody = {
        name: `QA Entrevista ${stamp}`,
        email: `qa.entrevista.${stamp}@qualiit-test.com`,
        status: "Active",
        headcount: 1,
    };
    const funcRes = await api(page, "POST", "/api/funcionarios", funcBody);
    expect(funcRes.status).toBe(201);
    const funcionario = JSON.parse(funcRes.text);

    const deslBody = {
        funcionarioId: funcionario.id,
        dataDesligamento: "2026-06-30",
        tipoDesligamento: "PedidoDemissao",
        motivoDesligamento: `Teste entrevista E2E ${stamp}`,
        tipoAvisoPrevio: "Dispensado",
        diasAvisoPrevio: 30,
        possuiEstabilidade: false,
        elegivelRecontratacao: true,
        substituirPosicao: false,
    };
    const createRes = await api(page, "POST", "/api/solicitacoes-desligamento", deslBody);
    expect(createRes.status).toBeLessThan(300);
    const desligamento = JSON.parse(createRes.text);

    await api(page, "POST", `/api/solicitacoes-desligamento/${desligamento.id}/submit`);
    await api(page, "POST", `/api/solicitacoes-desligamento/${desligamento.id}/approve`, { observacao: "E2E entrevista" });

    const enviarRes = await api(page, "POST", `/api/solicitacoes-desligamento/${desligamento.id}/entrevista-saida/enviar`);
    expect(enviarRes.status, `Enviar entrevista falhou: ${enviarRes.text.slice(0, 300)}`).toBe(204);

    const detalheRes = await api(page, "GET", `/api/solicitacoes-desligamento/${desligamento.id}/entrevista-saida`);
    expect(detalheRes.status).toBe(200);
    const detalhe = JSON.parse(detalheRes.text);
    expect(detalhe.status).toBe("Enviada");

    const listRes = await api(page, "GET", "/api/solicitacoes-desligamento?pageSize=500");
    expect(listRes.status).toBe(200);
    const rows = JSON.parse(listRes.text) as Array<{ id: string; entrevistaSaidaStatus?: string }>;
    const row = rows.find((r) => r.id === desligamento.id);
    expect(row?.entrevistaSaidaStatus).toBe("Enviada");
});
