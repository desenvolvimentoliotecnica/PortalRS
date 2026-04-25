import { test, expect, type Page } from "@playwright/test";

/**
 * E2E — Decisão de Headcount pelo Gestor (na criação da SolicitacaoVaga).
 *
 * Cobre as mudanças desta feature:
 *  1. UI — bloco "Decisão de headcount" aparece para VagaNova com 3 radios.
 *  2. UI — selecionar SubstituicaoProvisoria revela os campos de prazo.
 *  3. UI — tentar "Solicitar aprovação" com VagaNova sem decisaoRH mostra toast.
 *  4. API — endpoint antigo POST /decisao-rh foi removido (404).
 *  5. API — criar VagaNova com decisaoRH=ConsumirHeadcountExistente vai pra PendenteAprovacao.
 *  6. API — criar VagaNova com decisaoRH=SubstituicaoProvisoria + prazoMeses funciona.
 *  7. API — criar VagaNova com decisaoRH=AumentoDefinitivo funciona.
 *  8. API — criar VagaNova SEM decisaoRH retorna 409 Conflict ao submeter.
 *  9. API — enum Status retornado nunca é "AguardandoDecisaoRH" (valor 9 removido).
 */

const FRONT_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API_BASE  = process.env.E2E_API_BASE ?? FRONT_URL;
const EMAIL     = process.env.E2E_EMAIL    ?? "admin@gmail.com";
const PASSWORD  = process.env.E2E_PASSWORD ?? "ChangeThisPassword123!";
const TENANT    = process.env.E2E_TENANT   ?? "liotecnica";

test.setTimeout(180_000);

let CACHED_TOKEN: string | null = null;

async function loginViaUI(page: Page) {
    if (CACHED_TOKEN) {
        await page.addInitScript((t) => {
            try { localStorage.setItem("renderrh.accessToken", t); } catch { /* ignore */ }
        }, CACHED_TOKEN);
        await page.goto(`${FRONT_URL}/app/gestao/solicitacoes`);
        return;
    }

    await page.goto(`${FRONT_URL}/app/login`);
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#loginSubmit").click();
    await page.waitForURL(/\/app\/(dashboard|home|admissao|gestao)/, { timeout: 20_000 });
    const token = await page.evaluate(() => localStorage.getItem("renderrh.accessToken"));
    expect(token, "token JWT deve estar salvo após login").toBeTruthy();
    CACHED_TOKEN = token;
}

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

async function ensureSolicitante(page: Page) {
    const adminUserId = await page.evaluate(() => {
        const token = localStorage.getItem("renderrh.accessToken");
        if (!token) return null;
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] ?? null;
    });
    expect(adminUserId, "nameidentifier no JWT").toBeTruthy();

    await api(page, "POST", "/api/funcionarios", {
        name: "Admin Solicitante QA",
        email: EMAIL,
        status: "Active",
        headcount: 1,
        userId: adminUserId,
    });
}

function vagaNovaBody(stamp: string, extras: Record<string, unknown> = {}) {
    return {
        titulo: `QA DecHC ${stamp}`,
        justificativa: "Teste E2E decisão de headcount.",
        qtdPosicoes: 1,
        urgencia: "Media",
        tipoSolicitacao: "VagaNova",
        isConfidencial: false,
        tipoContrato: "CLT",
        motivoRequisicao: "AtenderDemanda",
        cnhObrigatoria: false,
        disponibilidadeViagens: false,
        ...extras,
    };
}

/* ───────────────────────── 1. UI: bloco "Decisão de headcount" aparece pra VagaNova ───────────────────────── */

test("UI — bloco 'Decisão de headcount' aparece com os 3 radios para VagaNova", async ({ page }) => {
    await loginViaUI(page);
    await page.goto(`${FRONT_URL}/app/gestao/solicitacoes`);

    await page.getByRole("button", { name: /Do Quadro de Vagas/i }).click();
    await expect(page.getByRole("heading", { name: /Selecionar Vaga do Quadro/i })).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="btn-nova-posicao-picker"]').click();

    await expect(page.locator('[data-testid="bloco-decisao-hc"]')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('[data-testid="radio-decisao-consumir"]')).toBeVisible();
    await expect(page.locator('[data-testid="radio-decisao-provisoria"]')).toBeVisible();
    await expect(page.locator('[data-testid="radio-decisao-aumento"]')).toBeVisible();
    console.log("  [T1] ✓ bloco de decisão de HC renderizado com os 3 radios");
});

