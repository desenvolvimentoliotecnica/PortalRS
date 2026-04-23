import { test, expect, type Page } from "@playwright/test";

/**
 * E2E admissão manual: login RH → cria pré-admissão → popula via API
 * → percorre wizard → finaliza → aguarda integração TOTVS.
 *
 * Testa o fluxo que o RH faz na prática em QA. Roda contra
 * `https://renderrh-qa.qualiit.com.br` por padrão.
 *
 * Uso:
 *   pnpm exec playwright test tests/e2e/admissao-fullflow.spec.ts --headed
 *
 * Override env vars:
 *   E2E_BASE_URL   (front Next)  — padrão https://renderrh-qa.qualiit.com.br
 *   E2E_API_BASE   (RHPortal.Api) — padrão https://renderrh-qa.qualiit.com.br
 *   E2E_EMAIL      — padrão admin@consigaz.com
 *   E2E_PASSWORD   — padrão ChangeThisPassword123!
 *   E2E_TENANT     — padrão consigaz
 */

const FRONT_URL = process.env.E2E_BASE_URL ?? "https://renderrh-qa.qualiit.com.br";
const API_BASE  = process.env.E2E_API_BASE ?? FRONT_URL;
const EMAIL     = process.env.E2E_EMAIL    ?? "admin@consigaz.com";
const PASSWORD  = process.env.E2E_PASSWORD ?? "ChangeThisPassword123!";
const TENANT    = process.env.E2E_TENANT   ?? "consigaz";
// Em dev local o sync-service (employee-sync-service) geralmente não está rodando.
// Defina E2E_SKIP_INTEGRATION_WAIT=1 para parar no redirect de sucesso e não aguardar
// o worker TOTVS processar a fila.
const SKIP_INTEGRATION = process.env.E2E_SKIP_INTEGRATION_WAIT === "1";

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000); // 3min — integração TOTVS leva até ~60s

function gerarCpf(): string {
    const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    for (let i = 0; i < 2; i++) {
        const s = base.reduce((acc, d, idx) => acc + (base.length + 1 - idx) * d, 0);
        const dv = (s * 10) % 11;
        base.push(dv === 10 ? 0 : dv);
    }
    return base.join("");
}

