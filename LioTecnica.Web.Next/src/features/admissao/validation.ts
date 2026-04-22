/**
 * Validação centralizada do Wizard de Admissão — aplicada APENAS no submit
 * (clique em "Finalizar Admissão"), não nos passos intermediários.
 *
 * A lista de campos obrigatórios é conservadora: cobre apenas o que sabidamente
 * é exigido pela integração TOTVS. Campos adicionais serão incluídos conforme
 * o catálogo empírico de erros for preenchido em
 * `Voltage.RenderRH/MAPEAMENTO_TOTVS_PREADMISSAO.md`.
 */

export interface ValidationError {
  field: string;
  label: string;
  stepIndex: number;
  message: string;
}

export interface PreAdmissaoFormLike {
  // Pessoal
  nome?: string | null;
  nomeAbreviado?: string | null;
  cpf?: string | null;
  dataNascimento?: string | null;
  sexo?: number | null;
  estadoCivil?: number | null;
  nacionalidade?: string | null;
  paisNacionalidade?: string | null;
  paisNascimento?: string | null;
  naturalUf?: string | null;
  naturalCidade?: string | null;
  grauInstrucao?: number | null;
  origemFuncionario?: number | null;
  // RIC (Registro Identidade Civil) — obrigatório TOTVS
  regIdentidCivilNumero?: string | null;
  regIdentidCivilUf?: string | null;
  regIdentidCivilCidade?: string | null;
  regIdentidCivilOrgEmiss?: string | null;
  // Características físicas
  cutis?: number | null;
  cabelo?: number | null;
  olhos?: number | null;
  // Endereço
  cep?: string | null;
  logradouro?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  municipioEnderecoIbge?: number | null;
  // Trabalhista / TOTVS
  dataAdmissao?: string | null;
  salario?: number | null;
  tipoContratacao?: number | null;
  cargaHorariaSemanal?: number | null;
  codCargoTotvs?: number | null;
  codVinculoEmpregaticio?: number | null;
  tipoFuncionario?: number | null;
  categoriaSalarial?: number | null;
  tipoEstatistica?: number | null;
  estabelecimentoCodigo?: string | null;
  centroCusto?: string | null;
  unidadeLotacao?: string | null;
  pisPasep?: string | null;
  emitCartPonto?: string | null;
  // Jornada, Ponto e Sindicato (TOTVS)
  codTurma?: number | null;
  indFuncVinculado?: number | null;
  tipoMaoDeObra?: string | null;
  codSindicato?: number | null;
  codLocalMarcacao?: number | null;
  codClassFuncPontoEletronico?: number | null;
  codLocalidade?: number | null;
  // Selects TOTVS recém-adicionados ao wizard (obrigatórios Zod no sync-service)
  formaPagamento?: number | null;
  tipoAdmissaoFgts?: number | null;
  paisLocalidade?: string | null;
  // Documentos militares / CAGED (TOTVS rejeita < 1 mesmo para mulheres/brasileiros)
  docMilitarTipo?: number | null;
  docMilitarRegiao?: number | null;
  docMilitarCircunscricao?: number | null;
  ocorrenciaCAGED?: number | null;
  // RG (conjunto — se algum, todos obrigatórios)
  rg?: string | null;
  rgOrgaoExpedidor?: string | null;
  rgUfExpedidor?: string | null;
  // Condicional: Estrangeiro (origemFuncionario === 3)
  passaporte?: string | null;
  rnmRne?: string | null;
  validadeVisto?: string | null;
  tipoVistoEstrangeiro?: number | null;
  // Condicional: Naturalizado (origemFuncionario === 2)
  portariaNaturalizacao?: string | null;
  naturalizacao?: string | null;
  // Condicional: Reside no exterior (resideExterior === "S")
  resideExterior?: string | null;
  codEnderecoPostalExterior?: string | null;
  cidadeExterior?: string | null;
  // Condicional: CLT prazo determinado (codVinculoEmpregaticio === 20)
  dataTerminoContrato?: number | null;
  validacaoSalarioJustificativa?: string | null;
  validacaoSalarioOk?: boolean | null;
  [key: string]: unknown;
}

/** Steps do wizard — mapeia índices para uso interno. */
export const STEP_INDEX = {
  pessoal: 0,
  endereco: 1,
  contato: 2,
  bancario: 3,
  trabalhista: 4,
  documentos: 5,
  revisao: 6,
} as const;

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (typeof v === "number") return !Number.isFinite(v);
  return false;
}

