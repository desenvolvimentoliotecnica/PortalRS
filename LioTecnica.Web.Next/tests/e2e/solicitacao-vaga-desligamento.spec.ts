import { test, expect, type Page } from "@playwright/test";

/**
 * E2E — Solicitação de Vaga com Motivo de Desligamento.
 *
 * Cobre:
 *  1. UI — botão "Nova posição" dentro do modal "Selecionar Vaga do Quadro".
 *  2. UI — bloco de dados do desligamento aparece ao selecionar motivo PedidoDemissao/SemJustaCausa.
 *  3. UI — alerta em vermelho quando "Nova posição" + motivo de desligamento (Gap 3).
 *  4. API — criação da vaga com motivo de desligamento JÁ cria a SolicitacaoDesligamento vinculada (bug fix).
 *  5. API — edição da vaga sincroniza o desligamento vinculado (funcionário/data/motivo).
 *  6. API — cascata: reject do desligamento reprova a vaga; reject da vaga reprova o desligamento; cancel da vaga cancela o desligamento.
 *  7. API — endpoint /api/lookup/funcionarios aceita filtros jobPositionId/unitId/empresaId/unidadeLotacaoId (Gap 2).
 *
 * Pré-requisitos no ambiente alvo:
 *  - Banco com migration AddVinculoVagaDesligamento aplicada.
 *  - Admin logado tem Funcionario vinculado.
 *  - Pelo menos um Funcionario ativo para ser desligado.
 */

const FRONT_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API_BASE  = process.env.E2E_API_BASE ?? FRONT_URL;
const EMAIL     = process.env.E2E_EMAIL    ?? "admin@gmail.com";
const PASSWORD  = process.env.E2E_PASSWORD ?? "ChangeThisPassword123!";
const TENANT    = process.env.E2E_TENANT   ?? "liotecnica";

test.setTimeout(180_000);

// Token cache compartilhado entre testes (workers=1) — evita rate-limit no endpoint de login.
let CACHED_TOKEN: string | null = null;

