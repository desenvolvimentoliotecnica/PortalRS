"use client";

import { apiFetch, apiJson } from "@/lib/api";

export type EtapaMacroCandidatura =
  | "Aplicada"
  | "EmTriagem"
  | "Entrevista"
  | "EntrevistaTecnica"
  | "Teste"
  | "Proposta"
  | "Contratado"
  | "ReprovadoRh"
  | "ReprovadoGestor"
  | "Recusado"
  | "Desistiu";

/** Rótulos exibidos no Kanban de Candidaturas (funil Key User). */
export const ETAPA_KANBAN_LABELS: Record<EtapaMacroCandidatura, string> = {
  Aplicada: "Candidatura",
  EmTriagem: "Triagem",
  Entrevista: "Entrevista RH",
  EntrevistaTecnica: "Entrevista Técnica/Gestão",
  Teste: "Testes",
  Proposta: "Envio da Proposta",
  Contratado: "Aprovado",
  ReprovadoRh: "Reprovado RH",
  ReprovadoGestor: "Reprovado Gestão",
  Recusado: "Declinado",
  Desistiu: "Declinado",
};

/** Coluna do kanban que agrupa candidatos declinados (legado Recusado + Desistiu). */
export const KANBAN_COLUNA_DECLINADO: EtapaMacroCandidatura = "Desistiu";

export const ETAPAS_DECLINADO: readonly EtapaMacroCandidatura[] = ["Recusado", "Desistiu"];

/** Ordem das colunas no Kanban (10 colunas). */
export const ETAPAS_KANBAN: EtapaMacroCandidatura[] = [
  "Aplicada",
  "EmTriagem",
  "Entrevista",
  "EntrevistaTecnica",
  "Teste",
  "Proposta",
  "Contratado",
  "ReprovadoRh",
  "ReprovadoGestor",
  KANBAN_COLUNA_DECLINADO,
];

export function labelEtapaKanban(etapa: EtapaMacroCandidatura): string {
  return ETAPA_KANBAN_LABELS[etapa] ?? etapa;
}

export function isEtapaDeclinado(etapa: EtapaMacroCandidatura): boolean {
  return ETAPAS_DECLINADO.includes(etapa);
}

const ETAPA_BY_INDEX: Record<number, EtapaMacroCandidatura> = {
  0: "Aplicada",
  1: "EmTriagem",
  2: "Entrevista",
  3: "Teste",
  4: "Proposta",
  5: "Contratado",
  6: "Recusado",
  7: "Desistiu",
  8: "EntrevistaTecnica",
  9: "ReprovadoRh",
  10: "ReprovadoGestor",
};

export function resolveEtapa(v: number | string): EtapaMacroCandidatura {
  if (typeof v === "number") return ETAPA_BY_INDEX[v] ?? "Aplicada";
  return (v as EtapaMacroCandidatura) ?? "Aplicada";
}

export type CandidaturaStatus =
  | "Ativa"
  | "Congelada"
  | "Arquivada"
  | "Contratado"
  | "Reprovado"
  | "Desistiu";

const STATUS_BY_INDEX: CandidaturaStatus[] = [
  "Ativa",
  "Congelada",
  "Arquivada",
  "Contratado",
  "Reprovado",
  "Desistiu",
];

export function resolveCandidaturaStatus(v: number | string): CandidaturaStatus {
  if (typeof v === "number") return STATUS_BY_INDEX[v] ?? "Ativa";
  return (v as CandidaturaStatus) ?? "Ativa";
}

export type CandidaturaHistoricoItem = {
  etapaAnterior: number | EtapaMacroCandidatura;
  etapaNova: number | EtapaMacroCandidatura;
  emUtc: string;
  observacao: string | null;
};

export type CandidaturaDetalhe = {
  id: string;
  candidatoId: string;
  vagaId: string;
  vagaCodigo: string | null;
  vagaTitulo: string | null;
  vagaLocal: string | null;
  status: number | CandidaturaStatus;
  etapaMacro: number | EtapaMacroCandidatura;
  aplicadaEmUtc: string;
  etapaAtualDesdeUtc: string | null;
  updatedAtUtc: string;
  historico: CandidaturaHistoricoItem[];
};

export type SlaSemaforo = "verde" | "amarelo" | "vermelho";

// ── Sessão 31.8 (FASE 3.A) — Funil de conversão ──
export type FunilEtapaItem = {
  etapa: number | EtapaMacroCandidatura;
  titulo: string;
  total: number;
  taxaConversaoPercent: number | null;
};

export type FunilCandidaturasResponse = {
  totalGeral: number;
  vagaId: string | null;
  vagaTitulo: string | null;
  periodoInicioUtc: string | null;
  periodoFimUtc: string | null;
  etapas: FunilEtapaItem[];
};

