import { test, expect, type Page } from "@playwright/test";

/**
 * Audita a cobertura de campos do wizard de admissão em QA.
 *
 * Fonte de verdade: a lista COMPLETA de campos que a API aceita no PUT
 * (baseada no payload do mock Luiz Fernando que integra no Datasul).
 * Objetivo: garantir que o RH tem acesso a cada campo no wizard manual.
 *
 *  ✓ Passa se:
 *    - Todos os OBRIGATÓRIOS do validator estão no wizard com data-field + "*"
 *    - Todos os CAMPOS DO PAYLOAD estão no wizard com data-field
 *  ✗ Falha listando exatamente quais campos faltam.
 *
 * Detecção runtime: `[data-field="<campo>"]` — gerado pelos helpers Field/
 * Select/FlagSN via prop `field=`. Wrappers inline usam `data-field=...`.
 */

const FRONT_URL = process.env.E2E_BASE_URL ?? "https://renderrh-qa.qualiit.com.br";
const EMAIL     = process.env.E2E_EMAIL    ?? "admin@dev.local";
const PASSWORD  = process.env.E2E_PASSWORD ?? "ChangeThisPassword123!";
const TENANT    = process.env.E2E_TENANT   ?? "consigaz";

test.setTimeout(120_000);

const TABS_WIZARD = [
    "Dados Pessoais",
    "Endereço",
    "Contato",
    "Dados Bancários",
    "Dados Trabalhistas",
    "Encargos e eSocial",
    "Documentos",
];

/**
 * 69 campos obrigatórios — bate 1:1 com validator
 * (`src/features/admissao/validation.ts::validatePreAdmissao`).
 * Ordem: precedência no `iPeso` do Datasul e leitura natural do wizard.
 */
const OBRIGATORIOS: string[] = [
    // Pessoal + RIC + Tipo Físico
    "nome", "nomeAbreviado", "cpf", "dataNascimento", "sexo", "estadoCivil",
    "paisNacionalidade", "paisNascimento", "naturalUf", "naturalCidade",
    "origemFuncionario", "grauInstrucao",
    "regIdentidCivilNumero", "regIdentidCivilOrgEmiss",
    "regIdentidCivilUf", "regIdentidCivilCidade",
    "cutis", "cabelo", "olhos",
    // Endereço
    "cep", "logradouro", "bairro", "cidade", "uf", "municipioEnderecoIbge",
    // Trabalhista / TOTVS
    "codEmpresa", "dataAdmissao", "salario", "codCargoTotvs",
    "codVinculoEmpregaticio", "tipoFuncionario", "categoriaSalarial",
    "cargaHorariaSemanal", "emitCartPonto", "tipoEstatistica",
    "codTurma", "indFuncVinculado", "tipoMaoDeObra", "codSindicato",
    "codLocalMarcacao", "codClassFuncPontoEletronico", "codLocalidade",
    "formaPagamento", "tipoAdmissaoFgts", "paisLocalidade",
    "docMilitarTipo", "docMilitarRegiao", "docMilitarCircunscricao",
    "tipoVistoEstrangeiro", "ocorrenciaCAGED",
    // Encargos S/N
    "optanteFgts", "recolheFgts", "recolheInss", "sindicalizado",
    "descContribSindical", "resideExterior",
    "cargaAutomTurno", "calcula13", "recebeFerias", "considEmissRAIS",
    "recebePericul", "recebeInsalub", "recebeAdiantamento",
    // eSocial
    "tipoLogradouroESocial", "categoriaTrabalhoESocial", "indAdmissao",
    "tipoAdmissaoESocial", "regimeTrabalhista", "regimePrevidenciario",
    "regimeJornada",
];

/**
 * Lista COMPLETA — todo campo que o PUT /api/pre-admissao/:id aceita
 * e deveria ser editável pelo RH via wizard. Provisões acumuladas (avos*,
 * provAcum*, diasProvFerias*) são excluídas porque só se aplicam a
 * funcionário MIGRADO — admissão nova começa zerada por definição.
 */
