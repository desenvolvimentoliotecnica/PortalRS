export type PortalSection = "pessoal" | "endereco" | "contato" | "bancario";

export interface PortalValidationError {
  field: string;
  label: string;
  section: PortalSection;
  sectionLabel: string;
}

export const SECTION_LABELS: Record<PortalSection, string> = {
  pessoal: "Dados Pessoais",
  endereco: "Endereço",
  contato: "Contato",
  bancario: "Dados Bancários",
};

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (typeof v === "number") return !Number.isFinite(v) || v === 0;
  return false;
}

const TEXT_FIELDS: [string, string, PortalSection][] = [
  ["nome",              "Nome Completo",                    "pessoal"],
  ["nomeAbreviado",     "Nome Abreviado",                   "pessoal"],
  ["rg",                "RG",                               "pessoal"],
  ["rgOrgaoExpedidor",  "Órgão Expedidor RG",               "pessoal"],
  ["rgUfExpedidor",     "UF Expedidor RG",                  "pessoal"],
  ["rgDataExpedicao",   "Data Emissão RG",                  "pessoal"],
  ["dataNascimento",    "Data de Nascimento",               "pessoal"],
  ["nacionalidade",     "Nacionalidade",                    "pessoal"],
  ["paisNacionalidade", "País da Nacionalidade",            "pessoal"],
  ["naturalCidade",     "Cidade de Nascimento",             "pessoal"],
  ["naturalUf",         "UF de Nascimento",                 "pessoal"],
  ["paisNascimento",    "País de Nascimento",               "pessoal"],
  ["nomeMae",           "Nome da Mãe",                      "pessoal"],
  ["cep",               "CEP",                              "endereco"],
  ["logradouro",        "Logradouro",                       "endereco"],
  ["numero",            "Número",                           "endereco"],
  ["bairro",            "Bairro",                           "endereco"],
  ["uf",                "UF",                               "endereco"],
  ["cidade",            "Cidade",                           "endereco"],
  ["email",             "E-mail",                           "contato"],
  ["celular",           "Celular",                          "contato"],
  ["bancoCodigo",       "Banco",                            "bancario"],
  ["agencia",           "Agência",                          "bancario"],
  ["conta",             "Conta",                            "bancario"],
];

// Enums base-1: valor 0 significa "não selecionado"
const INT_FIELDS_BASE1: [string, string, PortalSection][] = [
  ["sexo",              "Sexo",                             "pessoal"],
  ["estadoCivil",       "Estado Civil",                     "pessoal"],
  ["grauInstrucao",     "Escolaridade",                     "pessoal"],
  ["origemFuncionario", "Origem (Brasileiro/Naturalizado/Estrangeiro)", "pessoal"],
  ["cutis",             "Cutis",                            "pessoal"],
  ["cabelo",            "Cabelo",                           "pessoal"],
  ["olhos",             "Olhos",                            "pessoal"],
];

// Enums base-0: valor 0 é uma opção válida ("Conta Corrente" = 0)
const INT_FIELDS_BASE0: [string, string, PortalSection][] = [
  ["tipoConta",         "Tipo de Conta",                    "bancario"],
];

export function validatePortalForm(form: Record<string, unknown>): PortalValidationError[] {
  const errors: PortalValidationError[] = [];

  for (const [field, label, section] of TEXT_FIELDS) {
    if (isBlank(form[field])) {
      errors.push({ field, label, section, sectionLabel: SECTION_LABELS[section] });
    }
  }

  for (const [field, label, section] of INT_FIELDS_BASE1) {
    const v = form[field];
    if (v === null || v === undefined || v === 0 || v === "") {
      errors.push({ field, label, section, sectionLabel: SECTION_LABELS[section] });
    }
  }

  for (const [field, label, section] of INT_FIELDS_BASE0) {
    const v = form[field];
    if (v === null || v === undefined || v === "") {
      errors.push({ field, label, section, sectionLabel: SECTION_LABELS[section] });
    }
  }

  return errors;
}
