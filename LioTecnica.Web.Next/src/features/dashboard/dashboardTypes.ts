import type React from "react";

export type Kpis = {
  openVagas: number;
  cvsHoje: number;
  pendentesMatch: number;
  aprovados7Dias: number;
  vagasForaSla: number;
};

export type Funil = {
  recebidos: number;
  triagem: number;
  entrevista: number;
  aprovados: number;
};

export type Series = { labels: string[]; values: number[] };

export type TopMatchRow = {
  vagaId: string;
  vagaCodigo: string;
  vagaTitulo: string;
  candidatoId: string;
  candidatoNome: string;
  origem: string;
  matchScore: number;
  etapa: string;
};

export type PendingItem = {
  id: string;
  tipo: string;
  titulo: string;
  solicitante: string;
  data: string;
  icon: React.ElementType;
  color: string;
  href: string;
};

// ── SLA ──────────────────────────────────────────────
export type SlaStatus = "no_prazo" | "critica" | "atrasada";

export type SlaKpis = {
  total: number;
  noPrazo: number;
  critica: number;
  atrasada: number;
};

export type SlaVagaItem = {
  id: string;
  titulo: string;
  status: string;
  prioridade: string;
  diasAberto: number;
  metaDias: number;
  percentualConsumido: number;
  slaStatus: SlaStatus;
};

export type SlaData = {
  kpis: SlaKpis;
  vagas: SlaVagaItem[];
};

// ── Próximas Ações ────────────────────────────────────
export type UpcomingAction = {
  id: string;
  type: string;
  description: string;
  dueAtUtc: string;
};

export type RecentActivity = {
  id: string;
  type: string;
  description: string;
  createdAtUtc: string;
};

// ── Humor da Equipe ───────────────────────────────────
export type MoodValue = "very_bad" | "bad" | "neutral" | "good" | "great";

export type MoodDistribution = {
  mood: string;
  count: number;
  percentage: number;
};

export type MoodStats = {
  averageMood: string;
  totalResponses: number;
  distribution: MoodDistribution[];
};

export type MoodEntry = {
  id: string;
  userId: string;
  fullName: string;
  mood: string;
  createdAtUtc: string;
};

// ── PDI ───────────────────────────────────────────────
export type PdiStatus = "in_progress" | "completed" | "overdue" | "pending";

export type PdiItem = {
  id: string;
  title: string;
  responsibleName: string;
  status: string;
  dueDate: string;
  progress: number;
};

// ── Leaderboard ───────────────────────────────────────
export type LeaderboardEntry = {
  userId: string;
  fullName: string;
  balance: number;
  rank: number;
};

export type MyBalance = {
  userId: string;
  balance: number;
};

// ── Meu Time ──────────────────────────────────────────
export type MeuTimeMembro = {
  id: string;
  nome: string;
  cargo: string;
  area: string;
  status: string;
  tipo: "direto" | "indireto";
};

export type MeuTimeData = {
  membros: MeuTimeMembro[];
  totalDiretos: number;
  totalIndiretos: number;
};

// ── Inbox Feed (SignalR) ───────────────────────────────
export type InboxStatus = "novo" | "processando" | "processado" | "falha" | "descartado";
export type InboxOrigem = "email" | "pasta" | "upload";

export type InboxFeedItem = {
  id: string;
  origem: InboxOrigem;
  status: InboxStatus;
  recebidoEm: string | null;
  remetente: string | null;
  assunto: string | null;
  processamento: {
    pct: number | null;
    etapa: string | null;
    ultimoErro: string | null;
  } | null;
};
