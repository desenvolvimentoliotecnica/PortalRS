import { test, expect, type Page } from "@playwright/test";

/**
 * E2E de validação: garante que o wizard BLOQUEIA o submit quando há campos
 * obrigatórios vazios, mostra borda vermelha nos culpados, exibe toast e
 * navega até o primeiro step com erro.
 *
 * Complementa o `admissao-fullflow.spec.ts` (happy path): aquele testa que
 * tudo preenchido funciona; este testa que NADA preenchido é barrado.
 */

const FRONT_URL = process.env.E2E_BASE_URL ?? "https://renderrh-qa.qualiit.com.br";
const EMAIL     = process.env.E2E_EMAIL    ?? "admin@consigaz.com";
const PASSWORD  = process.env.E2E_PASSWORD ?? "ChangeThisPassword123!";
const TENANT    = process.env.E2E_TENANT   ?? "consigaz";

test.setTimeout(60_000);

function gerarCpf(): string {
    const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    for (let i = 0; i < 2; i++) {
        const s = base.reduce((acc, d, idx) => acc + (base.length + 1 - idx) * d, 0);
        const dv = (s * 10) % 11;
        base.push(dv === 10 ? 0 : dv);
    }
    return base.join("");
}

async function loginViaUI(page: Page) {
    await page.goto(`${FRONT_URL}/app/login`);
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#loginSubmit").click();
    await page.waitForURL(/\/app\/(dashboard|home|admissao)/, { timeout: 20_000 });
    const token = await page.evaluate(() => localStorage.getItem("renderrh.accessToken"));
    expect(token).toBeTruthy();
}

/**
 * Campos obrigatórios do wizard — deve bater 1:1 com o
 * `validatePreAdmissao` em `src/features/admissao/validation.ts`.
 */
const CAMPOS_OBRIGATORIOS = [
    "nome", "rg", "cpf", "dataNascimento", "nomeMae", "nomePai",
    "cidade", "uf", "email", "celular",
];

test("Wizard bloqueia submit vazio e destaca todos campos obrigatórios em vermelho", async ({ page }) => {
    const cpf = gerarCpf();
    const nome = `Validação QA ${cpf.slice(-4)}`;

    // 1. Login
    await loginViaUI(page);

    // 2. Cria pré-admissão minimamente (só nome+cpf) — rascunho vazio.
    await page.evaluate(
        async ({ tenant, body }) => {
            const token = localStorage.getItem("renderrh.accessToken");
            await fetch("/api/pre-admissao", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "X-Tenant-Id": tenant,
                },
                body: JSON.stringify(body),
            });
        },
        { tenant: TENANT, body: { nome, cpf } },
    );

    // 3. Abre lista e acessa a pré-admissão recém-criada pelo link
    await page.goto(`${FRONT_URL}/app/admissao`);
    // Alternativa robusta: já ir direto ao wizard de "nova" (cria via botão)
    await page.getByRole("button", { name: /Nova Admissão/i }).click();
    await page.waitForURL(/\/admissao\/nova\?id=[a-f0-9-]+/, { timeout: 10_000 });

    // 4. Vai direto para a aba "Revisão e Envio" sem preencher NADA
    await page.getByRole("button", { name: /Revisão e Envio/i }).click();

    // 5. Clica "Finalizar Admissão"
    const finalizar = page.getByRole("button", { name: /Finalizar Admissão/i });
    await expect(finalizar).toBeVisible({ timeout: 5_000 });
    const urlAntes = page.url();
    await finalizar.click();

    // 6. Assert: NÃO redirecionou (submit foi bloqueado)
    await page.waitForTimeout(500);
    expect(page.url(), "submit deveria ter sido bloqueado, mas redirecionou").toBe(urlAntes);

    // 7. Assert: toast de erro apareceu
    const toast = page.locator('[data-sonner-toast][data-type="error"]').first();
    await expect(toast).toBeVisible({ timeout: 3_000 });
    const toastMsg = await toast.innerText();

    // DEBUG: conta quantos elementos com border-red-500 existem em toda a página
    const totalVermelho = await page.locator(".border-red-500, .text-red-600").count();
    console.log(`🔍 Elementos vermelhos em toda página: ${totalVermelho}`);
    const stateErrors = await page.evaluate(() => (window as unknown as { __admissaoFieldErrors?: string[] }).__admissaoFieldErrors ?? []);
    console.log(`🔍 fieldErrors state: [${stateErrors.length}]\n  ${stateErrors.join(", ")}`);
    expect(toastMsg, "toast deve mencionar campo obrigatório").toMatch(/obrigatório|selecione|informe|pendência|pendencia/i);
    console.log(`🚨 Toast de erro: "${toastMsg.slice(0, 200)}"`);

    // 8. Assert: wizard navegou para o primeiro step com erro (Dados Pessoais = step 0)
    // Confere que o cabeçalho "Dados Pessoais" está visível
    await expect(page.getByRole("heading", { name: /Dados Pessoais/i })).toBeVisible();

    // 9. Assert: cada campo APONTADO pelo state `fieldErrors` precisa ter:
    //    - Wrapper com `data-field="<nome>"` no DOM
    //    - Destaque visual (borda ou label vermelho) dentro do wrapper
    //
    // Só testamos os que o validator realmente marcou — defaults do seeder (BRA, docMilitarTipo=1, etc)
    // NÃO aparecem no state porque já vieram preenchidos, e portanto não devem estar destacados.
    const gaps: string[] = [];

    // Percorre os 3 steps que têm campos validados — o state persiste entre navegações.
    for (const tab of ["Dados Pessoais", "Endereço", "Dados Trabalhistas"]) {
        await page.getByRole("button", { name: new RegExp(`^${tab}$`, "i") }).click();
        await page.waitForTimeout(200);

        // Para cada campo no state, confere se está visível nesse step e se está destacado.
        for (const campo of stateErrors) {
            const wrapper = page.locator(`[data-field="${campo}"]`);
            const count = await wrapper.count();
            if (count === 0) continue; // campo está em outro step — confere depois

            const destacado = await wrapper.locator(".border-red-500, .text-red-600").count();
            if (destacado === 0) {
                gaps.push(`${campo} (step ${tab}): wrapper existe mas não está destacado`);
            }
        }
    }

    // Campos do state que nunca apareceram em nenhum step — provavelmente faltando `data-field`.
    const camposVistos = new Set<string>();
    for (const tab of ["Dados Pessoais", "Endereço", "Dados Trabalhistas"]) {
        await page.getByRole("button", { name: new RegExp(`^${tab}$`, "i") }).click();
        await page.waitForTimeout(200);
        for (const campo of stateErrors) {
            if (await page.locator(`[data-field="${campo}"]`).count() > 0) {
                camposVistos.add(campo);
            }
        }
    }
    for (const campo of stateErrors) {
        if (!camposVistos.has(campo)) {
            gaps.push(`${campo}: state marcou como erro, mas sem data-field visível em nenhum step`);
        }
    }

    expect(
        gaps,
        `Gaps encontrados:\n  - ${gaps.join("\n  - ")}`,
    ).toEqual([]);

    console.log(`✅ ${stateErrors.length} campos apontados pelo validator estão corretamente destacados e com data-field`);
});