export async function getFunil(params: { vagaId?: string | null; inicioUtc?: string | null; fimUtc?: string | null }) {
  const qs = new URLSearchParams();
  if (params.vagaId) qs.set("vagaId", params.vagaId);
  if (params.inicioUtc) qs.set("inicioUtc", params.inicioUtc);
  if (params.fimUtc) qs.set("fimUtc", params.fimUtc);
  const url = `/api/candidaturas/funil${qs.toString() ? `?${qs}` : ""}`;
  const data = await apiJson<FunilCandidaturasResponse>(url);
  return data;
}

// ── Sessão 31.8 (FASE 3.B) — Bulk avançar etapa ──
export type BulkAvancarEtapaItemResult = {
  candidaturaId: string;
  sucesso: boolean;
  candidatoNome: string | null;
  erro: string | null;
};

export type BulkAvancarEtapaResponse = {
  total: number;
  sucesso: number;
  falha: number;
  itens: BulkAvancarEtapaItemResult[];
};

export async function bulkAvancarEtapa(candidaturaIds: string[], novaEtapa: EtapaMacroCandidatura, observacao?: string) {
  return await apiJson<BulkAvancarEtapaResponse>("/api/candidaturas/bulk-avancar-etapa", {
    method: "POST",
    body: JSON.stringify({ candidaturaIds, novaEtapa, observacao: observacao ?? null }),
  });
}

export type KanbanCandidaturaItem = {
  id: string;
  candidatoId: string;
  candidatoNome: string;
  candidatoEmail: string | null;
  candidatoFone: string | null;
  candidatoCelular: string | null;
  candidatoAvatarUrl: string | null;
  vagaId: string;
  vagaCodigo: string | null;
  vagaTitulo: string | null;
  status: number | CandidaturaStatus;
  etapaMacro: number | EtapaMacroCandidatura;
  aplicadaEmUtc: string;
  etapaAtualDesdeUtc: string | null;
  matchScore: number | null;
  // Sessão 31.8 — SLA semáforo
  diasNaEtapa: number;
  slaDiasEtapa: number;
  slaSemaforo: SlaSemaforo;
};

export type KanbanColunaResponse = {
  etapa: number | EtapaMacroCandidatura;
  titulo: string;
  total: number;
  itens: KanbanCandidaturaItem[];
};

export type KanbanCandidaturasResponse = {
  colunas: KanbanColunaResponse[];
  total: number;
};

export type KanbanVagaFiltroItem = {
  id: string;
  titulo: string | null;
  codigo: string | null;
  totalCandidaturas: number;
};

export function getKanban(vagaId?: string | null) {
  const qs = vagaId ? `?vagaId=${encodeURIComponent(vagaId)}` : "";
  return apiJson<KanbanCandidaturasResponse>(`/api/candidaturas/kanban${qs}`);
}

export function getKanbanVagas() {
  return apiJson<KanbanVagaFiltroItem[]>("/api/candidaturas/kanban/vagas");
}

export type AvancarEtapaResponse = {
  candidatura: CandidaturaDetalhe;
  entrevista?: {
    agendaEventId: string;
    onlineMeetingJoinUrl?: string | null;
  } | null;
};

export async function avancarEtapa(
  candidaturaId: string,
  novaEtapa: EtapaMacroCandidatura,
  observacao?: string | null,
  entrevista?: AgendarEntrevistaCandidaturaRequest | null,
): Promise<AvancarEtapaResponse> {
  const res = await apiFetch(`/api/candidaturas/${candidaturaId}/avancar-etapa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ novaEtapa, observacao: observacao ?? null, entrevista: entrevista ?? null }),
  });
  if (!res.ok) {
    let msg = "Falha ao avançar etapa.";
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) msg = body.message;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<AvancarEtapaResponse>;
}

export type EntrevistaParticipanteRequest = {
  funcionarioId?: string | null;
  userId?: string | null;
  nome: string;
  email?: string | null;
  origem?: "funcionario" | "usuario" | null;
};

export type AgendarEntrevistaCandidaturaRequest = {
  inicioUtc: string;
  duracaoMinutos: number;
  formato: "Presencial" | "Online";
  responsavel: string;
  participantesOpcionais?: string[] | null;
  participantes?: EntrevistaParticipanteRequest[] | null;
  local?: string | null;
  observacao?: string | null;
};

export function listarCandidaturasDoCandidato(candidatoId: string) {
  return apiJson<CandidaturaDetalhe[]>(`/api/candidaturas/candidato/${encodeURIComponent(candidatoId)}`);
}

export async function registrarObservacaoCandidatura(candidaturaId: string, observacao: string) {
  const res = await apiFetch(`/api/candidaturas/${encodeURIComponent(candidaturaId)}/observacoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ observacao }),
  });
  if (!res.ok) {
    let msg = "Falha ao registrar observação.";
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) msg = body.message;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json() as Promise<CandidaturaDetalhe>;
}