function payloadCompleto(nome: string, cpf: string) {
    // Baseado no payload de referência do Lucas Ferreira Pereira que integrou com
    // Sucesso em QA (2026-04-20). Códigos TOTVS válidos: cargo 299, Santander 033
    // ag 4196, centro custo 99999, plano lotação 101, turno/turma 1, sindicato 1.
    return {
        nome, nomeSocial: null, nomeAbreviado: nome.split(" ")[0],
        cpf,
        rg: "353673791", rgOrgaoExpedidor: "SSP", rgUfExpedidor: "SP",
        rgDataExpedicao: "2010-10-27",
        dataNascimento: "1982-05-31",
        sexo: "Masculino", estadoCivil: "Solteiro",
        nacionalidade: "Brasileira", paisNacionalidade: "BRA",
        nomeMae: "Aurelia Mercado", nomePai: "Roberto Soares",
        naturalCidade: "SAO PAULO", naturalUf: "SP", paisNascimento: "BRA",
        passaporte: null, rnmRne: null, validadeVisto: null, tipoVisto: null,
        resideExterior: "N", tipoVistoEstrangeiro: 1,
        regIdentidCivilNumero: "353673791", regIdentidCivilUf: "SP",
        regIdentidCivilCidade: "SAO PAULO", regIdentidCivilOrgEmiss: "SSP",
        regIdentidCivilDataExped: "2010-10-27",
        cep: "04562000", logradouro: "Rua Indiana",
        numero: "71", complemento: null, bairro: "Brooklin",
        cidade: "Sao Paulo", uf: "SP",
        pontoReferencia: "Teste",
        tipoLogradouroESocial: "R", municipioEnderecoIbge: 3550308,
        email: `lucas.qa.${cpf.slice(-6)}@qualiit-test.com.br`,
        emailAlternativo: `teste.qa.${cpf.slice(-6)}@qualiit-test.com.br`,
        telefone: "38341345", celular: "988224045",
        dddTelefone: 11, dddTelContato: 11,
        contatoEmergenciaNome: "Aurelia Mercado",
        contatoEmergenciaFone: "11988224045",
        bancoCodigo: "033", bancoNome: "Santander",
        agencia: "4196", agenciaDigito: "0",
        conta: "1079060", contaDigito: "5",
        tipoConta: "ContaCorrente",
        estabelecimentoCodigo: "099", codEmpresa: "1",
        unitId: null, areaId: null, jobPositionId: null, requisitoCategoriaId: null,
        dataAdmissao: "2026-05-01", salario: 3835,
        tipoContratacao: "CLT", cargaHorariaSemanal: 44,
        pisPasep: "38752119521",
        codCargoTotvs: 299, codVinculoEmpregaticio: 10,
        tipoFuncionario: 1, categoriaSalarial: 1, grauInstrucao: 9,
        codTurno: 1,
        centroCusto: "99999", unidadeLotacao: "00001001",
        codPlanoLotacao: 101, codTurma: 1,
        numCartaoPonto: 28101049, codNivel: 1,
        tipoMaoDeObra: "ADM", formaPagamento: 1,
        salarioSimulado: 3835,
        origemFuncionario: 1, indFuncVinculado: 1, funcQualificado: "S",
        optanteFgts: "S", dataOpcaoFgts: "2026-05-01",
        tipoAdmissaoFgts: 1, recolheFgts: "S", recolheInss: "S",
        sindicalizado: "N", descContribSindical: "N",
        contribSindicDia: "S", codSindicato: 1,
        cargaAutomTurno: "S", recebePericul: "N", recebeInsalub: "N",
        recebeAdiantamento: "S", considEmissRAIS: "S",
        calcula13: "S", recebeFerias: "S",
        avos13SalCalcAnterior: 0, avos13SalCalc: 0,
        provAcum13Sal: 0, provAcumInss13Sal: 0, provAcumFgts13Sal: 0,
        diasProvFeriasMesAnterior: 0, diasProvFeriasMesAtual: 0,
        provAcumFerias: 0, provAcumInssFerias: 0,
        provAcumFgtsFerias: 0, provAcumFerias13: 0,
        emitCartPonto: "1",
        codLocalMarcacao: 1, codClassFuncPontoEletronico: 1,
        tituloEleitorNumero: "96215860116",
        tituloEleitorZona: "258", tituloEleitorSecao: "190",
        tituloEleitorCidade: "SAO PAULO", tituloEleitorUf: "SP",
        reservistaNumero: null,
        categoriaCnh: "B", validadeCnh: "2029-08-15",
        ctps: "30599", ctpsSerie: "272", ctpsUf: "SP",
        ctpsModelo: 3, ctpsSerieESocial: "272",
        cnhNumero: "5555685014", cnhUf: "SP", cnhOrgaoEmissor: "SSP",
        cnhDataExpedicao: 25102018, cnhPrimeiraHabilitacao: 14062002,
        docMilitarTipo: 1, docMilitarNumero: "399855", docMilitarSerie: "A",
        docMilitarRegiao: 2, docMilitarCircunscricao: 1,
        grupoSanguineo: 1, fatorRh: 2,
        possuiDeficiencia: "N", funcDoador: "S",
        cartaoSus: "10000141200",
        altura: 180, peso: 90,
        cutis: 3, cabelo: 1, olhos: 1,
        manequim: 40, sapato: 42,
        dataTerminoContrato: null,
        paisLocalidade: "BRA", codLocalidade: 17, codFpas: null,
        categoriaTrabalhoESocial: 101,
        indAdmissao: 1, naturezaAtividade: 1,
        municipioNascimentoIbge: 3550308,
        tipoAdmissaoESocial: 1,
        regimeTrabalhista: 1, regimePrevidenciario: 1, regimeJornada: 1,
        matriculaESocial: null,
        tipoEstatistica: 1, ocorrenciaCAGED: 1,
        codRegistroExterior: null,
        validacaoSalarioJustificativa: "QA mock — salário validado pelo gestor.",
    };
}

async function loginViaUI(page: Page) {
    await page.goto(`${FRONT_URL}/app/login`);
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#loginSubmit").click();
    await page.waitForURL(/\/app\/(dashboard|home|admissao)/, { timeout: 20_000 });
    // Confere token no localStorage (source of truth do apiFetch).
    const token = await page.evaluate(() => localStorage.getItem("renderrh.accessToken"));
    expect(token, "token JWT deve estar salvo após login").toBeTruthy();
}

