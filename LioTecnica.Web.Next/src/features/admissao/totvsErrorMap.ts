/**
 * Mapeamento dos nomes de campo retornados pelo backend em respostas 422
 * (type="totvs_validation") para os metadados da UI: step do wizard onde o
 * campo aparece e label amigável.
 *
 * Fonte dos nomes: `PreAdmissaoTotvsValidator.cs` (Req/ReqInt/Cond/Set).
 * Mensagens livres do Datasul (ex: "Cidade RIC deve ser informado") são
 * normalizadas via {@link parseDatasulMessage}.
 */
import type { ValidationError } from "./validation";
import { STEP_INDEX } from "./validation";

export interface TotvsFieldMeta {
    /** Label amigável para exibir no toast/banner. */
    label: string;
    /** Step do wizard onde o campo fica. */
    stepIndex: number;
    /** Nome no form (camelCase) — para scroll/focus. */
    formField: string;
}

/**
 * Map: nome do campo (PascalCase do backend) → meta.
 * Qualquer campo não listado cai no fallback genérico.
 */
export const TOTVS_FIELD_MAP: Record<string, TotvsFieldMeta> = {
    // FP1440 Cadastral
    Nome:              { label: "Nome",                formField: "nome",                stepIndex: STEP_INDEX.pessoal },
    NomeAbreviado:     { label: "Nome Abreviado",      formField: "nomeAbreviado",       stepIndex: STEP_INDEX.pessoal },
    DataNascimento:    { label: "Data de Nascimento",  formField: "dataNascimento",      stepIndex: STEP_INDEX.pessoal },
    Sexo:              { label: "Sexo",                formField: "sexo",                stepIndex: STEP_INDEX.pessoal },
    EstadoCivil:       { label: "Estado Civil",        formField: "estadoCivil",         stepIndex: STEP_INDEX.pessoal },
    PaisNacionalidade: { label: "País Nacionalidade",  formField: "paisNacionalidade",   stepIndex: STEP_INDEX.pessoal },
    PaisNascimento:    { label: "País Nascimento",     formField: "paisNascimento",      stepIndex: STEP_INDEX.pessoal },
    NaturalUf:         { label: "UF Nascimento",       formField: "naturalUf",           stepIndex: STEP_INDEX.pessoal },
    NaturalCidade:     { label: "Naturalidade",        formField: "naturalCidade",       stepIndex: STEP_INDEX.pessoal },
    GrauInstrucao:     { label: "Grau de Instrução",   formField: "grauInstrucao",       stepIndex: STEP_INDEX.pessoal },
    OrigemFuncionario: { label: "Origem",              formField: "origemFuncionario",   stepIndex: STEP_INDEX.pessoal },

    // RG
    Rg:                { label: "RG",                  formField: "rg",                  stepIndex: STEP_INDEX.pessoal },
    RgOrgaoExpedidor:  { label: "Órgão Expedidor RG",  formField: "rgOrgaoExpedidor",    stepIndex: STEP_INDEX.pessoal },
    RgUfExpedidor:     { label: "UF Expedidor RG",     formField: "rgUfExpedidor",       stepIndex: STEP_INDEX.pessoal },

    // RIC
    RegIdentidCivilNumero:   { label: "RIC (Nº Reg. Identidade Civil)", formField: "regIdentidCivilNumero",   stepIndex: STEP_INDEX.pessoal },
    RegIdentidCivilOrgEmiss: { label: "Órgão Emissor RIC",              formField: "regIdentidCivilOrgEmiss", stepIndex: STEP_INDEX.pessoal },
    RegIdentidCivilUf:       { label: "UF RIC",                         formField: "regIdentidCivilUf",       stepIndex: STEP_INDEX.pessoal },
    RegIdentidCivilCidade:   { label: "Cidade RIC",                     formField: "regIdentidCivilCidade",   stepIndex: STEP_INDEX.pessoal },

    // Documentos CPF/PIS
    Cpf:      { label: "CPF",        formField: "cpf",      stepIndex: STEP_INDEX.pessoal },
    PisPasep: { label: "PIS/PASEP",  formField: "pisPasep", stepIndex: STEP_INDEX.trabalhista },

    // Estrangeiro
    Passaporte:           { label: "Passaporte",           formField: "passaporte",           stepIndex: STEP_INDEX.pessoal },
    RnmRne:               { label: "RNM/RNE",              formField: "rnmRne",               stepIndex: STEP_INDEX.pessoal },
    ValidadeVisto:        { label: "Validade do Visto",    formField: "validadeVisto",        stepIndex: STEP_INDEX.pessoal },
    TipoVistoEstrangeiro: { label: "Tipo Visto Estrangeiro", formField: "tipoVistoEstrangeiro", stepIndex: STEP_INDEX.pessoal },

    // Tipo físico
    Cutis:  { label: "Raça/Cor", formField: "cutis",  stepIndex: STEP_INDEX.pessoal },
    Cabelo: { label: "Cabelo",   formField: "cabelo", stepIndex: STEP_INDEX.pessoal },
    Olhos:  { label: "Olhos",    formField: "olhos",  stepIndex: STEP_INDEX.pessoal },

    // Endereço
    Cep:                   { label: "CEP",                    formField: "cep",                   stepIndex: STEP_INDEX.endereco },
    Logradouro:            { label: "Logradouro",             formField: "logradouro",            stepIndex: STEP_INDEX.endereco },
    Bairro:                { label: "Bairro",                 formField: "bairro",                stepIndex: STEP_INDEX.endereco },
    Cidade:                { label: "Cidade",                 formField: "cidade",                stepIndex: STEP_INDEX.endereco },
    Uf:                    { label: "UF",                     formField: "uf",                    stepIndex: STEP_INDEX.endereco },
    MunicipioEnderecoIbge: { label: "Município (cód. IBGE)",  formField: "municipioEnderecoIbge", stepIndex: STEP_INDEX.endereco },
    CodEnderecoPostalExterior: { label: "Cód. Endereço Postal Exterior", formField: "codEnderecoPostalExterior", stepIndex: STEP_INDEX.endereco },
    CidadeExterior:        { label: "Cidade no Exterior",     formField: "cidadeExterior",        stepIndex: STEP_INDEX.endereco },

    // FP1500 Cadastral
    DataAdmissao:           { label: "Data de Admissão",      formField: "dataAdmissao",          stepIndex: STEP_INDEX.trabalhista },
    TipoFuncionario:        { label: "Tipo Funcionário",      formField: "tipoFuncionario",       stepIndex: STEP_INDEX.trabalhista },
    CodVinculoEmpregaticio: { label: "Vínculo Empregatício",  formField: "codVinculoEmpregaticio", stepIndex: STEP_INDEX.trabalhista },
    CategoriaSalarial:      { label: "Categoria Salarial",    formField: "categoriaSalarial",     stepIndex: STEP_INDEX.trabalhista },
    EmitCartPonto:          { label: "Emite Cartão Ponto",    formField: "emitCartPonto",         stepIndex: STEP_INDEX.trabalhista },
    TipoEstatistica:        { label: "Tipo Estatística",      formField: "tipoEstatistica",       stepIndex: STEP_INDEX.trabalhista },
    DataTerminoContrato:    { label: "Data Término Contrato", formField: "dataTerminoContrato",   stepIndex: STEP_INDEX.trabalhista },
    CodCargoTotvs:          { label: "Cargo TOTVS",           formField: "codCargoTotvs",         stepIndex: STEP_INDEX.trabalhista },
    Salario:                { label: "Salário",               formField: "salario",               stepIndex: STEP_INDEX.trabalhista },
    CargaHorariaSemanal:    { label: "Carga Horária Semanal", formField: "cargaHorariaSemanal",   stepIndex: STEP_INDEX.trabalhista },
    FormaPagamento:         { label: "Forma de Pagamento",    formField: "formaPagamento",        stepIndex: STEP_INDEX.trabalhista },
    TipoAdmissaoFgts:       { label: "Tipo Admissão FGTS",    formField: "tipoAdmissaoFgts",      stepIndex: STEP_INDEX.trabalhista },
    PaisLocalidade:         { label: "País Localidade",       formField: "paisLocalidade",        stepIndex: STEP_INDEX.trabalhista },
};