async function loginViaUI(page: Page) {
    if (CACHED_TOKEN) {
        // Reusa o token cacheado — navega direto pra tela autenticada (não mostra login de novo)
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

async function criarFuncionarioParaDesligar(page: Page, stamp: string) {
    const funcBody = {
        name: `QA Desl ${stamp}`,
        email: `qa.desl.${stamp}@qualiit-test.com`,
        phone: null,
        status: "Active",
        headcount: 1,
        cdnFuncionario: `88${stamp}`,
        cdnEmpresa: "1",
        cdnEstab: "099",
    };
    const res = await api(page, "POST", "/api/funcionarios", funcBody);
    expect(res.status, `POST funcionario falhou: ${res.text.slice(0, 400)}`).toBe(201);
    return JSON.parse(res.text);
}

function baseRequisicaoBody(funcionarioId: string, stamp: string, motivo: "PedidoDemissao" | "DesligamentoSemJustaCausa") {
    return {
        titulo: `QA Reqvaga Desl ${stamp}`,
        justificativa: "Teste E2E de requisição com desligamento vinculado.",
        qtdPosicoes: 1,
        urgencia: "Media",
        tipoSolicitacao: "Substituicao",
        isConfidencial: false,
        substituidoFuncionarioId: funcionarioId,
        tipoContrato: "CLT",
        motivoRequisicao: motivo,
        cnhObrigatoria: false,
        disponibilidadeViagens: false,
        dataDesligamento: "2026-05-30",
        tipoAvisoPrevioDesligamento: motivo === "PedidoDemissao" ? "Dispensado" : "Indenizado",
        diasAvisoPrevioDesligamento: 30,
        possuiEstabilidadeDesligamento: false,
        motivoDesligamentoTexto: `Motivo texto ${stamp} — gerado pelo E2E.`,
    };
}

/* ───────────────────────── 1. UI: botão "Nova posição" dentro do picker ───────────────────────── */

test("UI — botão 'Do Quadro de Vagas' abre picker com botão 'Nova posição' que abre form com origemVaga=nova", async ({ page }) => {
    await loginViaUI(page);
    await page.goto(`${FRONT_URL}/app/gestao/solicitacoes`);

    await page.getByRole("button", { name: /Do Quadro de Vagas/i }).click();

    await expect(page.getByRole("heading", { name: /Selecionar Vaga do Quadro/i })).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="btn-nova-posicao-picker"]').click();

    // Form deve abrir — valida que o select de motivo está na tela
    await expect(page.locator('[data-testid="select-motivo-requisicao"]')).toBeVisible({ timeout: 5_000 });
});

/* ───────────────────────── 2. UI: tela principal NÃO tem botão "Nova Posição" standalone ───────────────────────── */

test("UI — tela de solicitações NÃO tem botão 'Nova Posição' standalone (só acessível via picker)", async ({ page }) => {
    await loginViaUI(page);
    await page.goto(`${FRONT_URL}/app/gestao/solicitacoes`);

    // Botão standalone de Nova Posição NÃO deve existir na tela
    await expect(page.getByRole("button", { name: /^Nova Posi(ç|c)ão$/i })).toHaveCount(0);
    // Só deve ter o botão "Do Quadro de Vagas"
    await expect(page.getByRole("button", { name: /Do Quadro de Vagas/i })).toBeVisible();
});

/* ───────────────────────── 3. UI Gap 3: Nova posição (via picker) + desligamento motivo → alerta vermelho ───────────────────────── */

test("UI Gap 3 — Nova posição + motivo de desligamento mostra alerta e bloqueia submit", async ({ page }) => {
    await loginViaUI(page);
    await page.goto(`${FRONT_URL}/app/gestao/solicitacoes`);

    // Abre picker e clica em "Nova Posição" de dentro dele
    await page.getByRole("button", { name: /Do Quadro de Vagas/i }).click();
    await expect(page.getByRole("heading", { name: /Selecionar Vaga do Quadro/i })).toBeVisible({ timeout: 5_000 });
    await page.locator('[data-testid="btn-nova-posicao-picker"]').click();
    await expect(page.locator('[data-testid="select-motivo-requisicao"]')).toBeVisible({ timeout: 5_000 });

    await page.locator('[data-testid="select-motivo-requisicao"]').selectOption("1");

    // Alerta vermelho aparece, bloco de dados NÃO aparece
    await expect(page.locator('[data-testid="alerta-nova-posicao-desligamento"]')).toBeVisible();
    await expect(page.locator('[data-testid="bloco-desligamento"]')).not.toBeVisible();

    // Tenta salvar — deve mostrar toast com mensagem específica
    await page.getByRole("button", { name: /Solicitar aprovação/i }).click();
    await expect(page.getByText(/Nova posição não permite motivo de desligamento/i)).toBeVisible({ timeout: 5_000 });
});

/* ───────────────────────── 4. API: fluxo principal — cria vaga COM desligamento vinculado ───────────────────────── */

test("API — criar vaga com motivo de desligamento JÁ cria o desligamento vinculado (auto-submetido)", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    await loginViaUI(page);
    await ensureSolicitante(page);

    const funcionario = await criarFuncionarioParaDesligar(page, stamp);
    console.log(`  [T4] Criei Funcionário pra desligar: ${funcionario.id} (${funcionario.name ?? "-"})`);

    const createRes = await api(page, "POST", "/api/solicitacoes-vaga", baseRequisicaoBody(funcionario.id, stamp, "PedidoDemissao"));
    expect(createRes.status, `POST solicitacao-vaga: ${createRes.text.slice(0, 400)}`).toBeLessThan(300);
    const sol = JSON.parse(createRes.text);
    console.log(`  [T4] POST /api/solicitacoes-vaga → status=${createRes.status}. Vaga.id=${sol.id}, DesligamentoVinculadoId=${sol.desligamentoVinculadoId}`);

    expect(sol.desligamentoVinculadoId, "bug fix: desligamento deve ser criado no CREATE").toBeTruthy();

    const deslRes = await api(page, "GET", `/api/solicitacoes-desligamento/${sol.desligamentoVinculadoId}`);
    expect(deslRes.status).toBe(200);
    const desl = JSON.parse(deslRes.text);
    console.log(`  [T4] GET /api/solicitacoes-desligamento/${sol.desligamentoVinculadoId} → funcionarioId=${desl.funcionarioId}, solicitacaoVagaOrigemId=${desl.solicitacaoVagaOrigemId}`);

    expect(desl.funcionarioId).toBe(funcionario.id);
    expect(desl.solicitacaoVagaOrigemId, "link bidirecional vaga→desligamento").toBe(sol.id);
    console.log(`  [T4] ✓ 3 assertions validadas: desligamento criado + funcionário correto + link bidirecional`);
});

