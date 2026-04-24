import { test, expect, type Page } from "@playwright/test";

/**
 * E2E — Motivos de Requisição de Vaga (cadastro parametrizável).
 *
 * Cobre:
 *  1. UI  — tela acessível via menu (entrada "Motivos de Requisição" embaixo de "Unidades de Lotação").
 *  2. UI  — grid lista os 9 motivos seed (IsSystem=true).
 *  3. UI  — criar motivo customizado com efeito "Aumenta" via modal.
 *  4. UI  — editar nome e efeito de um motivo custom.
 *  5. UI  — desativar e reativar (toggle).
 *  6. UI  — motivos seed (IsSystem) têm botão excluir desabilitado.
 *  7. UI  — excluir motivo custom.
 *  8. API — GET /lookup retorna apenas ativos com efeitoHeadcount.
 *  9. API — seed aplicado no tenant (9 motivos, codigos esperados, efeitos esperados).
 * 10. API — SolicitacaoVaga criada com motivoRequisicaoId retorna código/nome/efeito no response.
 * 11. API — não pode excluir motivo em uso por solicitação (409).
 */

const FRONT_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API_BASE  = process.env.E2E_API_BASE ?? FRONT_URL;
const EMAIL     = process.env.E2E_EMAIL    ?? "admin@gmail.com";
const PASSWORD  = process.env.E2E_PASSWORD ?? "ChangeThisPassword123!";
const TENANT    = process.env.E2E_TENANT   ?? "consigaz";

test.setTimeout(180_000);

let CACHED_TOKEN: string | null = null;