const TODOS_CAMPOS_PAYLOAD: string[] = [
    ...OBRIGATORIOS,
    // Pessoal — opcionais
    "nomeSocial", "nomeMae", "nomePai", "nacionalidade",
    "rg", "rgOrgaoExpedidor", "rgUfExpedidor", "rgDataExpedicao",
    "regIdentidCivilDataExped",
    "grupoSanguineo", "fatorRh", "possuiDeficiencia", "funcDoador",
    "cartaoSus", "altura", "peso", "manequim", "sapato",
    "municipioNascimentoIbge",
    // Endereço — opcionais
    "numero", "complemento", "pontoReferencia",
    // Contato
    "email", "emailAlternativo", "telefone", "celular",
    "dddTelefone", "dddTelContato",
    "contatoEmergenciaNome", "contatoEmergenciaFone",
    // Bancário
    "bancoCodigo", "bancoNome", "agencia", "agenciaDigito",
    "conta", "contaDigito", "tipoConta",
    // Trabalhista — opcionais
    "estabelecimentoCodigo", "salarioSimulado", "tipoContratacao",
    "pisPasep", "codTurno", "centroCusto", "unidadeLotacao",
    "codPlanoLotacao", "numCartaoPonto", "codNivel",
    "funcQualificado", "dataTerminoContrato",
    "docMilitarNumero", "docMilitarSerie",
    "tituloEleitorNumero", "tituloEleitorZona", "tituloEleitorSecao",
    "tituloEleitorCidade", "tituloEleitorUf", "reservistaNumero",
    "categoriaCnh", "validadeCnh",
    "ctps", "ctpsSerie", "ctpsUf", "ctpsModelo", "ctpsSerieESocial",
    "cnhNumero", "cnhUf", "cnhOrgaoEmissor",
    "cnhDataExpedicao", "cnhPrimeiraHabilitacao",
    // Encargos opcionais / eSocial
    "dataOpcaoFgts", "contribSindicDia", "naturezaAtividade",
    "matriculaESocial", "codFpas", "codRegistroExterior",
];

/**
 * Condicionais — só aparecem quando a regra dispara. Validados à parte.
 *   - passaporte/rnmRne/validadeVisto/tipoVisto: só se nacionalidade !== "brasileira"
 *   - validacaoSalarioJustificativa: só se salário acima do teto da faixa do cargo
 * O spec confere que existem no DOM QUANDO a condição dispara (ver trigger abaixo).
 */
const CONDICIONAIS: string[] = [
    "passaporte", "rnmRne", "validadeVisto", "tipoVisto",
    "validacaoSalarioJustificativa",
];

// Remove duplicados (OBRIGATORIOS já entraram no spread).
const CAMPOS_ESPERADOS = Array.from(new Set(TODOS_CAMPOS_PAYLOAD));

async function loginViaUI(page: Page) {
    await page.goto(`${FRONT_URL}/app/login`);
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator("#loginSubmit").click();
    await page.waitForURL(/\/app\/(dashboard|home|admissao)/, { timeout: 20_000 });
}

async function coletarDataFields(page: Page): Promise<string[]> {
    return page.evaluate(() =>
        Array.from(document.querySelectorAll("[data-field]"))
            .map(el => el.getAttribute("data-field"))
            .filter((f): f is string => !!f && f.trim() !== "")
    );
}

async function labelTemAsterisco(page: Page, campo: string): Promise<boolean> {
    return page.evaluate((c) => {
        const wrapper = document.querySelector<HTMLElement>(`[data-field="${c}"]`);
        if (!wrapper) return false;
        const label = wrapper.querySelector("label");
        if (!label) return false;
        return (label.textContent ?? "").includes("*");
    }, campo);
}