/* ───────────────────────── 5. API: edição sincroniza desligamento vinculado ───────────────────────── */

test("API — edit do funcionário/data na vaga sincroniza o desligamento vinculado", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    await loginViaUI(page);
    await ensureSolicitante(page);

    const func1 = await criarFuncionarioParaDesligar(page, stamp + "A");
    const func2 = await criarFuncionarioParaDesligar(page, stamp + "B");

    const createRes = await api(page, "POST", "/api/solicitacoes-vaga", baseRequisicaoBody(func1.id, stamp, "PedidoDemissao"));
    const sol = JSON.parse(createRes.text);
    const deslId = sol.desligamentoVinculadoId;
    expect(deslId).toBeTruthy();
    console.log(`  [T5] Criei vaga ${sol.id} com func1=${func1.id} → desligamento ${deslId}`);

    // Update trocando funcionário + data
    const updateBody = {
        ...baseRequisicaoBody(func2.id, stamp, "PedidoDemissao"),
        dataDesligamento: "2026-06-30",
    };
    const updRes = await api(page, "PUT", `/api/solicitacoes-vaga/${sol.id}`, updateBody);
    expect(updRes.status).toBeLessThan(300);
    console.log(`  [T5] PUT /api/solicitacoes-vaga/${sol.id} → trocou funcionário para func2=${func2.id} e data para 2026-06-30`);

    const desl = JSON.parse((await api(page, "GET", `/api/solicitacoes-desligamento/${deslId}`)).text);
    console.log(`  [T5] GET desligamento → funcionarioId=${desl.funcionarioId}, dataDesligamento=${desl.dataDesligamento}`);
    expect(desl.funcionarioId, "desligamento deve refletir novo funcionário").toBe(func2.id);
    expect(String(desl.dataDesligamento).slice(0, 10), "data deve refletir novo valor").toBe("2026-06-30");
    console.log(`  [T5] ✓ sync confirmado: desligamento agora aponta pro func2 e data 2026-06-30`);
});

/* ───────────────────────── 6. API: cascata — reject do desligamento reprova a vaga ───────────────────────── */

test("API — reject do desligamento reprova a vaga em cascata", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    await loginViaUI(page);
    await ensureSolicitante(page);

    const funcionario = await criarFuncionarioParaDesligar(page, stamp);
    const createRes = await api(page, "POST", "/api/solicitacoes-vaga", baseRequisicaoBody(funcionario.id, stamp, "DesligamentoSemJustaCausa"));
    expect(createRes.status).toBeLessThan(300);
    const sol = JSON.parse(createRes.text);
    const deslId = sol.desligamentoVinculadoId;
    expect(deslId).toBeTruthy();

    console.log(`  [T6] Vaga ${sol.id} criada + desligamento ${deslId} vinculado (auto-submetido)`);

    // Desligamento já está PendenteAprovacao (auto-submit na criação). Reprova direto.
    const rej = await api(page, "POST", `/api/solicitacoes-desligamento/${deslId}/reject`, { observacao: "E2E cascade" });
    expect(rej.status).toBeLessThan(300);
    console.log(`  [T6] POST /api/solicitacoes-desligamento/${deslId}/reject → status=${rej.status} (desligamento reprovado)`);

    const vaga = JSON.parse((await api(page, "GET", `/api/solicitacoes-vaga/${sol.id}`)).text);
    console.log(`  [T6] GET vaga → status=${vaga.status}`);
    expect(vaga.status, "vaga deve ter sido reprovada em cascata").toBe("Reprovada");
    console.log(`  [T6] ✓ cascata validada: vaga também ficou Reprovada`);
});

/* ───────────────────────── 7. API: cancel da vaga cancela desligamento vinculado ───────────────────────── */

