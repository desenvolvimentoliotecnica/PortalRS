import { test, expect, type Page } from "@playwright/test";

/**
 * E2E Desligamento: login RH → cria Funcionario com códigos TOTVS → cria
 * solicitação de desligamento → submit → aprovação → verifica na fila
 * "Pendente TOTVS" → valida que o payload canônico tem os 23 campos esperados
 * pelo sync-service (apisfrescisao.p).
 *
 * Complementa `admissao-fullflow.spec.ts` — ambos seguem o mesmo padrão:
 * solicitação → pendente aprovação → aprovado → pendente TOTVS → sync consome.
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

test("Desligamento: criar → aprovar → gerar payload TOTVS em Pendente TOTVS", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    const cdnFuncionario = `99${stamp}`;   // ex: "99123456" — fictício, mas único

    await loginViaUI(page);

    // ── 0. Garante que o admin (user logado) tem Funcionario vinculado — necessário pra ser solicitante.
    // Extrai userId do JWT e cria Funcionario-solicitante se não existir.
    const adminUserId = await page.evaluate(() => {
        const token = localStorage.getItem("renderrh.accessToken");
        if (!token) return null;
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] ?? null;
    });
    expect(adminUserId, "nameidentifier no JWT").toBeTruthy();

    // Tenta criar funcionário-solicitante vinculado ao admin. 409 é OK (já existe).
    const solicitanteBody = {
        name: "Admin Solicitante QA",
        email: EMAIL,
        status: "Active",
        headcount: 1,
        userId: adminUserId,
    };
    await api(page, "POST", "/api/funcionarios", solicitanteBody); // ignora erro — pode já existir

    // ── 1. Cria Funcionario do desligado (com códigos TOTVS que o sync normalmente preencheria via admissão)
    const funcBody = {
        name: `QA Desligamento ${stamp}`,
        email: `qa.desl.${stamp}@qualiit-test.com`,
        phone: null,
        status: "Active",
        headcount: 1,
        cdnFuncionario,
        cdnEmpresa: "1",
        cdnEstab: "099",
    };
    const funcRes = await api(page, "POST", "/api/funcionarios", funcBody);
    expect(funcRes.status, `POST funcionário falhou: ${funcRes.text.slice(0, 400)}`).toBe(201);
    const funcionario = JSON.parse(funcRes.text);
    console.log(`👤 Funcionario criado: ${funcionario.id} (cdnFuncionario=${cdnFuncionario})`);

    // ── 2. Cria solicitação de desligamento (rascunho)
    const deslBody = {
        funcionarioId: funcionario.id,
        dataDesligamento: "2026-04-16",
        tipoDesligamento: "PedidoDemissao",      // → percMultaFGTS = 0
        motivoDesligamento: `Teste E2E desligamento ${stamp}`,
        tipoAvisoPrevio: "Dispensado",           // → cdnTipoAviso = 3, datIniAviso = ""
        diasAvisoPrevio: 30,
        possuiEstabilidade: false,
        elegivelRecontratacao: true,
        substituirPosicao: false,
    };
    const createRes = await api(page, "POST", "/api/solicitacoes-desligamento", deslBody);
    expect(createRes.status, `POST desligamento falhou: ${createRes.text.slice(0, 400)}`).toBeLessThan(300);
    const desligamento = JSON.parse(createRes.text);
    const desligamentoId = desligamento.id;
    console.log(`📝 Desligamento criado: ${desligamentoId} (status inicial: ${desligamento.status})`);

    // ── 3. Submit (Rascunho → PendenteAprovacao)
    const submitRes = await api(page, "POST", `/api/solicitacoes-desligamento/${desligamentoId}/submit`);
    expect(submitRes.status, `Submit falhou: ${submitRes.text.slice(0, 400)}`).toBeLessThan(300);
    console.log(`🚀 Submit OK`);

    // ── 4. Approve (PendenteAprovacao → Aprovada).
    // Se o workflow precisar de aprovador específico, o admin geralmente passa.
    // Em tenants sem workflow configurado, pode aprovar em 1 chamada.
    const approveRes = await api(page, "POST", `/api/solicitacoes-desligamento/${desligamentoId}/approve`, { observacao: "Aprovado via E2E" });
    if (approveRes.status >= 300) {
        console.log(`⚠️  Approve retornou ${approveRes.status}: ${approveRes.text.slice(0, 300)}`);
    }
    console.log(`✅ Approve enviado (status=${approveRes.status})`);

    // ── 5. Verifica: solicitação está Aprovada (pronta pra sync)
    const detailRes = await api(page, "GET", `/api/solicitacoes-desligamento/${desligamentoId}`);
    expect(detailRes.status).toBe(200);
    const detail = JSON.parse(detailRes.text);
    expect(detail.status, `Esperava status 'Aprovada' para entrar na fila TOTVS. Atual: ${detail.status}`).toBe("Aprovada");
    console.log(`📋 Status final: ${detail.status}`);

    // ── 6. Consulta a fila "Pendente TOTVS" e confirma que o desligamento aparece com tipo=3
    const painelRes = await api(page, "GET", `/api/integracao-totvs/painel?tipo=3`);
    expect(painelRes.status).toBe(200);
    const painel = JSON.parse(painelRes.text);
    const items = painel.items ?? painel;
    const found = items.find((x: { id: string }) => x.id === desligamentoId);
    expect(found, `Desligamento ${desligamentoId} não apareceu em /integracao-totvs/painel?tipo=3`).toBeTruthy();
    expect(found.tipoIntegracao).toBe(3);
    expect(found.tipoIntegracaoLabel).toBe("Desligamento");
    console.log(`📊 Listado em Pendente TOTVS (tipo=3)`);

    // ── 7. Baixa o payload canônico TOTVS (mesmo que o sync-service consome)
    const payloadRes = await api(page, "GET", `/api/integracao-totvs/3/${desligamentoId}`);
    expect(payloadRes.status).toBe(200);
    const payload = JSON.parse(payloadRes.text);

    // ── 8. Valida os 23 campos TOTVS do payload apisfrescisao.p
    const expected = {
        cdnEmpresaFunc: "1",
        cdnEstabFunc: "099",
        cdnFuncionario: parseInt(cdnFuncionario, 10),
        cdnTipoCheque: 1,
        cdnSitAfast: 86,
        cdnTipoAviso: 3,                              // Dispensado
        datDesligamento: "2026-04-16",
        datIniAviso: "",                              // vazio pra Dispensado
        datPagto: "2026-04-25",                        // +9 dias (limite legal)
        datAviso: "",
        datLimPgtoRecis: "2026-04-25",                 // CLT art. 477 §6º: +9 dias
        percMultaFGTS: 0,                              // PedidoDemissao
        codSaqueFGTS: "",
        cdnTipoJornada: 0,
        logCalcAdicAdmitidos: "",
        logGeraComEstabilidade: "",
        logValidaProgFerias: "",
        logImprimeAviso: "",                           // vazio pra Dispensado
        logRecFeriasProporc: "",
        logReceb13Proporc: "",
        logFGTSAnteriorGRFP: "",
        logGeraSemExameDemis: "",
        logGeraEPIDevolver: "",
    };

    for (const [key, valueEsperado] of Object.entries(expected)) {
        expect(payload[key], `Campo '${key}': esperado ${JSON.stringify(valueEsperado)}, recebido ${JSON.stringify(payload[key])}`).toBe(valueEsperado);
    }
    console.log(`🎯 Payload TOTVS validado — 23 campos corretos`);
    console.log(`\n📄 JSON canônico gerado:\n${JSON.stringify(
        Object.fromEntries(Object.keys(expected).map(k => [k, payload[k]])),
        null, 2
    )}`);
});