// ── Auditoria de logs de notificação ─────────────────────────────────────────

export type CanalNotificacao = "Email" | "WhatsApp";
const CANAL_BY_INDEX: CanalNotificacao[] = ["Email", "WhatsApp"];
export function resolveCanal(v: number | string): CanalNotificacao {
  if (typeof v === "number") return CANAL_BY_INDEX[v] ?? "Email";
  return (v as CanalNotificacao) ?? "Email";
}

export type NotificacaoStatus =
  | "Enviado"
  | "Falhou"
  | "IgnoradoSemDestino"
  | "IgnoradoSemOptIn";
const STATUS_NOTIFICACAO_BY_INDEX: NotificacaoStatus[] = [
  "Enviado",
  "Falhou",
  "IgnoradoSemDestino",
  "IgnoradoSemOptIn",
];
export function resolveStatusNotificacao(v: number | string): NotificacaoStatus {
  if (typeof v === "number") return STATUS_NOTIFICACAO_BY_INDEX[v] ?? "Enviado";
  return (v as NotificacaoStatus) ?? "Enviado";
}

export type NotificacaoCandidaturaLogItem = {
  id: string;
  candidaturaId: string;
  candidatoId: string;
  candidatoNome: string | null;
  candidatoEmail: string | null;
  candidatoFone: string | null;
  vagaId: string | null;
  vagaCodigo: string | null;
  vagaTitulo: string | null;
  etapaMacro: number | EtapaMacroCandidatura;
  canal: number | CanalNotificacao;
  status: number | NotificacaoStatus;
  destino: string | null;
  mensagem: string | null;
  erroMensagem: string | null;
  criadoEmUtc: string;
};

export type NotificacaoCandidaturaLogsResponse = {
  items: NotificacaoCandidaturaLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type NotificacaoLogsFilter = {
  candidatoId?: string | null;
  candidaturaId?: string | null;
  canal?: CanalNotificacao | null;
  status?: NotificacaoStatus | null;
  etapa?: EtapaMacroCandidatura | null;
  dataInicioUtc?: string | null;
  dataFimUtc?: string | null;
  page?: number;
  pageSize?: number;
};

export function listarNotificacoesCandidaturaLogs(filter: NotificacaoLogsFilter = {}) {
  const params = new URLSearchParams();
  if (filter.candidatoId) params.set("candidatoId", filter.candidatoId);
  if (filter.candidaturaId) params.set("candidaturaId", filter.candidaturaId);
  if (filter.canal) params.set("canal", filter.canal);
  if (filter.status) params.set("status", filter.status);
  if (filter.etapa) params.set("etapa", filter.etapa);
  if (filter.dataInicioUtc) params.set("dataInicioUtc", filter.dataInicioUtc);
  if (filter.dataFimUtc) params.set("dataFimUtc", filter.dataFimUtc);
  if (filter.page && filter.page > 0) params.set("page", String(filter.page));
  if (filter.pageSize && filter.pageSize > 0) params.set("pageSize", String(filter.pageSize));
  const qs = params.toString();
  return apiJson<NotificacaoCandidaturaLogsResponse>(
    `/api/notificacoes-candidatura/logs${qs ? `?${qs}` : ""}`,
  );
}

// ── Templates editáveis (etapa × canal) ──────────────────────────────────────

export type NotificacaoTemplateItem = {
  etapa: number | EtapaMacroCandidatura;
  canal: number | CanalNotificacao;
  assunto: string | null;
  corpo: string;
  usaDefault: boolean;
  atualizadoEmUtc: string | null;
};

export type NotificacaoTemplateSaveRequest = {
  etapa: EtapaMacroCandidatura;
  canal: CanalNotificacao;
  assunto: string | null;
  corpo: string;
};

export function listarNotificacoesTemplates() {
  return apiJson<NotificacaoTemplateItem[]>(`/api/notificacoes-templates`);
}

export async function salvarNotificacaoTemplate(req: NotificacaoTemplateSaveRequest) {
  const res = await apiFetch(`/api/notificacoes-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    let msg = "Falha ao salvar template.";
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) msg = body.message;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return (await res.json()) as NotificacaoTemplateItem;
}

export async function restaurarNotificacaoTemplateDefault(
  etapa: EtapaMacroCandidatura,
  canal: CanalNotificacao,
) {
  const res = await apiFetch(
    `/api/notificacoes-templates/${encodeURIComponent(etapa)}/${encodeURIComponent(canal)}`,
    { method: "DELETE" },
  );
  if (!res.ok && res.status !== 204) {
    throw new Error("Falha ao restaurar template padrão.");
  }
}