test("Wizard de admissão manual tem todos os campos do payload TOTVS com marcação correta", async ({ page }) => {
    await loginViaUI(page);

    // Cria pré-admissão stub (só nome+cpf, mínimo pra abrir o wizard).
    const cpf = Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join("");
    const created = await page.evaluate(
        async ({ tenant, nome, cpf }) => {
            const token = localStorage.getItem("renderrh.accessToken");
            const res = await fetch("/api/pre-admissao", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "X-Tenant-Id": tenant,
                },
                body: JSON.stringify({ preenchidoPor: "RH", candidatoId: null, nome, cpf }),
            });
            const text = await res.text();
            let body: unknown = null;
            try { body = text ? JSON.parse(text) : null; } catch { body = text; }
            return { status: res.status, body };
        },
        { tenant: TENANT, nome: `Cobertura QA ${cpf.slice(-4)}`, cpf },
    );
    expect(
        [200, 201].includes(created.status),
        `POST /api/pre-admissao falhou (status ${created.status}): ${JSON.stringify(created.body).slice(0, 500)}`
    ).toBe(true);
    const preId: string = (created.body as { id: string }).id;
    console.log(`📝 Pré-admissão auditoria: ${preId}`);

    await page.goto(`${FRONT_URL}/app/admissao/nova?id=${preId}`);
    await expect(page.getByRole("heading", { name: /Nova Admissão/i })).toBeVisible({ timeout: 15_000 });

    // Passa por cada tab, acumula os data-fields vistos globalmente.
    const camposGlobais = new Map<string, string>(); // campo → tab onde foi visto primeiro

    for (const tab of TABS_WIZARD) {
        const btn = page.getByRole("button", { name: new RegExp(`^${tab}$`, "i") });
        if (await btn.count() === 0) {
            console.log(`⚠️  Tab "${tab}" não encontrada — pulando.`);
            continue;
        }
        await btn.first().click();
        await page.waitForTimeout(300);
        const presentes = await coletarDataFields(page);
        for (const campo of presentes) {
            if (!camposGlobais.has(campo)) camposGlobais.set(campo, tab);
        }
        console.log(`  ${tab.padEnd(22)} → ${presentes.length} campos`);
    }

    // Dispara condicionais: nacionalidade estrangeira → revela seção de estrangeiro;
    // validacaoSalarioOk=false → revela campo de justificativa (via PUT direto).
    await page.evaluate(
        async ({ tenant, id }) => {
            const token = localStorage.getItem("renderrh.accessToken");
            await fetch(`/api/pre-admissao/${id}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "X-Tenant-Id": tenant,
                },
                body: JSON.stringify({
                    nome: `Cobertura QA condicional`,
                    nacionalidade: "Argentina",
                    paisNacionalidade: "ARG",
                    origemFuncionario: 3,  // estrangeiro → força seção passaporte/visto
                    salario: 999999,       // acima do teto → força justificativa
                }),
            });
        },
        { tenant: TENANT, id: preId },
    );
    // Reload do wizard pra carregar estado novo, depois passa tab Dados Pessoais e Trabalhista.
    await page.reload();
    await expect(page.getByRole("heading", { name: /Nova Admissão/i })).toBeVisible({ timeout: 15_000 });

    for (const tab of ["Dados Pessoais", "Dados Trabalhistas"]) {
        await page.getByRole("button", { name: new RegExp(`^${tab}$`, "i") }).first().click();
        await page.waitForTimeout(300);
        for (const campo of await coletarDataFields(page)) {
            if (!camposGlobais.has(campo)) camposGlobais.set(campo, tab);
        }
    }

    // Gaps: campos esperados pelo payload que não aparecem com data-field.
    const faltantes = CAMPOS_ESPERADOS.filter(c => !camposGlobais.has(c));
    const obrigatoriosFaltantes = OBRIGATORIOS.filter(c => !camposGlobais.has(c));
    const opcionaisFaltantes = faltantes.filter(c => !OBRIGATORIOS.includes(c));
    const condicionaisFaltantes = CONDICIONAIS.filter(c => !camposGlobais.has(c));

    // Obrigatórios sem asterisco no label.
    const obrigatoriosSemAsterisco: string[] = [];
    for (const campo of OBRIGATORIOS) {
        if (!camposGlobais.has(campo)) continue;
        const tab = camposGlobais.get(campo)!;
        await page.getByRole("button", { name: new RegExp(`^${tab}$`, "i") }).first().click();
        await page.waitForTimeout(100);
        if (!(await labelTemAsterisco(page, campo))) {
            obrigatoriosSemAsterisco.push(`${campo} (${tab})`);
        }
    }

    // data-fields presentes mas não listados no payload — são campos UI internos
    // (ex: jobPositionId). Não bloqueia, só informa.
    const extras = Array.from(camposGlobais.keys())
        .filter(c => !CAMPOS_ESPERADOS.includes(c) && !CONDICIONAIS.includes(c));

    console.log(`\n════════════ RESUMO ════════════`);
    console.log(`   total data-fields no wizard:         ${camposGlobais.size}`);
    console.log(`   obrigatórios esperados / presentes:  ${OBRIGATORIOS.length} / ${OBRIGATORIOS.length - obrigatoriosFaltantes.length}`);
    console.log(`   payload completo / presentes:        ${CAMPOS_ESPERADOS.length} / ${CAMPOS_ESPERADOS.length - faltantes.length}`);
    console.log(`   condicionais / triggers disparados:  ${CONDICIONAIS.length} / ${CONDICIONAIS.length - condicionaisFaltantes.length}`);
    console.log(`   obrigatórios ausentes:               ${obrigatoriosFaltantes.length}`);
    console.log(`   obrigatórios sem "*":                ${obrigatoriosSemAsterisco.length}`);
    console.log(`   opcionais ausentes:                  ${opcionaisFaltantes.length}`);
    console.log(`   condicionais ausentes após trigger:  ${condicionaisFaltantes.length}`);
    console.log(`   data-fields extras (UI interno):     ${extras.length}`);

    if (obrigatoriosFaltantes.length) {
        console.log(`\n❌ OBRIGATÓRIOS AUSENTES NO WIZARD (RH não consegue preencher):`);
        obrigatoriosFaltantes.forEach(c => console.log(`   - ${c}`));
    }
    if (obrigatoriosSemAsterisco.length) {
        console.log(`\n⚠️  OBRIGATÓRIOS SEM "*" NO LABEL:`);
        obrigatoriosSemAsterisco.forEach(c => console.log(`   - ${c}`));
    }
    if (opcionaisFaltantes.length) {
        console.log(`\n⚠️  OPCIONAIS AUSENTES (payload aceita, wizard não edita):`);
        opcionaisFaltantes.forEach(c => console.log(`   - ${c}`));
    }
    if (condicionaisFaltantes.length) {
        console.log(`\n⚠️  CONDICIONAIS AUSENTES (trigger disparado, mas campo não apareceu):`);
        condicionaisFaltantes.forEach(c => console.log(`   - ${c}`));
    }

    // Asserts — falha explícita pra cada categoria de gap.
    expect(obrigatoriosFaltantes,
        `Campos OBRIGATÓRIOS do validator TOTVS ausentes no wizard.`
    ).toEqual([]);

    expect(obrigatoriosSemAsterisco,
        `Campos obrigatórios sem "*" no label — RH não sabe que deve preencher.`
    ).toEqual([]);

    expect(opcionaisFaltantes,
        `Campos OPCIONAIS do payload ausentes do wizard — API aceita mas RH não consegue editar.`
    ).toEqual([]);

    expect(condicionaisFaltantes,
        `Campos CONDICIONAIS não apareceram mesmo com trigger disparado (estrangeiro + salário acima do teto).`
    ).toEqual([]);
});