/* ───────────────────────── 2. UI: SubstituicaoProvisoria revela campos de prazo ───────────────────────── */

test("UI — selecionar 'Substituição provisória' revela o campo de prazo (meses)", async ({ page }) => {
    await loginViaUI(page);
    await page.goto(`${FRONT_URL}/app/gestao/solicitacoes`);
    await page.getByRole("button", { name: /Do Quadro de Vagas/i }).click();
    await page.locator('[data-testid="btn-nova-posicao-picker"]').click();

    await expect(page.locator('[data-testid="input-decisao-prazo-meses"]')).toHaveCount(0);

    await page.locator('[data-testid="radio-decisao-provisoria"]').check();
    await expect(page.locator('[data-testid="input-decisao-prazo-meses"]')).toBeVisible({ timeout: 3_000 });

    await page.locator('[data-testid="radio-decisao-consumir"]').check();
    await expect(page.locator('[data-testid="input-decisao-prazo-meses"]')).toHaveCount(0);
    console.log("  [T2] ✓ prazo aparece só para provisória; some ao trocar pra outro");
});

/* ───────────────────────── 3. UI: submit sem decisão bloqueia + toast ───────────────────────── */

test("UI — tentar submeter VagaNova sem decisão mostra toast 'Decisão de headcount'", async ({ page }) => {
    await loginViaUI(page);
    await page.goto(`${FRONT_URL}/app/gestao/solicitacoes`);
    await page.getByRole("button", { name: /Do Quadro de Vagas/i }).click();
    await page.locator('[data-testid="btn-nova-posicao-picker"]').click();

    // Preenche o título (campo sem htmlFor → seleciona pelo placeholder) pra garantir que a validação
    // da decisão seja exibida — sem título o toast listaria ambos e o teste ainda passaria, mas
    // com título vamos verificar o fluxo real onde só a decisão está faltando.
    await page.getByPlaceholder(/Ex: Analista de RH Pleno/i).first().fill("QA Sem Decisão");

    await page.getByRole("button", { name: /Solicitar aprovação/i }).click();
    await expect(page.getByText(/Decisão de headcount/i).first()).toBeVisible({ timeout: 5_000 });
    console.log("  [T3] ✓ toast de validação exibido ao submit sem decisão");
});

/* ───────────────────────── 4. API: endpoint antigo /decisao-rh foi removido ───────────────────────── */

test("API — endpoint legado POST /solicitacoes-vaga/{id}/decisao-rh retorna 404", async ({ page }) => {
    await loginViaUI(page);
    const dummyId = "00000000-0000-0000-0000-000000000000";
    const res = await api(page, "POST", `/api/solicitacoes-vaga/${dummyId}/decisao-rh`, { decisao: "ConsumirHeadcountExistente" });
    console.log(`  [T4] POST /decisao-rh → status=${res.status} (esperado 404)`);
    expect(res.status, "endpoint legado deve ter sido removido").toBe(404);
});

/* ───────────────────────── 5. API: ConsumirHeadcountExistente ───────────────────────── */

test("API — VagaNova com decisaoRH=ConsumirHeadcountExistente vai pra PendenteAprovacao e expõe decisaoRH no response", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    await loginViaUI(page);
    await ensureSolicitante(page);

    const body = vagaNovaBody(stamp, { decisaoRH: "ConsumirHeadcountExistente" });
    const res = await api(page, "POST", "/api/solicitacoes-vaga", body);
    console.log(`  [T5] POST /solicitacoes-vaga → status=${res.status}`);
    expect(res.status, `POST: ${res.text.slice(0, 300)}`).toBeLessThan(300);

    const sol = JSON.parse(res.text);
    console.log(`  [T5] status=${sol.status}, decisaoRH=${sol.decisaoRH}`);
    expect(sol.status).toBe("PendenteAprovacao");
    expect(sol.decisaoRH).toBe("ConsumirHeadcountExistente");
    expect(sol.status, "status nunca deve ser AguardandoDecisaoRH (removido)").not.toBe("AguardandoDecisaoRH");
});

