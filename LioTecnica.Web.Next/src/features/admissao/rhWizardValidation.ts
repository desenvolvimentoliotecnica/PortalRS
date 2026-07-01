/** Validação simplificada do wizard RH (3 etapas — sem TOTVS). */

export interface RhValidationError {
  field: string;
  label: string;
  stepIndex: number;
  message: string;
}

export const RH_STEP_INDEX = {
  contratual: 0,
  documentos: 1,
  revisao: 2,
} as const;

export interface RhContratualFormLike {
  dataAdmissao?: string | null;
  salario?: number | null;
  tipoContratacao?: number | null;
  email?: string | null;
  celular?: string | null;
  telefone?: string | null;
}

function isBlank(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

export function validateRhContratual(form: RhContratualFormLike): RhValidationError[] {
  const errors: RhValidationError[] = [];

  if (isBlank(form.dataAdmissao))
    errors.push({ field: "dataAdmissao", label: "Data de admissão", stepIndex: RH_STEP_INDEX.contratual, message: "Informe a data de admissão." });

  if (form.salario == null || form.salario <= 0)
    errors.push({ field: "salario", label: "Salário", stepIndex: RH_STEP_INDEX.contratual, message: "Informe o salário oferecido." });

  if (form.tipoContratacao == null)
    errors.push({ field: "tipoContratacao", label: "Tipo de contratação", stepIndex: RH_STEP_INDEX.contratual, message: "Selecione o tipo de contratação." });

  if (isBlank(form.email) && isBlank(form.celular) && isBlank(form.telefone))
    errors.push({ field: "email", label: "Contato", stepIndex: RH_STEP_INDEX.contratual, message: "Informe e-mail ou celular para enviar o link ao candidato." });

  return errors;
}

export function firstRhErrorStep(errors: RhValidationError[]): number | null {
  if (errors.length === 0) return null;
  return errors.reduce((min, e) => Math.min(min, e.stepIndex), Number.POSITIVE_INFINITY);
}
