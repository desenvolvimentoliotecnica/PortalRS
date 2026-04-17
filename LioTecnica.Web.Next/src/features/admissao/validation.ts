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
  nome?: string | null;
  cpf?: string | null;
  dataNascimento?: string | null;
  sexo?: number | null;
  cep?: string | null;
  logradouro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  dataAdmissao?: string | null;
  salario?: number | null;
  tipoContratacao?: number | null;
  cargaHorariaSemanal?: number | null;
  codCargoTotvs?: number | null;
  codVinculoEmpregaticio?: number | null;
  tipoFuncionario?: number | null;
  tipoEstatistica?: number | null;
  estabelecimentoCodigo?: string | null;
  centroCusto?: string | null;
  unidadeLotacao?: string | null;
  pisPasep?: string | null;
  codTurma?: number | null;
  indFuncVinculado?: number | null;
  tipoMaoDeObra?: string | null;
  codSindicato?: number | null;
  codLocalMarcacao?: number | null;
  codClassFuncPontoEletronico?: number | null;
  codLocalidade?: number | null;
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

/** Valida o form completo. Retorna lista de erros (vazia = OK). */
export function validatePreAdmissao(form: PreAdmissaoFormLike): ValidationError[] {
  const errors: ValidationError[] = [];

  // Dados pessoais
  if (isBlank(form.nome)) errors.push({ field: "nome", label: "Nome Completo", stepIndex: STEP_INDEX.pessoal, message: "Informe o nome completo." });
  if (isBlank(form.cpf)) errors.push({ field: "cpf", label: "CPF", stepIndex: STEP_INDEX.pessoal, message: "Informe o CPF." });
  if (isBlank(form.dataNascimento)) errors.push({ field: "dataNascimento", label: "Data de Nascimento", stepIndex: STEP_INDEX.pessoal, message: "Informe a data de nascimento." });

  // Dados trabalhistas — os que o TOTVS já rejeita hoje quando ausentes.
  if (isBlank(form.dataAdmissao)) errors.push({ field: "dataAdmissao", label: "Data de Admissão", stepIndex: STEP_INDEX.trabalhista, message: "Informe a data de admissão." });
  if (isBlank(form.salario)) errors.push({ field: "salario", label: "Salário", stepIndex: STEP_INDEX.trabalhista, message: "Informe o salário." });
  if (isBlank(form.codCargoTotvs)) errors.push({ field: "codCargoTotvs", label: "Cargo TOTVS", stepIndex: STEP_INDEX.trabalhista, message: "Selecione o cargo TOTVS." });
  if (isBlank(form.codVinculoEmpregaticio)) errors.push({ field: "codVinculoEmpregaticio", label: "Vínculo Empregatício", stepIndex: STEP_INDEX.trabalhista, message: "Selecione o vínculo empregatício." });
  if (isBlank(form.tipoFuncionario)) errors.push({ field: "tipoFuncionario", label: "Tipo Funcionário", stepIndex: STEP_INDEX.trabalhista, message: "Selecione o tipo de funcionário." });
  if (isBlank(form.tipoEstatistica)) errors.push({ field: "tipoEstatistica", label: "Tipo Estatística", stepIndex: STEP_INDEX.trabalhista, message: "Selecione o tipo de estatística." });
  if (isBlank(form.cargaHorariaSemanal)) errors.push({ field: "cargaHorariaSemanal", label: "Carga Horária Semanal", stepIndex: STEP_INDEX.trabalhista, message: "Informe a carga horária semanal." });

  // Jornada, Ponto e Sindicato (TOTVS).
  if (isBlank(form.codTurma)) errors.push({ field: "codTurma", label: "Cód. Turma", stepIndex: STEP_INDEX.trabalhista, message: "Informe o código da turma." });
  if (isBlank(form.indFuncVinculado)) errors.push({ field: "indFuncVinculado", label: "Ind. Func. Vinculado", stepIndex: STEP_INDEX.trabalhista, message: "Informe o indicador de funcionário vinculado." });
  if (isBlank(form.tipoMaoDeObra)) errors.push({ field: "tipoMaoDeObra", label: "Tipo Mão-de-Obra", stepIndex: STEP_INDEX.trabalhista, message: "Selecione o tipo de mão-de-obra (Direta/Indireta)." });
  if (isBlank(form.codSindicato)) errors.push({ field: "codSindicato", label: "Cód. Sindicato", stepIndex: STEP_INDEX.trabalhista, message: "Informe o código do sindicato." });
  if (isBlank(form.codLocalMarcacao)) errors.push({ field: "codLocalMarcacao", label: "Cód. Local Marcação", stepIndex: STEP_INDEX.trabalhista, message: "Informe o código do local de marcação." });
  if (isBlank(form.codClassFuncPontoEletronico)) errors.push({ field: "codClassFuncPontoEletronico", label: "Classif. Func. Ponto Eletrônico", stepIndex: STEP_INDEX.trabalhista, message: "Informe a classificação funcional do ponto eletrônico." });
  if (isBlank(form.codLocalidade)) errors.push({ field: "codLocalidade", label: "Cód. Localidade", stepIndex: STEP_INDEX.trabalhista, message: "Informe o código da localidade." });

  // Regra existente (já no UI): se salário fora da faixa, justificativa obrigatória.
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