test("API — cancel da vaga cancela o desligamento vinculado em cascata", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    await loginViaUI(page);
    await ensureSolicitante(page);

    const funcionario = await criarFuncionarioParaDesligar(page, stamp);
    const createRes = await api(page, "POST", "/api/solicitacoes-vaga", baseRequisicaoBody(funcionario.id, stamp, "DesligamentoSemJustaCausa"));
    expect(createRes.status, `POST solicitacao-vaga: ${createRes.text.slice(0, 300)}`).toBeLessThan(300);
    const sol = JSON.parse(createRes.text);
    const deslId = sol.desligamentoVinculadoId;
    expect(deslId, "desligamento deve ter sido criado junto").toBeTruthy();

    console.log(`  [T7] Vaga ${sol.id} criada + desligamento ${deslId} vinculado (ambos em PendenteAprovacao)`);

    // Com auto-submit, a vaga está em PendenteAprovacao — cancel deve funcionar (status < 300).
    const cancelRes = await api(page, "POST", `/api/solicitacoes-vaga/${sol.id}/cancel`);
    expect(cancelRes.status, `cancel vaga falhou: ${cancelRes.text.slice(0, 300)}`).toBeLessThan(300);
    console.log(`  [T7] POST /api/solicitacoes-vaga/${sol.id}/cancel → status=${cancelRes.status}`);

    const vagaDetail = JSON.parse((await api(page, "GET", `/api/solicitacoes-vaga/${sol.id}`)).text);
    console.log(`  [T7] GET vaga → status=${vagaDetail.status}`);
    expect(vagaDetail.status, "vaga deve ter status Cancelada após cancel").toBe("Cancelada");

    const desl = JSON.parse((await api(page, "GET", `/api/solicitacoes-desligamento/${deslId}`)).text);
    console.log(`  [T7] GET desligamento → status=${desl.status}`);
    expect(["Cancelada", "Reprovada"], `desligamento deve estar Cancelada/Reprovada em cascata, mas está ${desl.status}`).toContain(desl.status);
    console.log(`  [T7] ✓ cascata validada: vaga=Cancelada, desligamento=${desl.status}`);
});

/* ───────────────────────── 8. API Auto-submit: vaga com desligamento nasce em PendenteAprovacao ───────────────────────── */

test("API Auto-submit — criar vaga com motivo de desligamento deixa ambas em PendenteAprovacao (não Rascunho)", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    await loginViaUI(page);
    await ensureSolicitante(page);

    const funcionario = await criarFuncionarioParaDesligar(page, stamp);
    const createRes = await api(page, "POST", "/api/solicitacoes-vaga", baseRequisicaoBody(funcionario.id, stamp, "PedidoDemissao"));
    expect(createRes.status).toBeLessThan(300);
    const sol = JSON.parse(createRes.text);
    console.log(`  [T8] POST /api/solicitacoes-vaga → vaga.status=${sol.status} (esperado: PendenteAprovacao)`);

    expect(sol.status, "vaga deve ir direto para PendenteAprovacao").toBe("PendenteAprovacao");
    expect(sol.desligamentoVinculadoId).toBeTruthy();

    const desl = JSON.parse((await api(page, "GET", `/api/solicitacoes-desligamento/${sol.desligamentoVinculadoId}`)).text);
    console.log(`  [T8] GET desligamento → status=${desl.status} (esperado: PendenteAprovacao)`);
    expect(desl.status, "desligamento também deve ir direto para PendenteAprovacao").toBe("PendenteAprovacao");
    console.log(`  [T8] ✓ auto-submit confirmado: vaga=PendenteAprovacao E desligamento=PendenteAprovacao (sem rascunho)`);
});

/* ───────────────────────── 9. API Auto-submit: vaga sem desligamento também vai pra PendenteAprovacao ───────────────────────── */

test("API Auto-submit — vaga sem motivo de desligamento nasce em PendenteAprovacao e sem desligamento vinculado", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    await loginViaUI(page);
    await ensureSolicitante(page);

    const createBody = {
        titulo: `QA Reqvaga Sem Desl ${stamp}`,
        justificativa: "Teste E2E sem desligamento.",
        qtdPosicoes: 1,
        urgencia: "Media",
        tipoSolicitacao: "VagaNova",
        isConfidencial: false,
        tipoContrato: "CLT",
        motivoRequisicao: "AtenderDemanda",
        cnhObrigatoria: false,
        disponibilidadeViagens: false,
    };
    const createRes = await api(page, "POST", "/api/solicitacoes-vaga", createBody);
    expect(createRes.status).toBeLessThan(300);
    const sol = JSON.parse(createRes.text);
    console.log(`  [T9] POST vaga sem desligamento → vaga.status=${sol.status}, desligamentoVinculadoId=${sol.desligamentoVinculadoId}`);

    expect(sol.status, "vaga sem desligamento também deve ir pra PendenteAprovacao").toBe("PendenteAprovacao");
    expect(sol.desligamentoVinculadoId, "sem motivo de desligamento não cria desligamento").toBeFalsy();
    console.log(`  [T9] ✓ vaga sem motivo de desligamento: vai pra PendenteAprovacao e NÃO gera desligamento`);
});

