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
    return {
        nome, nomeSocial: null, nomeAbreviado: nome.split(" ")[0],
        cpf,
        rg: "478215036", rgOrgaoExpedidor: "SSP", rgUfExpedidor: "SP",
        rgDataExpedicao: "2012-04-18",
        dataNascimento: "1994-07-22",
        sexo: "Feminino", estadoCivil: "Solteiro",
        nacionalidade: "Brasileira", paisNacionalidade: "BRA",
        nomeMae: "Sandra Regina Oliveira", nomePai: "Carlos Eduardo Costa",
        naturalCidade: "CAMPINAS", naturalUf: "SP", paisNascimento: "BRA",
        passaporte: null, rnmRne: null, validadeVisto: null, tipoVisto: null,
        resideExterior: "N", tipoVistoEstrangeiro: 1,
        regIdentidCivilNumero: "478215036", regIdentidCivilUf: "SP",
        regIdentidCivilCidade: "CAMPINAS", regIdentidCivilOrgEmiss: "SSP",
        regIdentidCivilDataExped: "2012-04-18",
        cep: "01452000", logradouro: "Avenida Brigadeiro Faria Lima",
        numero: "2845", complemento: null, bairro: "Jardim Paulistano",
        cidade: "Sao Paulo", uf: "SP",
        pontoReferencia: "Próximo ao Shopping Iguatemi",
        tipoLogradouroESocial: "AV", municipioEnderecoIbge: 3550308,
        email: `mariana.qa.${cpf.slice(-6)}@qualiit-test.com.br`,
        emailAlternativo: null,
        telefone: "33214567", celular: "987651234",
        dddTelefone: 11, dddTelContato: 11,
        contatoEmergenciaNome: "Sandra Regina Oliveira",
        contatoEmergenciaFone: "11987651234",
        bancoCodigo: "341", bancoNome: "Itaú Unibanco",
        agencia: "3271", agenciaDigito: "0",
        conta: "2598431", contaDigito: "8",
        tipoConta: "ContaCorrente",
        estabelecimentoCodigo: "099", codEmpresa: "1",
        unitId: null, areaId: null, jobPositionId: null, requisitoCategoriaId: null,
        dataAdmissao: "2026-04-21", salario: 5240,
        tipoContratacao: "CLT", cargaHorariaSemanal: 44,
        pisPasep: "20754193628",
        codCargoTotvs: 427, codVinculoEmpregaticio: 10,
        tipoFuncionario: 1, categoriaSalarial: 1, grauInstrucao: 7,
        codTurno: 1,
        centroCusto: "99999", unidadeLotacao: "00001001",
        codPlanoLotacao: 101, codTurma: 1,
        numCartaoPonto: 28201475, codNivel: 1,
        tipoMaoDeObra: "ADM", formaPagamento: 1,
        salarioSimulado: 5240,
        origemFuncionario: 1, indFuncVinculado: 1, funcQualificado: "S",
        optanteFgts: "S", dataOpcaoFgts: "2026-04-21",
        tipoAdmissaoFgts: 1, recolheFgts: "S", recolheInss: "S",
        sindicalizado: "N", descContribSindical: "N",
        contribSindicDia: "S", codSindicato: 1,
        cargaAutomTurno: "S", recebePericul: "N", recebeInsalub: "N",
        recebeAdiantamento: "N", considEmissRAIS: "S",
        calcula13: "S", recebeFerias: "S",
        avos13SalCalcAnterior: 0, avos13SalCalc: 0,
        provAcum13Sal: 0, provAcumInss13Sal: 0, provAcumFgts13Sal: 0,
        diasProvFeriasMesAnterior: 0, diasProvFeriasMesAtual: 0,
        provAcumFerias: 0, provAcumInssFerias: 0,
        provAcumFgtsFerias: 0, provAcumFerias13: 0,
        emitCartPonto: "1",
        codLocalMarcacao: 1, codClassFuncPontoEletronico: 1,
        tituloEleitorNumero: "21459683022",
        tituloEleitorZona: "312", tituloEleitorSecao: "215",
        tituloEleitorCidade: "CAMPINAS", tituloEleitorUf: "SP",
        reservistaNumero: null,
        categoriaCnh: "B", validadeCnh: "2029-08-15",
        ctps: "78921", ctpsSerie: "354", ctpsUf: "SP",
        ctpsModelo: 3, ctpsSerieESocial: "354",
        cnhNumero: "08745126930", cnhUf: "SP", cnhOrgaoEmissor: "SSP",
        cnhDataExpedicao: 15082024, cnhPrimeiraHabilitacao: 22092014,
        docMilitarTipo: 1, docMilitarNumero: "412687", docMilitarSerie: "B",
        docMilitarRegiao: 2, docMilitarCircunscricao: 1,
        grupoSanguineo: 2, fatorRh: 1,
        possuiDeficiencia: "N", funcDoador: "S",
        cartaoSus: "70004193825",
        altura: 165, peso: 62,
        cutis: 1, cabelo: 2, olhos: 2,
        manequim: 38, sapato: 36,
        dataTerminoContrato: null,
        paisLocalidade: "BRA", codLocalidade: 17, codFpas: null,
        categoriaTrabalhoESocial: 101,
        indAdmissao: 1, naturezaAtividade: 1,
        municipioNascimentoIbge: 3509502,
        tipoAdmissaoESocial: 1,
        regimeTrabalhista: 1, regimePrevidenciario: 1, regimeJornada: 1,
        matriculaESocial: null,
        tipoEstatistica: 1, ocorrenciaCAGED: 1,
        codRegistroExterior: null,
        validacaoSalarioJustificativa: null,
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
    const nome = `Mariana QA ${cpf.slice(-4)}`;

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

    // Avança até o último step (Revisão)
    for (let i = 0; i < 6; i++) {
        const proximo = page.getByRole("button", { name: /Próximo/i });
        if (await proximo.isVisible().catch(() => false)) {
            await proximo.click();
            await page.waitForTimeout(250);
        }
    }

    // 6. Clica "Finalizar Admissão"
    const finalizar = page.getByRole("button", { name: /Finalizar Admissão/i });
    await expect(finalizar).toBeVisible({ timeout: 5_000 });
    await finalizar.click();

    // 7. Espera redirect de sucesso ou toast
    await Promise.race([
        page.waitForURL(/\/admissao\?submitted=1/, { timeout: 20_000 }),
        page.getByText(/finalizada com sucesso/i).waitFor({ timeout: 20_000 }),
    ]);
    console.log(`🚀 Submit aceito, aguardando integração TOTVS…`);

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