async function loginViaUI(page: Page) {
    if (CACHED_TOKEN) {
        await page.addInitScript((t) => {
            try { localStorage.setItem("renderrh.accessToken", t); } catch { /* ignore */ }
        }, CACHED_TOKEN);
        await page.goto(`${FRONT_URL}/app/motivos-requisicao`);
        return;
    }

    await page.goto(`${FRONT_URL}/app/login`);
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#loginSubmit").click();
    await page.waitForURL(/\/app\/(dashboard|home|admissao|gestao|motivos)/, { timeout: 20_000 });
    const token = await page.evaluate(() => localStorage.getItem("renderrh.accessToken"));
    expect(token, "token JWT deve estar salvo").toBeTruthy();
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

/* ───────────────────────── 1. UI: menu acessa a tela ───────────────────────── */

test("UI — tela /motivos-requisicao carrega e mostra cabeçalho + 9 motivos seed", async ({ page }) => {
    await loginViaUI(page);
    await page.goto(`${FRONT_URL}/app/motivos-requisicao`);

    await expect(page.getByRole("heading", { name: /Motivos de Requisição de Vaga/i })).toBeVisible({ timeout: 10_000 });
    // Cada seed vira uma linha com data-testid previsível.
    for (const codigo of [
        "AtenderDemanda", "ExpansaoBase", "NovaUnidade", "CotaAprendiz",
        "PedidoDemissao", "DesligamentoSemJustaCausa", "TerminoContrato", "Movimentacao", "Afastamento",
    ]) {
        await expect(page.locator(`[data-testid="row-motivo-${codigo}"]`)).toBeVisible();
    }
    console.log("  [T1] ✓ 9 motivos seed renderizados");
});

/* ───────────────────────── 2. API: seed completo no tenant ───────────────────────── */

test("API — seed dos 9 motivos do sistema está aplicado com efeitos corretos", async ({ page }) => {
    await loginViaUI(page);
    const res = await api(page, "GET", "/api/motivos-requisicao-vaga");
    expect(res.status).toBe(200);
    const items = JSON.parse(res.text) as { codigo: string; efeitoHeadcount: string; isSystem: boolean }[];

    // Garanta que os 9 do seed estejam presentes com IsSystem=true.
    const esperados = [
        { codigo: "AtenderDemanda",            efeito: "Aumenta" },
        { codigo: "ExpansaoBase",              efeito: "Aumenta" },
        { codigo: "NovaUnidade",               efeito: "Aumenta" },
        { codigo: "CotaAprendiz",              efeito: "Aumenta" },
        { codigo: "PedidoDemissao",            efeito: "Ambos" },
        { codigo: "DesligamentoSemJustaCausa", efeito: "Ambos" },
        { codigo: "TerminoContrato",           efeito: "Ambos" },
        { codigo: "Movimentacao",              efeito: "Ambos" },
        { codigo: "Afastamento",               efeito: "Ambos" },
    ];

    for (const esp of esperados) {
        const found = items.find((i) => i.codigo === esp.codigo);
        expect(found, `seed "${esp.codigo}" ausente`).toBeTruthy();
        expect(found!.efeitoHeadcount, `efeito de ${esp.codigo}`).toBe(esp.efeito);
        expect(found!.isSystem, `${esp.codigo} deveria ser IsSystem`).toBe(true);
    }
    console.log(`  [T2] ✓ 9 motivos seed validados (4 Aumenta + 5 Ambos, todos IsSystem)`);
});

/* ───────────────────────── 3. API: endpoint /lookup só retorna ativos ───────────────────────── */

test("API — GET /lookup retorna só ativos, com efeitoHeadcount em cada item", async ({ page }) => {
    await loginViaUI(page);
    const res = await api(page, "GET", "/api/motivos-requisicao-vaga/lookup");
    expect(res.status).toBe(200);
    const items = JSON.parse(res.text) as { id: string; codigo: string; nome: string; efeitoHeadcount: string }[];
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThanOrEqual(9);
    for (const item of items) {
        expect(item.id).toBeTruthy();
        expect(item.codigo).toBeTruthy();
        expect(item.nome).toBeTruthy();
        expect(["Aumenta", "Diminui", "Ambos"]).toContain(item.efeitoHeadcount);
    }
    console.log(`  [T3] ✓ /lookup OK: ${items.length} itens, todos com efeito válido`);
});

/* ───────────────────────── 4. UI: criar, editar, desativar e excluir motivo custom ───────────────────────── */

test("UI CRUD — criar motivo custom (Aumenta) → editar pra Diminui → desativar → reativar → excluir", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    const codigo = `PromoQA${stamp}`;
    const nome = `Promoção Interna QA ${stamp}`;

    await loginViaUI(page);
    await page.goto(`${FRONT_URL}/app/motivos-requisicao`);
    await expect(page.getByRole("heading", { name: /Motivos de Requisição de Vaga/i })).toBeVisible();

    // 4.1 — CRIAR
    await page.locator('[data-testid="btn-novo-motivo"]').click();
    await expect(page.getByRole("heading", { name: "Novo motivo" })).toBeVisible();
    await page.locator('[data-testid="input-codigo"]').fill(codigo);
    await page.locator('[data-testid="input-nome"]').fill(nome);
    await page.locator('[data-testid="radio-efeito-aumenta"]').check();
    await page.locator('[data-testid="btn-salvar-motivo"]').click();

    const row = page.locator(`[data-testid="row-motivo-${codigo}"]`);
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText(nome);
    await expect(row).toContainText("Aumenta");
    console.log(`  [T4.1] ✓ motivo "${codigo}" criado com efeito Aumenta`);

    // 4.2 — EDITAR nome + efeito → Diminui
    await row.locator(`[data-testid="btn-editar-${codigo}"]`).click();
    await expect(page.getByRole("heading", { name: "Editar motivo" })).toBeVisible();
    await page.locator('[data-testid="input-nome"]').fill(`${nome} (editado)`);
    await page.locator('[data-testid="radio-efeito-diminui"]').check();
    await page.locator('[data-testid="btn-salvar-motivo"]').click();

    await expect(row).toContainText("editado", { timeout: 10_000 });
    await expect(row).toContainText("Diminui");
    console.log(`  [T4.2] ✓ motivo editado para efeito Diminui`);

    // 4.3 — DESATIVAR via toggle (botão Power)
    await row.getByTitle("Desativar").click();
    await expect(row).toContainText("Inativo", { timeout: 5_000 });
    console.log(`  [T4.3] ✓ motivo desativado`);

    // 4.4 — REATIVAR
    await row.getByTitle("Ativar").click();
    await expect(row).toContainText("Ativo", { timeout: 5_000 });
    console.log(`  [T4.4] ✓ motivo reativado`);

    // 4.5 — EXCLUIR (não é IsSystem — botão deve estar habilitado)
    await row.getByTitle("Excluir").click();
    await expect(page.getByRole("heading", { name: "Confirmar exclusão" })).toBeVisible();
    await page.getByRole("button", { name: "Excluir" }).click();
    await expect(row).toHaveCount(0, { timeout: 5_000 });
    console.log(`  [T4.5] ✓ motivo custom excluído`);
});

/* ───────────────────────── 5. UI: seeds (IsSystem) não podem ser excluídos ───────────────────────── */

test("UI — motivos do sistema (IsSystem=true) têm botão excluir desabilitado", async ({ page }) => {
    await loginViaUI(page);
    await page.goto(`${FRONT_URL}/app/motivos-requisicao`);

    const row = page.locator('[data-testid="row-motivo-PedidoDemissao"]');
    await expect(row).toBeVisible();
    await expect(row).toContainText("sistema");

    // Botão de excluir (título "Motivo de sistema...") deve estar desabilitado.
    const btnExcluir = row.getByTitle(/sistema|Excluir/i).last();
    await expect(btnExcluir).toBeDisabled();
    console.log(`  [T5] ✓ motivo seed PedidoDemissao tem excluir desabilitado`);
});

/* ───────────────────────── 6. API: SolicitacaoVaga aceita motivoRequisicaoId e retorna código+nome+efeito ───────────────────────── */