/* ───────────────────────── 10. API Amarração: response expõe CandidatoContratadoId ───────────────────────── */

test("API Amarração — SolicitacaoVaga response expõe os campos candidatoContratadoId e candidatoContratadoNome", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    await loginViaUI(page);
    await ensureSolicitante(page);

    // Cria uma vaga simples — sem candidato contratado ainda, os campos devem ser null
    const createBody = {
        titulo: `QA Amarracao ${stamp}`,
        justificativa: "Teste E2E amarração candidato.",
        qtdPosicoes: 1,
        urgencia: "Media",
        tipoSolicitacao: "VagaNova",
        isConfidencial: false,
        tipoContrato: "CLT",
        motivoRequisicao: "AtenderDemanda",
        cnhObrigatoria: false,
        disponibilidadeViagens: false,
    };
    const createRes = await api(page, "POST", "/api/solicitacoes-vaga", createBody);
    expect(createRes.status).toBeLessThan(300);
    const sol = JSON.parse(createRes.text);
    console.log(`  [T10] POST vaga → campos no response: candidatoContratadoId=${sol.candidatoContratadoId}, candidatoContratadoNome=${sol.candidatoContratadoNome}`);

    expect(sol).toHaveProperty("candidatoContratadoId");
    expect(sol).toHaveProperty("candidatoContratadoNome");
    expect(sol.candidatoContratadoId, "antes da contratação deve ser null").toBeFalsy();
    console.log(`  [T10] ✓ response DTO expõe os 2 campos da amarração (ambos null antes de contratar)`);
});

/* ───────────────────────── 11. API Amarração: efetivar pré-admissão preenche CandidatoContratadoId ───────────────────────── */