export interface TotvsValidationIssue {
    campo: string;
    label?: string;
    secao?: string;
    tipoRegra?: string;
    mensagem: string;
}

/**
 * Converte a lista de issues (422 do backend) em erros do wizard —
 * útil para redirecionar ao step culpado e destacar os campos.
 */
export function mapTotvsIssuesToErrors(issues: TotvsValidationIssue[]): ValidationError[] {
    return issues.map(issue => {
        const meta = TOTVS_FIELD_MAP[issue.campo];
        return {
            field:     meta?.formField ?? issue.campo,
            label:     meta?.label ?? issue.label ?? issue.campo,
            stepIndex: meta?.stepIndex ?? 0,
            message:   issue.mensagem,
        };
    });
}

/**
 * Quando o Datasul devolve uma string livre em `IntegracaoMensagem` (ex:
 * "Cidade RIC deve ser informado(a)."), tenta achar qual campo é pelo label.
 * Usado quando o erro vem do TOTVS depois da aprovação (fluxo de integração
 * assíncrono), não no 422 imediato.
 */
const DATASUL_KEYWORD_TO_FIELD: Array<{ keyword: RegExp; field: string }> = [
    { keyword: /cidade\s*ric/i,                field: "RegIdentidCivilCidade" },
    { keyword: /pa[ií]s\s*inexistente/i,       field: "PaisNacionalidade" },
    { keyword: /reside\s*(no\s*)?exterior/i,   field: "CidadeExterior" },
    { keyword: /emiss[aã]o\s*cart[aã]o\s*ponto/i, field: "EmitCartPonto" },
    { keyword: /tipo\s*admiss[aã]o\s*fgts/i,   field: "TipoAdmissaoFgts" },
];

export function parseDatasulMessage(mensagem: string): TotvsFieldMeta | null {
    for (const { keyword, field } of DATASUL_KEYWORD_TO_FIELD) {
        if (keyword.test(mensagem)) {
            return TOTVS_FIELD_MAP[field] ?? null;
        }
    }
    return null;
}