/* ───────────────────────── 6. API: SubstituicaoProvisoria + prazo ───────────────────────── */

test("API — VagaNova com decisaoRH=SubstituicaoProvisoria + prazoMeses persiste prazo no response", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    await loginViaUI(page);
    await ensureSolicitante(page);

    const body = vagaNovaBody(stamp, {
        decisaoRH: "SubstituicaoProvisoria",
        decisaoRHPrazoMeses: 3,
    });
    const res = await api(page, "POST", "/api/solicitacoes-vaga", body);
    console.log(`  [T6] POST → status=${res.status}`);
    expect(res.status, `POST: ${res.text.slice(0, 300)}`).toBeLessThan(300);

    const sol = JSON.parse(res.text);
    console.log(`  [T6] status=${sol.status}, decisaoRH=${sol.decisaoRH}, prazoMeses=${sol.decisaoRHPrazoMeses}`);
    expect(sol.status).toBe("PendenteAprovacao");
    expect(sol.decisaoRH).toBe("SubstituicaoProvisoria");
    expect(sol.decisaoRHPrazoMeses).toBe(3);
});

/* ───────────────────────── 7. API: AumentoDefinitivo ───────────────────────── */

test("API — VagaNova com decisaoRH=AumentoDefinitivo é aceito e persistido", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    await loginViaUI(page);
    await ensureSolicitante(page);

    const body = vagaNovaBody(stamp, { decisaoRH: "AumentoDefinitivo" });
    const res = await api(page, "POST", "/api/solicitacoes-vaga", body);
    console.log(`  [T7] POST → status=${res.status}`);
    expect(res.status, `POST: ${res.text.slice(0, 300)}`).toBeLessThan(300);

    const sol = JSON.parse(res.text);
    console.log(`  [T7] status=${sol.status}, decisaoRH=${sol.decisaoRH}`);
    expect(sol.status).toBe("PendenteAprovacao");
    expect(sol.decisaoRH).toBe("AumentoDefinitivo");
});

/* ───────────────────────── 8. API: sem decisaoRH bloqueia submit ───────────────────────── */

test("API — VagaNova SEM decisaoRH é bloqueada no submit com 409 e mensagem específica", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    await loginViaUI(page);
    await ensureSolicitante(page);

    const body = vagaNovaBody(stamp); // SEM decisaoRH
    const res = await api(page, "POST", "/api/solicitacoes-vaga", body);
    console.log(`  [T8] POST sem decisaoRH → status=${res.status}, body=${res.text.slice(0, 200)}`);

    // SubmitAsync valida ausência de DecisaoRH e lança InvalidOperationException → 409 Conflict.
    // Se a validação foi removida ou flexibilizada, o assert abaixo falha.
    expect(res.status, "deve retornar 409 quando VagaNova é submetida sem decisão de HC").toBe(409);
    expect(res.text, "mensagem deve referenciar decisão de headcount").toMatch(/decis[aã]o de headcount/i);
});

/* ───────────────────────── 9. API: enum não expõe mais AguardandoDecisaoRH ───────────────────────── */

test("API — GET /solicitacoes-vaga em um tenant nunca retorna status=AguardandoDecisaoRH (valor 9 removido)", async ({ page }) => {
    await loginViaUI(page);
    const res = await api(page, "GET", "/api/solicitacoes-vaga?pageSize=500");
    expect(res.status).toBe(200);

    const payload = JSON.parse(res.text);
    const items = Array.isArray(payload) ? payload : (payload.items ?? []);
    const badRows = items.filter((r: { status?: string }) => r.status === "AguardandoDecisaoRH");
    console.log(`  [T9] rows=${items.length}, com AguardandoDecisaoRH=${badRows.length}`);
    expect(badRows.length, "migration de data fix deveria ter movido todos os status=9 pra Aprovada").toBe(0);
});