test("API Amarração — vincular candidato contratado preenche CandidatoContratadoId e expõe nome no response", async ({ page }) => {
    const stamp = Date.now().toString().slice(-6);
    await loginViaUI(page);
    await ensureSolicitante(page);

    // 1) Cria SolicitacaoVaga (sem precisar de Vaga física — amarração é direta)
    const solRes = await api(page, "POST", "/api/solicitacoes-vaga", {
        titulo: `QA Amarr ${stamp}`,
        justificativa: "Teste amarração candidato.",
        qtdPosicoes: 1,
        urgencia: "Media",
        tipoSolicitacao: "VagaNova",
        isConfidencial: false,
        tipoContrato: "CLT",
        motivoRequisicao: "AtenderDemanda",
        cnhObrigatoria: false,
        disponibilidadeViagens: false,
    });
    expect(solRes.status, `POST solicitacao-vaga: ${solRes.text.slice(0, 300)}`).toBeLessThan(300);
    const sol = JSON.parse(solRes.text);
    expect(sol.candidatoContratadoId, "antes da contratação, sem candidato").toBeFalsy();

    // 2) Busca qualquer Vaga existente; se não houver, cria uma dummy (Candidato exige VagaId obrigatório).
    //    GET /api/vagas retorna IReadOnlyList<VagaListItemResponse> (array direto — não paginado).
    const vagasRes = await api(page, "GET", "/api/vagas");
    expect(vagasRes.status, `GET vagas: ${vagasRes.text.slice(0, 300)}`).toBe(200);
    const vagasList = JSON.parse(vagasRes.text);
    let anyVagaId = Array.isArray(vagasList) && vagasList.length > 0 ? vagasList[0].id : null;
    console.log(`  [T11] GET /api/vagas retornou ${Array.isArray(vagasList) ? vagasList.length : "?"} vaga(s)`);

    if (!anyVagaId) {
        console.log(`  [T11] Nenhuma Vaga no tenant — criando uma dummy via POST /api/vagas`);
        const newVagaRes = await api(page, "POST", "/api/vagas", {
            titulo: `QA Vaga Amarr ${stamp}`,
            status: "Aberta",
            quantidadeVagas: 1,
            matchMinimoPercentual: 0,
            confidencial: false,
            aceitaPcd: false,
            urgente: false,
        });
        expect(newVagaRes.status, `POST vagas: ${newVagaRes.text.slice(0, 400)}`).toBeLessThan(300);
        anyVagaId = JSON.parse(newVagaRes.text).id;
        console.log(`  [T11] Vaga dummy criada: ${anyVagaId}`);
    } else {
        console.log(`  [T11] Usando Vaga existente: ${anyVagaId}`);
    }
    expect(anyVagaId, "deveria ter uma VagaId válida neste ponto").toBeTruthy();

    console.log(`  [T11] SolicitacaoVaga criada: ${sol.id} (antes: candidatoContratadoId=null)`);

    // 3) Cria um Candidato vinculado à vaga.
    //    Retry tolera bug pré-existente de concorrência no CandidatoService (Task.Run fire-and-forget usa o mesmo DbContext scoped).
    let candRes = { status: 0, text: "" };
    for (let attempt = 1; attempt <= 3; attempt++) {
        candRes = await api(page, "POST", "/api/candidatos", {
            nome: `QA Cand ${stamp} T${attempt}`,
            email: `qa.cand.${stamp}.t${attempt}@qualiit-test.com`,
            fonte: "Email",       // CandidateOrigin: Email | Pasta | LinkedIn | Indicacao | Site
            status: "Novo",
            vagaId: anyVagaId,
        });
        if (candRes.status < 300) break;
        console.log(`  [T11] Tentativa ${attempt} falhou (status=${candRes.status}). Retry em 1.5s…`);
        await page.waitForTimeout(1500);
    }
    expect(candRes.status, `POST candidato (após retries): ${candRes.text.slice(0, 300)}`).toBeLessThan(300);
    const candidato = JSON.parse(candRes.text);
    console.log(`  [T11] Candidato criado: ${candidato.id} (${candidato.nome})`);

    // 4) Amarra via endpoint direto — simula o momento da contratação
    const vincRes = await api(page, "PUT", `/api/solicitacoes-vaga/${sol.id}/vincular-candidato`, {
        candidatoId: candidato.id,
    });
    expect(vincRes.status, `PUT vincular-candidato: ${vincRes.text.slice(0, 300)}`).toBe(200);
    console.log(`  [T11] PUT /api/solicitacoes-vaga/${sol.id}/vincular-candidato → status=${vincRes.status}`);

    // 5) Valida response
    const vinc = JSON.parse(vincRes.text);
    console.log(`  [T11] Response: candidatoContratadoId=${vinc.candidatoContratadoId}, candidatoContratadoNome=${vinc.candidatoContratadoNome}`);
    expect(vinc.candidatoContratadoId, "amarração persistida").toBe(candidato.id);
    expect(vinc.candidatoContratadoNome, "nome do candidato no response").toBe(candidato.nome);

    // 6) Re-lê do banco pra confirmar persistência
    const reRead = JSON.parse((await api(page, "GET", `/api/solicitacoes-vaga/${sol.id}`)).text);
    console.log(`  [T11] Re-GET vaga → candidatoContratadoId=${reRead.candidatoContratadoId}, candidatoContratadoNome=${reRead.candidatoContratadoNome}`);
    expect(reRead.candidatoContratadoId).toBe(candidato.id);
    expect(reRead.candidatoContratadoNome).toBe(candidato.nome);
    console.log(`  [T11] ✓ amarração ponta-a-ponta validada: PUT amarra + GET confirma persistência`);
});

/* ───────────────────────── 13. API: filtro por vagaId retorna APENAS os ocupantes ATIVOS da vaga ───────────────────────── */

