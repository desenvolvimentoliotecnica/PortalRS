/**
 * Validação centralizada do Wizard de Admissão — aplicada APENAS no submit
 * (clique em "Finalizar Admissão"), não nos passos intermediários.
 *
 * Campos obrigatórios para o processo de admissão (RH):
 * Nome completo, RG, CPF, Data de Nascimento, Cidade, UF, Nome dos Pais e PIS.
 * Demais campos TOTVS podem ser preenchidos depois, antes da aprovação/integração.
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
  nomeMae?: string | null;
  nomePai?: string | null;
  regIdentidCivilNumero?: string | null;
  regIdentidCivilUf?: string | null;
  regIdentidCivilCidade?: string | null;
  regIdentidCivilOrgEmiss?: string | null;
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
  codEmpresa?: string | null;
  estabelecimentoCodigo?: string | null;
  centroCusto?: string | null;
  unidadeLotacao?: string | null;
  pisPasep?: string | null;
  emitCartPonto?: string | null;
  codTurma?: number | null;
  indFuncVinculado?: number | null;
  tipoMaoDeObra?: string | null;
  codSindicato?: number | null;
  codLocalMarcacao?: number | null;
  codClassFuncPontoEletronico?: number | null;
  codLocalidade?: number | null;
  formaPagamento?: number | null;
  tipoAdmissaoFgts?: number | null;
  paisLocalidade?: string | null;
  docMilitarTipo?: number | null;
  docMilitarRegiao?: number | null;
  docMilitarCircunscricao?: number | null;
  ocorrenciaCAGED?: number | null;
  rg?: string | null;
  rgOrgaoExpedidor?: string | null;
  rgUfExpedidor?: string | null;
  passaporte?: string | null;
  rnmRne?: string | null;
  validadeVisto?: string | null;
  tipoVistoEstrangeiro?: number | null;
  portariaNaturalizacao?: string | null;
  naturalizacao?: string | null;
  resideExterior?: string | null;
  codEnderecoPostalExterior?: string | null;
  cidadeExterior?: string | null;
  dataTerminoContrato?: number | null;
  validacaoSalarioJustificativa?: string | null;
  validacaoSalarioOk?: boolean | null;
  optanteFgts?: string | null;
  recolheFgts?: string | null;
  recolheInss?: string | null;
  sindicalizado?: string | null;
  descContribSindical?: string | null;
  cargaAutomTurno?: string | null;
  calcula13?: string | null;
  recebeFerias?: string | null;
  considEmissRAIS?: string | null;
  recebePericul?: string | null;
  recebeInsalub?: string | null;
  recebeAdiantamento?: string | null;
  tipoLogradouroESocial?: string | null;
  categoriaTrabalhoESocial?: number | null;
  indAdmissao?: number | null;
  tipoAdmissaoESocial?: number | null;
  regimeTrabalhista?: number | null;
  regimePrevidenciario?: number | null;
  regimeJornada?: number | null;
  [key: string]: unknown;
}

/** Steps do wizard — mapeia índices para uso interno. */
export const STEP_INDEX = {
  pessoal: 0,
  endereco: 1,
  contato: 2,
  bancario: 3,
  trabalhista: 4,
  encargos: 5,
  documentos: 6,
  revisao: 7,
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

  if (isBlank(form.nome))
    errors.push({ field: "nome", label: "Nome Completo", stepIndex: STEP_INDEX.pessoal, message: "Informe o nome completo." });
  if (isBlank(form.rg))
    errors.push({ field: "rg", label: "RG", stepIndex: STEP_INDEX.pessoal, message: "Informe o RG." });
  if (isBlank(form.cpf))
    errors.push({ field: "cpf", label: "CPF", stepIndex: STEP_INDEX.pessoal, message: "Informe o CPF." });
  if (isBlank(form.dataNascimento))
    errors.push({ field: "dataNascimento", label: "Data de Nascimento", stepIndex: STEP_INDEX.pessoal, message: "Informe a data de nascimento." });
  if (isBlank(form.nomeMae))
    errors.push({ field: "nomeMae", label: "Nome da Mãe", stepIndex: STEP_INDEX.pessoal, message: "Informe o nome da mãe." });
  if (isBlank(form.nomePai))
    errors.push({ field: "nomePai", label: "Nome do Pai", stepIndex: STEP_INDEX.pessoal, message: "Informe o nome do pai." });
  if (isBlank(form.cidade))
    errors.push({ field: "cidade", label: "Cidade", stepIndex: STEP_INDEX.endereco, message: "Informe a cidade." });
  if (isBlank(form.uf))
    errors.push({ field: "uf", label: "UF", stepIndex: STEP_INDEX.endereco, message: "Selecione a UF." });
  if (isBlank(form.pisPasep))
    errors.push({ field: "pisPasep", label: "PIS/PASEP", stepIndex: STEP_INDEX.trabalhista, message: "Informe o PIS/PASEP." });

  return errors;
}

/** Retorna o menor stepIndex presente na lista de erros (ou null se não há erros). */
export function firstErrorStep(errors: ValidationError[]): number | null {
  if (errors.length === 0) return null;
  return errors.reduce((min, e) => Math.min(min, e.stepIndex), Number.POSITIVE_INFINITY);
}