/**
 * País TOTVS: obrigatório e deve estar no formato ISO 3166-1 alpha-3
 * (3 letras maiúsculas, ex: BRA, USA). Datasul rejeita "Brasil" e nomes por extenso.
 */
function isIso3Invalid(v: unknown): boolean {
  if (typeof v !== "string") return true;
  const t = v.trim();
  if (t.length !== 3) return true;
  if (!/^[A-Z]{3}$/.test(t)) return true;
  return false;
}

/** Valida o form completo. Retorna lista de erros (vazia = OK). */
export function validatePreAdmissao(form: PreAdmissaoFormLike): ValidationError[] {
  const errors: ValidationError[] = [];

  // ── FP1440 Cadastral ──────────────────────────────────────────────────────
  if (isBlank(form.nome))             errors.push({ field: "nome",            label: "Nome Completo",     stepIndex: STEP_INDEX.pessoal,    message: "Informe o nome completo." });
  if (isBlank(form.nomeAbreviado))    errors.push({ field: "nomeAbreviado",   label: "Nome Abreviado",    stepIndex: STEP_INDEX.pessoal,    message: "Informe o nome abreviado." });
  if (isBlank(form.cpf))              errors.push({ field: "cpf",             label: "CPF",               stepIndex: STEP_INDEX.pessoal,    message: "Informe o CPF." });
  if (isBlank(form.dataNascimento))   errors.push({ field: "dataNascimento",  label: "Data de Nascimento",stepIndex: STEP_INDEX.pessoal,    message: "Informe a data de nascimento." });
  if (!form.sexo || form.sexo === 0)  errors.push({ field: "sexo",            label: "Sexo",              stepIndex: STEP_INDEX.pessoal,    message: "Selecione o sexo." });
  if (!form.estadoCivil || form.estadoCivil === 0) errors.push({ field: "estadoCivil", label: "Estado Civil", stepIndex: STEP_INDEX.pessoal, message: "Selecione o estado civil." });
  if (isIso3Invalid(form.paisNacionalidade)) errors.push({ field: "paisNacionalidade", label: "País (Nacionalidade)", stepIndex: STEP_INDEX.pessoal, message: "Use código ISO de 3 letras (ex: BRA). TOTVS rejeita \"Brasil\" por extenso." });
  if (isIso3Invalid(form.paisNascimento))    errors.push({ field: "paisNascimento",  label: "País Nascimento",    stepIndex: STEP_INDEX.pessoal, message: "Use código ISO de 3 letras (ex: BRA)." });
  if (isBlank(form.naturalUf))        errors.push({ field: "naturalUf",       label: "UF Nascimento",     stepIndex: STEP_INDEX.pessoal,    message: "Informe a UF de nascimento." });
  if (isBlank(form.naturalCidade))    errors.push({ field: "naturalCidade",   label: "Naturalidade",      stepIndex: STEP_INDEX.pessoal,    message: "Informe a cidade de nascimento." });
  if (!form.origemFuncionario || form.origemFuncionario === 0) errors.push({ field: "origemFuncionario", label: "Origem", stepIndex: STEP_INDEX.pessoal, message: "Selecione a origem (Brasileiro/Naturalizado/Estrangeiro)." });

  // ── RIC — Registro Identidade Civil (obrigatório TOTVS) ───────────────────
  if (isBlank(form.regIdentidCivilNumero))    errors.push({ field: "regIdentidCivilNumero",    label: "RIC (Nº Reg. Identidade Civil)", stepIndex: STEP_INDEX.pessoal, message: "Informe o número do RIC." });
  else if (String(form.regIdentidCivilNumero).trim().length < 3) errors.push({ field: "regIdentidCivilNumero", label: "RIC (Nº Reg. Identidade Civil)", stepIndex: STEP_INDEX.pessoal, message: "Número do RIC muito curto (mín. 3 caracteres)." });
  if (isBlank(form.regIdentidCivilOrgEmiss))  errors.push({ field: "regIdentidCivilOrgEmiss",  label: "Órgão Emissor RIC",              stepIndex: STEP_INDEX.pessoal, message: "Informe o órgão emissor do RIC (ex: SSP)." });
  if (isBlank(form.regIdentidCivilUf))        errors.push({ field: "regIdentidCivilUf",        label: "UF RIC",                         stepIndex: STEP_INDEX.pessoal, message: "Selecione a UF do RIC." });
  if (isBlank(form.regIdentidCivilCidade))    errors.push({ field: "regIdentidCivilCidade",    label: "Cidade RIC",                     stepIndex: STEP_INDEX.pessoal, message: "Informe a cidade de emissão do RIC." });
  else if (String(form.regIdentidCivilCidade).trim().length < 3) errors.push({ field: "regIdentidCivilCidade", label: "Cidade RIC", stepIndex: STEP_INDEX.pessoal, message: "Nome da cidade muito curto (mín. 3 caracteres)." });

  // ── FP1440 Tipo Físico ────────────────────────────────────────────────────
  if (!form.cutis  || form.cutis  === 0) errors.push({ field: "cutis",  label: "Raça/Cor", stepIndex: STEP_INDEX.pessoal, message: "Selecione a raça/cor." });
  if (!form.cabelo || form.cabelo === 0) errors.push({ field: "cabelo", label: "Cabelo",   stepIndex: STEP_INDEX.pessoal, message: "Selecione a cor do cabelo." });
  if (!form.olhos  || form.olhos  === 0) errors.push({ field: "olhos",  label: "Olhos",    stepIndex: STEP_INDEX.pessoal, message: "Selecione a cor dos olhos." });

  // ── FP1440 Endereço ───────────────────────────────────────────────────────
  if (isBlank(form.cep))        errors.push({ field: "cep",        label: "CEP",       stepIndex: STEP_INDEX.endereco, message: "Informe o CEP." });
  if (isBlank(form.logradouro)) errors.push({ field: "logradouro", label: "Endereço",  stepIndex: STEP_INDEX.endereco, message: "Informe o logradouro." });
  if (isBlank(form.bairro))     errors.push({ field: "bairro",     label: "Bairro",    stepIndex: STEP_INDEX.endereco, message: "Informe o bairro." });
  if (isBlank(form.cidade))     errors.push({ field: "cidade",     label: "Cidade",    stepIndex: STEP_INDEX.endereco, message: "Informe a cidade." });
  if (isBlank(form.uf))         errors.push({ field: "uf",         label: "UF",        stepIndex: STEP_INDEX.endereco, message: "Selecione a UF." });
  if (!form.municipioEnderecoIbge || form.municipioEnderecoIbge === 0) errors.push({ field: "municipioEnderecoIbge", label: "Município (cód. IBGE)", stepIndex: STEP_INDEX.endereco, message: "Informe o código IBGE do município." });

  // ── FP1500 Cadastral / TOTVS ──────────────────────────────────────────────
  if (isBlank(form.dataAdmissao))           errors.push({ field: "dataAdmissao",          label: "Data de Admissão",       stepIndex: STEP_INDEX.trabalhista, message: "Informe a data de admissão." });
  if (isBlank(form.salario))                errors.push({ field: "salario",               label: "Salário",                stepIndex: STEP_INDEX.trabalhista, message: "Informe o salário." });
  if (isBlank(form.codCargoTotvs))          errors.push({ field: "codCargoTotvs",         label: "Cargo TOTVS",            stepIndex: STEP_INDEX.trabalhista, message: "Selecione o cargo TOTVS." });
  if (isBlank(form.codVinculoEmpregaticio)) errors.push({ field: "codVinculoEmpregaticio",label: "Vínculo Empregatício",   stepIndex: STEP_INDEX.trabalhista, message: "Selecione o vínculo empregatício." });
  if (isBlank(form.tipoFuncionario))        errors.push({ field: "tipoFuncionario",        label: "Tipo Funcionário",       stepIndex: STEP_INDEX.trabalhista, message: "Selecione o tipo de funcionário." });
  if (!form.categoriaSalarial || form.categoriaSalarial === 0) errors.push({ field: "categoriaSalarial", label: "Categoria Salarial", stepIndex: STEP_INDEX.trabalhista, message: "Selecione a categoria salarial." });
  if (!form.grauInstrucao || form.grauInstrucao === 0)         errors.push({ field: "grauInstrucao",     label: "Grau de Instrução",  stepIndex: STEP_INDEX.trabalhista, message: "Selecione o grau de instrução." });
  if (isBlank(form.cargaHorariaSemanal))    errors.push({ field: "cargaHorariaSemanal",   label: "Carga Horária Semanal",  stepIndex: STEP_INDEX.trabalhista, message: "Informe a carga horária semanal." });
  if (isBlank(form.emitCartPonto))          errors.push({ field: "emitCartPonto",         label: "Emite Cartão Ponto",     stepIndex: STEP_INDEX.trabalhista, message: "Selecione a opção de cartão ponto." });
  if (!form.tipoEstatistica || form.tipoEstatistica === 0) errors.push({ field: "tipoEstatistica", label: "Tipo Estatística", stepIndex: STEP_INDEX.trabalhista, message: "Selecione o tipo estatística." });

  // ── Jornada, Ponto e Sindicato (TOTVS) ───────────────────────────────────
  if (isBlank(form.codTurma))                   errors.push({ field: "codTurma",                   label: "Cód. Turma",                       stepIndex: STEP_INDEX.trabalhista, message: "Informe o código da turma." });
  if (isBlank(form.indFuncVinculado))            errors.push({ field: "indFuncVinculado",            label: "Ind. Func. Vinculado",              stepIndex: STEP_INDEX.trabalhista, message: "Informe o indicador de funcionário vinculado." });
  if (isBlank(form.tipoMaoDeObra))               errors.push({ field: "tipoMaoDeObra",               label: "Tipo Mão-de-Obra",                  stepIndex: STEP_INDEX.trabalhista, message: "Selecione o tipo de mão-de-obra." });
  if (isBlank(form.codSindicato))                errors.push({ field: "codSindicato",                label: "Cód. Sindicato",                    stepIndex: STEP_INDEX.trabalhista, message: "Informe o código do sindicato." });
  if (isBlank(form.codLocalMarcacao))            errors.push({ field: "codLocalMarcacao",            label: "Cód. Local Marcação",               stepIndex: STEP_INDEX.trabalhista, message: "Informe o código do local de marcação." });
  if (isBlank(form.codClassFuncPontoEletronico)) errors.push({ field: "codClassFuncPontoEletronico", label: "Classif. Func. Ponto Eletrônico",   stepIndex: STEP_INDEX.trabalhista, message: "Informe a classificação funcional do ponto eletrônico." });
  if (isBlank(form.codLocalidade))               errors.push({ field: "codLocalidade",               label: "Cód. Localidade",                   stepIndex: STEP_INDEX.trabalhista, message: "Informe o código da localidade." });

  // ── Novos campos TOTVS obrigatórios (iFormaPagto, iTipoAdmissFGTS, cPaisLocalidade) ──
  if (!form.formaPagamento || form.formaPagamento === 0)   errors.push({ field: "formaPagamento",   label: "Forma de Pagamento",  stepIndex: STEP_INDEX.trabalhista, message: "Selecione a forma de pagamento." });
  if (!form.tipoAdmissaoFgts || form.tipoAdmissaoFgts === 0) errors.push({ field: "tipoAdmissaoFgts", label: "Tipo Admissão FGTS", stepIndex: STEP_INDEX.trabalhista, message: "Selecione o tipo de admissão do FGTS." });
  if (isIso3Invalid(form.paisLocalidade))                  errors.push({ field: "paisLocalidade",   label: "País Localidade",    stepIndex: STEP_INDEX.trabalhista, message: "Use código ISO de 3 letras (ex: BRA)." });

  // ── Doc Militar / Visto Estrangeiro / CAGED — obrigatórios sempre (TOTVS rejeita < 1) ──
  // Datasul devolve "iDocMilitarTipo nao pode ser menor que 1" mesmo para mulheres/maiores
  // de 45 anos, e "iTipoVistoEstrang" mesmo para brasileiros. Por isso exigimos sempre ≥ 1.
  if (!form.docMilitarTipo || form.docMilitarTipo < 1)             errors.push({ field: "docMilitarTipo",         label: "Tipo Doc. Militar",        stepIndex: STEP_INDEX.trabalhista, message: "Selecione o tipo de documento militar (TOTVS exige ≥ 1)." });
  if (!form.docMilitarRegiao || form.docMilitarRegiao < 1)          errors.push({ field: "docMilitarRegiao",       label: "Região Militar",           stepIndex: STEP_INDEX.trabalhista, message: "Informe a Região Militar (TOTVS exige ≥ 1)." });
  if (!form.docMilitarCircunscricao || form.docMilitarCircunscricao < 1) errors.push({ field: "docMilitarCircunscricao", label: "Circunscrição Militar",    stepIndex: STEP_INDEX.trabalhista, message: "Informe a Circunscrição Militar (TOTVS exige ≥ 1)." });
  if (!form.tipoVistoEstrangeiro || form.tipoVistoEstrangeiro < 1)  errors.push({ field: "tipoVistoEstrangeiro",    label: "Tipo Visto Estrangeiro",   stepIndex: STEP_INDEX.trabalhista, message: "Selecione o tipo de visto estrangeiro (TOTVS exige ≥ 1, use 1 para brasileiros)." });
  if (!form.ocorrenciaCAGED || form.ocorrenciaCAGED < 1)            errors.push({ field: "ocorrenciaCAGED",         label: "Ocorrência CAGED",         stepIndex: STEP_INDEX.trabalhista, message: "Selecione a ocorrência CAGED (TOTVS exige ≥ 1, use 1 para admissão normal)." });

  // ── Conjunto RG: se algum preenchido, todos obrigatórios ─────────────────
  const rgAny = !isBlank(form.rg) || !isBlank(form.rgOrgaoExpedidor) || !isBlank(form.rgUfExpedidor);
  if (rgAny) {
    if (isBlank(form.rg))                errors.push({ field: "rg",                label: "RG",                        stepIndex: STEP_INDEX.pessoal, message: "RG obrigatório quando Órgão/UF foi informado." });
    if (isBlank(form.rgOrgaoExpedidor))  errors.push({ field: "rgOrgaoExpedidor",  label: "Órgão Expedidor RG",        stepIndex: STEP_INDEX.pessoal, message: "Órgão Expedidor obrigatório quando RG/UF foi informado." });
    if (isBlank(form.rgUfExpedidor))     errors.push({ field: "rgUfExpedidor",     label: "UF Expedidor RG",           stepIndex: STEP_INDEX.pessoal, message: "UF obrigatória quando RG/Órgão foi informado." });
  }

  // ── Condicional: Estrangeiro (origemFuncionario === 3) ───────────────────
  if (form.origemFuncionario === 3) {
    const hasPassaporte = !isBlank(form.passaporte);
    const hasRnm = !isBlank(form.rnmRne);
    if (!hasPassaporte && !hasRnm) {
      errors.push({ field: "passaporte", label: "Passaporte ou RNM/RNE", stepIndex: STEP_INDEX.pessoal, message: "Para estrangeiros, informe Passaporte ou RNM/RNE." });
    }
    if (isBlank(form.validadeVisto))            errors.push({ field: "validadeVisto",        label: "Validade do Visto",      stepIndex: STEP_INDEX.pessoal, message: "Validade do visto obrigatória para estrangeiros." });
  }

  // ── Condicional: Naturalizado (origemFuncionario === 2) ──────────────────
  if (form.origemFuncionario === 2) {
    if (isBlank(form.portariaNaturalizacao))    errors.push({ field: "portariaNaturalizacao", label: "Portaria de Naturalização", stepIndex: STEP_INDEX.pessoal, message: "Portaria de naturalização obrigatória para naturalizados." });
    if (isBlank(form.naturalizacao))            errors.push({ field: "naturalizacao",         label: "Data/Info Naturalização",   stepIndex: STEP_INDEX.pessoal, message: "Dados da naturalização obrigatórios para naturalizados." });
  }

  // ── Condicional: CLT Prazo Determinado (codVinculoEmpregaticio === 20) ───
  if (form.codVinculoEmpregaticio === 20 && isBlank(form.dataTerminoContrato)) {
    errors.push({ field: "dataTerminoContrato", label: "Data Término Contrato", stepIndex: STEP_INDEX.trabalhista, message: "Data de término obrigatória para CLT Prazo Determinado." });
  }

  // Regra existente: se salário fora da faixa, justificativa obrigatória.
  if (form.validacaoSalarioOk === false && isBlank(form.validacaoSalarioJustificativa)) {
    errors.push({
      field: "validacaoSalarioJustificativa",
      label: "Justificativa do Salário",
      stepIndex: STEP_INDEX.trabalhista,
      message: "O salário está fora da faixa do cargo — informe uma justificativa.",
    });
  }

  return errors;
}

/** Retorna o menor stepIndex presente na lista de erros (ou null se não há erros). */
export function firstErrorStep(errors: ValidationError[]): number | null {
  if (errors.length === 0) return null;
  return errors.reduce((min, e) => Math.min(min, e.stepIndex), Number.POSITIVE_INFINITY);
}
