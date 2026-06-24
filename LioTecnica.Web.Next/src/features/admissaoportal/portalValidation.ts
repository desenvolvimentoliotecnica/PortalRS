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

import { TIPOS_COM_VERSO } from "./constants";
import type { UploadedDoc } from "./useAdmissaoWizardStore";

export interface DocSolicitadoForValidation {
  tipo: number;
  label: string;
  obrigatorio: boolean;
}

export interface DocEnviadoForValidation {
  tipo: number;
  lado: number;
}

function hasDocFrente(
  tipo: number,
  uploadedDocs: Map<number, UploadedDoc>,
  enviados: DocEnviadoForValidation[],
): boolean {
  if (uploadedDocs.has(tipo)) return true;
  return enviados.some((d) => d.tipo === tipo && d.lado !== 2);
}

function hasDocVerso(
  tipo: number,
  uploadedDocsVerso: Map<number, UploadedDoc>,
  enviados: DocEnviadoForValidation[],
): boolean {
  if (uploadedDocsVerso.has(tipo)) return true;
  return enviados.some((d) => d.tipo === tipo && d.lado === 2);
}

/** Documentos obrigatórios ainda pendentes (frente e verso quando aplicável). */
export function validateRequiredDocuments(
  solicitados: DocSolicitadoForValidation[],
  uploadedDocs: Map<number, UploadedDoc>,
  uploadedDocsVerso: Map<number, UploadedDoc>,
  enviados: DocEnviadoForValidation[] = [],
): string[] {
  const missing: string[] = [];

  for (const ds of solicitados) {
    if (!ds.obrigatorio) continue;

    if (!hasDocFrente(ds.tipo, uploadedDocs, enviados)) {
      missing.push(ds.label);
      continue;
    }

    if (TIPOS_COM_VERSO.has(ds.tipo) && !hasDocVerso(ds.tipo, uploadedDocsVerso, enviados)) {
      missing.push(`${ds.label} (verso)`);
    }
  }

  return missing;
}

export function validateDependentsStep(
  hasDependentes: boolean | null,
  dependentesCount: number,
): string | null {
  if (hasDependentes === null) {
    return "Informe se você tem dependentes antes de continuar.";
  }
  if (hasDependentes && dependentesCount === 0) {
    return "Adicione pelo menos um dependente ou marque que não possui dependentes.";
  }
  return null;
}

export function formatPortalValidationMessage(errors: PortalValidationError[], maxLabels = 5): string {
  if (errors.length === 0) return "";
  const labels = errors.slice(0, maxLabels).map((e) => e.label);
  const suffix = errors.length > maxLabels ? ` e mais ${errors.length - maxLabels}` : "";
  return `Preencha os campos obrigatórios: ${labels.join(", ")}${suffix}.`;
}

export function formatMissingDocumentsMessage(missing: string[], maxLabels = 4): string {
  if (missing.length === 0) return "";
  const labels = missing.slice(0, maxLabels);
  const suffix = missing.length > maxLabels ? ` e mais ${missing.length - maxLabels}` : "";
  return `Envie os documentos obrigatórios pendentes: ${labels.join(", ")}${suffix}.`;
}

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
