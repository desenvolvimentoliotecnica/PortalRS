/** Normaliza status da pré-admissão (API serializa enum como string ou número). */
export type PreAdmissaoStatusValue = number | string;

const STATUS_TO_CODE: Record<string, number> = {
  Rascunho: 0,
  Enviado: 1,
  Preenchido: 2,
  Aprovada: 3,
  Rejeitada: 4,
  Integrada: 5,
  Acessado: 6,
  PreenchidoParcial: 7,
  EmIntegracao: 8,
  PreenchimentoPendente: 1,
};

export function preAdmissaoStatusCode(status: PreAdmissaoStatusValue): number {
  if (typeof status === "number") return status;
  return STATUS_TO_CODE[status] ?? -1;
}

export function isPreAdmissaoRascunhoOuEnviado(status: PreAdmissaoStatusValue): boolean {
  const c = preAdmissaoStatusCode(status);
  return c === 0 || c === 1;
}

export function isPreAdmissaoAguardandoCandidato(status: PreAdmissaoStatusValue): boolean {
  const c = preAdmissaoStatusCode(status);
  return c === 0 || c === 1 || c === 6 || c === 7;
}

export function isPreAdmissaoEmRevisao(status: PreAdmissaoStatusValue): boolean {
  return preAdmissaoStatusCode(status) === 2;
}

export function isPreAdmissaoAprovada(status: PreAdmissaoStatusValue): boolean {
  const c = preAdmissaoStatusCode(status);
  return c === 3 || c === 8;
}

export function isPreAdmissaoIntegrada(status: PreAdmissaoStatusValue): boolean {
  return preAdmissaoStatusCode(status) === 5;
}

export function isPreAdmissaoRejeitada(status: PreAdmissaoStatusValue): boolean {
  return preAdmissaoStatusCode(status) === 4;
}

export function canGerarLinkPreAdmissao(status: PreAdmissaoStatusValue): boolean {
  return isPreAdmissaoAguardandoCandidato(status);
}

export function canSolicitarDocumentosPreAdmissao(status: PreAdmissaoStatusValue): boolean {
  return isPreAdmissaoRascunhoOuEnviado(status);
}

export function canAprovarPreAdmissao(status: PreAdmissaoStatusValue): boolean {
  return isPreAdmissaoEmRevisao(status);
}

export function canRejeitarPreAdmissao(status: PreAdmissaoStatusValue): boolean {
  const c = preAdmissaoStatusCode(status);
  return c === 1 || c === 2;
}

export function canUploadManualPreAdmissao(status: PreAdmissaoStatusValue): boolean {
  const c = preAdmissaoStatusCode(status);
  return c === 1 || c === 2;
}

/** Fase do stepper visual (1–4). */
export function preAdmissaoTimelinePhase(status: PreAdmissaoStatusValue): number {
  const c = preAdmissaoStatusCode(status);
  if (c === 4) return -1;
  if (c <= 1 || c === 6 || c === 7) return 1;
  if (c === 2) return 2;
  if (c === 3 || c === 8) return 3;
  if (c === 5) return 4;
  return 1;
}

export const PRE_ADMISSAO_STATUS_DISPLAY: Record<number | string, string> = {
  0: "Rascunho",
  1: "Link enviado",
  2: "Em revisão",
  3: "Aprovada",
  4: "Rejeitada",
  5: "Integrada",
  6: "Candidato acessou",
  7: "Preenchimento parcial",
  8: "Em integração TOTVS",
  Rascunho: "Rascunho",
  Enviado: "Link enviado",
  Preenchido: "Em revisão",
  Aprovada: "Aprovada",
  Rejeitada: "Rejeitada",
  Integrada: "Integrada",
  Acessado: "Candidato acessou",
  PreenchidoParcial: "Preenchimento parcial",
  EmIntegracao: "Em integração TOTVS",
  PreenchimentoPendente: "Link enviado",
};

export function preAdmissaoStatusLabel(status: PreAdmissaoStatusValue): string {
  return PRE_ADMISSAO_STATUS_DISPLAY[status] ?? PRE_ADMISSAO_STATUS_DISPLAY[preAdmissaoStatusCode(status)] ?? String(status);
}