test("RH preenche admissão manual e integração TOTVS retorna Sucesso", async ({ page }) => {
    const cpf = gerarCpf();
    const nome = `Lucas QA ${cpf.slice(-4)}`;

    // 1. Login RH real
    await loginViaUI(page);

    // 2. Abre lista de admissões e clica em "Nova Admissão"
    await page.goto(`${FRONT_URL}/app/admissao`);
    await page.getByRole("button", { name: /Nova Admissão/i }).click();

    // 3. Espera redirect pro wizard com ?id=xxx
    await page.waitForURL(/\/admissao\/nova\?id=[a-f0-9-]+/, { timeout: 10_000 });
    const match = page.url().match(/id=([a-f0-9-]{36})/);
    expect(match, "URL deve conter id da nova admissão").not.toBeNull();
    const preId = match![1];
    console.log(`📝 Pré-admissão criada: ${preId}`);

    // 4. Popula via API (PUT) — mais rápido que clicar em 45 campos
    const putResult = await page.evaluate(
        async ({ apiBase, tenant, id, body }) => {
            const token = localStorage.getItem("renderrh.accessToken");
            const res = await fetch(`${apiBase}/api/pre-admissao/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "X-Tenant-Id": tenant,
                },
                body: JSON.stringify(body),
            });
            return { status: res.status, text: await res.text() };
        },
        { apiBase: API_BASE, tenant: TENANT, id: preId, body: payloadCompleto(nome, cpf) },
    );
    expect(putResult.status, `PUT payload falhou: ${putResult.text.slice(0, 400)}`).toBe(200);
    console.log(`✅ Payload gravado via PUT`);

    // 5. Reload para o wizard carregar o estado atualizado e navegar para o último step
    await page.reload();
    await expect(page.getByRole("heading", { name: /Nova Admissão/i })).toBeVisible();

    // Vai direto para o step "Revisão e Envio" clicando na tab da barra de navegação
    // (evita ter que acertar N cliques de "Próximo" com save entre eles).
    await page.getByRole("button", { name: /Revisão e Envio/i }).click();

    // 6. Clica "Finalizar Admissão"
    const finalizar = page.getByRole("button", { name: /Finalizar Admissão/i });
    await expect(finalizar).toBeVisible({ timeout: 5_000 });
    await finalizar.click();

    // 7. Espera redirect de sucesso OU captura toast de erro pra diagnóstico
    const resultado = await Promise.race([
        page.waitForURL(/\/admissao\?submitted=1/, { timeout: 25_000 }).then(() => "ok" as const),
        page.getByText(/finalizada com sucesso/i).waitFor({ timeout: 25_000 }).then(() => "ok" as const),
        // Sonner marca toasts de erro com data-type="error" — ignora o "Salvo!" (success).
        page.locator('[data-sonner-toast][data-type="error"]').first().waitFor({ timeout: 25_000 }).then(async () => {
            const msg = await page.locator('[data-sonner-toast][data-type="error"]').first().innerText().catch(() => "");
            return `erro: ${msg}` as const;
        }),
    ]);
    if (resultado.startsWith("erro:")) {
        throw new Error(`Submit rejeitado pelo wizard: ${resultado}`);
    }
    console.log(`🚀 Submit aceito${SKIP_INTEGRATION ? "" : ", aguardando integração TOTVS…"}`);

    if (SKIP_INTEGRATION) {
        console.log(`⏭️  Pulando espera do worker (E2E_SKIP_INTEGRATION_WAIT=1)`);
        return;
    }

    // 8. Poll na API até o worker processar (ou dar Falha)
    await expect
        .poll(
            async () => {
                const result = await page.evaluate(
                    async ({ apiBase, tenant, id }) => {
                        const token = localStorage.getItem("renderrh.accessToken");
                        const res = await fetch(`${apiBase}/api/pre-admissao/${id}`, {
                            headers: {
                                "Authorization": `Bearer ${token}`,
                                "X-Tenant-Id": tenant,
                            },
                        });
                        if (!res.ok) return { integracaoResultado: null, integracaoMensagem: `HTTP ${res.status}` };
                        const data = await res.json();
                        return {
                            integracaoResultado: data.integracaoResultado,
                            integracaoMensagem: data.integracaoMensagem,
                            matriculaRM: data.matriculaRM,
                        };
                    },
                    { apiBase: API_BASE, tenant: TENANT, id: preId },
                );
                console.log(`   poll → ${JSON.stringify(result)}`);
                return result.integracaoResultado ?? "Pendente";
            },
            {
                message: "Worker TOTVS não concluiu a integração em 2min",
                intervals: [5_000, 10_000, 10_000, 10_000, 10_000, 15_000, 15_000, 15_000, 15_000, 15_000, 15_000, 15_000],
                timeout: 150_000,
            },
        )
        .toBe("Sucesso");

    console.log(`🎉 Admissão ${preId} integrada com sucesso no Datasul`);
});