test("API — filtro vagaId JAMAIS retorna todos (bug relatado: '1/1 mas aparece TODOS')", async ({ page }) => {
    await loginViaUI(page);

    // Total de funcionários sem filtro — baseline pra comparar
    const allRes = await api(page, "GET", "/api/lookup/funcionarios?pageSize=1");
    expect(allRes.status).toBe(200);
    const totalFuncs = JSON.parse(allRes.text).total ?? 0;
    console.log(`  [T13] Baseline — total de funcionários no tenant: ${totalFuncs}`);

    // Busca vagas existentes
    const vagasRes = await api(page, "GET", "/api/vagas");
    expect(vagasRes.status).toBe(200);
    const vagas = JSON.parse(vagasRes.text);
    console.log(`  [T13] Tenant tem ${Array.isArray(vagas) ? vagas.length : 0} vaga(s)`);
    test.skip(!Array.isArray(vagas) || vagas.length === 0, "Tenant sem vagas — precisa de ao menos uma pra testar o filtro.");

    // Teste 1: vaga COM ocupante ativo → filtro deve retornar <= headcount ocupado
    const vagaComOcupante = vagas.find((v: { headcountOcupado?: number }) => (v.headcountOcupado ?? 0) > 0);
    if (vagaComOcupante) {
        const vagaId = vagaComOcupante.id;
        const headcount = vagaComOcupante.headcountOcupado;
        console.log(`  [T13.1] Testando vaga COM ocupante (${headcount}/${vagaComOcupante.headcountAutorizado ?? "?"}): ${vagaId}`);

        const res = await api(page, "GET", `/api/lookup/funcionarios?vagaId=${vagaId}&pageSize=500`);
        expect(res.status).toBe(200);
        const r = JSON.parse(res.text);
        console.log(`  [T13.1] filtered.total=${r.total} (headcount=${headcount}, baseline total=${totalFuncs})`);

        // REGRA DE OURO: filtro JAMAIS retorna todos. Se retornou = total, o filtro não funcionou.
        expect(r.total, `BUG: filtro deveria retornar <= ${headcount} ocupantes, mas retornou ${r.total} (= todos? baseline=${totalFuncs}).`).toBeLessThan(totalFuncs);
        expect(r.total, `filtro deveria retornar no máximo headcount=${headcount} funcionários`).toBeLessThanOrEqual(headcount);
    } else {
        console.log(`  [T13.1] Nenhuma vaga com ocupante — pulando assertion específica de headcount.`);
    }

    // Teste 2: filtro com vagaId QUALQUER (real) deve retornar < total (ou ZERO, nunca todos)
    const qualquerVaga = vagas[0];
    console.log(`  [T13.2] Testando qualquer vaga: ${qualquerVaga.id} ("${qualquerVaga.titulo ?? "-"}")`);
    const res2 = await api(page, "GET", `/api/lookup/funcionarios?vagaId=${qualquerVaga.id}&pageSize=500`);
    expect(res2.status).toBe(200);
    const r2 = JSON.parse(res2.text);
    console.log(`  [T13.2] filtered.total=${r2.total} (baseline total=${totalFuncs})`);
    expect(r2.total, `BUG: filtro por vaga retornou ${r2.total} = total geral (${totalFuncs}). Filtro não está aplicando!`).toBeLessThan(totalFuncs);

    console.log(`  [T13] ✓ filtro por vagaId NUNCA retorna todos — sempre aplica restrição`);
});

/* ───────────────────────── 12. API Gap 2: endpoint lookup aceita filtros ───────────────────────── */

test("API Gap 2 — /api/lookup/funcionarios filtra DE VERDADE por jobPositionId (não é só ignorar param)", async ({ page }) => {
    await loginViaUI(page);

    const allRes = await api(page, "GET", "/api/lookup/funcionarios?pageSize=200");
    expect(allRes.status, `GET funcionarios: ${allRes.text.slice(0, 200)}`).toBe(200);
    const all = JSON.parse(allRes.text);
    const totalSemFiltro = all.total ?? 0;
    console.log(`  [T12] Total de funcionários no tenant (sem filtro): ${totalSemFiltro}`);

    const guidInexistente = "00000000-0000-0000-0000-000000000000";
    const emptyRes = await api(page, "GET", `/api/lookup/funcionarios?jobPositionId=${guidInexistente}&pageSize=200`);
    expect(emptyRes.status).toBe(200);
    const empty = JSON.parse(emptyRes.text);
    console.log(`  [T12] GET funcionarios?jobPositionId=<GUID-inexistente> → total=${empty.total} (esperado: 0)`);

    expect(empty.total, `filtro com jobPositionId inexistente deve retornar 0 (se filtrasse); retornou ${empty.total} de um total ${totalSemFiltro}`).toBe(0);
    expect(empty.items.length, "items[] deve estar vazio").toBe(0);

    for (const param of ["unitId", "empresaId", "unidadeLotacaoId", "vagaId"]) {
        const r = await api(page, "GET", `/api/lookup/funcionarios?${param}=${guidInexistente}&pageSize=50`);
        expect(r.status, `GET ${param}: ${r.text.slice(0, 200)}`).toBe(200);
        const parsed = JSON.parse(r.text);
        console.log(`  [T12] GET funcionarios?${param}=<GUID-inexistente> → total=${parsed.total} (esperado: 0)`);
        expect(parsed.total, `${param} inexistente deve retornar 0`).toBe(0);
    }
    console.log(`  [T12] ✓ filtros validados: todos os 5 parâmetros (jobPositionId, unitId, empresaId, unidadeLotacaoId, vagaId) realmente filtram`);
});