test("API — criar SolicitacaoVaga com motivoRequisicaoId expõe Codigo/Nome/Efeito no response", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    await loginViaUI(page);

    // Pega o id de um motivo conhecido (AtenderDemanda, efeito Aumenta)
    const lookup = JSON.parse((await api(page, "GET", "/api/motivos-requisicao-vaga/lookup")).text) as
        { id: string; codigo: string; efeitoHeadcount: string }[];
    const motivo = lookup.find((m) => m.codigo === "AtenderDemanda");
    expect(motivo, "seed AtenderDemanda deveria existir").toBeTruthy();

    const createRes = await api(page, "POST", "/api/solicitacoes-vaga", {
        titulo: `QA Motivo ${stamp}`,
        justificativa: "E2E motivos parametrizáveis",
        qtdPosicoes: 1,
        urgencia: "Media",
        tipoSolicitacao: "VagaNova",
        isConfidencial: false,
        tipoContrato: "CLT",
        motivoRequisicaoId: motivo!.id,
        cnhObrigatoria: false,
        disponibilidadeViagens: false,
        decisaoRH: "ConsumirHeadcountExistente",
    });
    expect(createRes.status, `POST vaga: ${createRes.text.slice(0, 300)}`).toBeLessThan(300);
    const sol = JSON.parse(createRes.text);
    console.log(`  [T6] motivoRequisicaoId=${sol.motivoRequisicaoId}, codigo=${sol.motivoRequisicaoCodigo}, efeito=${sol.motivoRequisicaoEfeito}`);

    expect(sol.motivoRequisicaoId).toBe(motivo!.id);
    expect(sol.motivoRequisicaoCodigo).toBe("AtenderDemanda");
    expect(sol.motivoRequisicaoEfeito).toBe("Aumenta");
});

/* ───────────────────────── 7. API: bloqueia exclusão de motivo em uso ───────────────────────── */

test("API — DELETE retorna 409 ao tentar excluir motivo custom em uso por solicitação", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    await loginViaUI(page);

    // 7.1 — Cria um motivo custom
    const codigoCustom = `EmUso${stamp}`;
    const createMotivo = await api(page, "POST", "/api/motivos-requisicao-vaga", {
        codigo: codigoCustom,
        nome: `Motivo em uso ${stamp}`,
        descricao: null,
        efeitoHeadcount: "Aumenta",
        isActive: true,
        ordem: 999,
    });
    expect(createMotivo.status).toBe(201);
    const motivo = JSON.parse(createMotivo.text);

    // 7.2 — Cria uma solicitação usando esse motivo
    const createVaga = await api(page, "POST", "/api/solicitacoes-vaga", {
        titulo: `QA Motivo Em Uso ${stamp}`,
        qtdPosicoes: 1,
        urgencia: "Media",
        tipoSolicitacao: "VagaNova",
        isConfidencial: false,
        tipoContrato: "CLT",
        motivoRequisicaoId: motivo.id,
        cnhObrigatoria: false,
        disponibilidadeViagens: false,
        decisaoRH: "ConsumirHeadcountExistente",
    });
    expect(createVaga.status, `POST vaga: ${createVaga.text.slice(0, 300)}`).toBeLessThan(300);

    // 7.3 — Tenta excluir o motivo → deve retornar 409
    const delRes = await api(page, "DELETE", `/api/motivos-requisicao-vaga/${motivo.id}`);
    console.log(`  [T7] DELETE motivo em uso → status=${delRes.status}, body=${delRes.text.slice(0, 150)}`);
    expect(delRes.status).toBe(409);
    expect(delRes.text).toMatch(/em uso/i);
});

/* ───────────────────────── 8. UI: form de solicitação carrega motivos da API ───────────────────────── */

test("UI — SolicitacaoFormModal carrega motivos parametrizáveis (dropdown tem os 9 seed)", async ({ page }) => {
    await loginViaUI(page);
    await page.goto(`${FRONT_URL}/app/gestao/solicitacoes`);
    await page.getByRole("button", { name: /Do Quadro de Vagas/i }).click();
    await page.locator('[data-testid="btn-nova-posicao-picker"]').click();

    const select = page.locator('[data-testid="select-motivo-requisicao"]');
    await expect(select).toBeVisible({ timeout: 5_000 });

    // Aguarda o select popular com itens (a API lookup responde em milissegundos)
    await page.waitForFunction(
        () => {
            const el = document.querySelector<HTMLSelectElement>('[data-testid="select-motivo-requisicao"]');
            return el !== null && el.options.length >= 10; // 1 placeholder + 9 seed
        },
        { timeout: 10_000 },
    );

    const options = await select.locator("option").allTextContents();
    console.log(`  [T8] options carregadas (${options.length}): ${options.slice(0, 5).join(" | ")}...`);
    expect(options).toContain("Atender demanda");
    expect(options).toContain("Pedido de demissão");
});
