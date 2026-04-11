import type { LayoutItem, ResponsiveLayouts } from "react-grid-layout";

export type WidgetId =
  | "oQueFazer"
  | "kpis"
  | "resumo"
  | "funil"
  | "aprovacoes"
  | "topMatches"
  | "sla"
  | "proximasAcoes"
  | "humor"
  | "pdi"
  | "leaderboard"
  | "inboxFeed"
  | "meuTime";

export interface WidgetMeta {
  id: WidgetId;
  label: string;
  description: string;
  removable: boolean;
  defaultLayout: LayoutItem;
}

export type { ResponsiveLayouts };

// 12-column grid, rowHeight=60px, margin=[10,10]
export const WIDGET_CATALOG: WidgetMeta[] = [
  {
    id: "oQueFazer",
    label: "O que fazer agora",
    description: "Alertas de pendências e vagas fora do SLA",
    removable: true,
    defaultLayout: { i: "oQueFazer", x: 0, y: 0, w: 12, h: 3, minH: 2 },
  },
  {
    id: "kpis",
    label: "KPIs",
    description: "Indicadores principais do recrutamento",
    removable: false,
    defaultLayout: { i: "kpis", x: 0, y: 3, w: 12, h: 3, minH: 3, maxH: 4 },
  },
  {
    id: "resumo",
    label: "Resumo",
    description: "Gráfico de CVs recebidos nos últimos 14 dias",
    removable: true,
    defaultLayout: { i: "resumo", x: 0, y: 6, w: 7, h: 5, minH: 4, minW: 4 },
  },
  {
    id: "funil",
    label: "Funil",
    description: "Pipeline de recrutamento por etapa",
    removable: true,
    defaultLayout: { i: "funil", x: 7, y: 6, w: 5, h: 5, minH: 4, minW: 3 },
  },
  {
    id: "aprovacoes",
    label: "Aprovações Pendentes",
    description: "Solicitações aguardando aprovação",
    removable: true,
    defaultLayout: { i: "aprovacoes", x: 0, y: 11, w: 12, h: 5, minH: 3 },
  },
  {
    id: "topMatches",
    label: "Melhores Matches",
    description: "Top 15 candidatos por score de match",
    removable: true,
    defaultLayout: { i: "topMatches", x: 0, y: 16, w: 12, h: 8, minH: 6 },
  },
  {
    id: "sla",
    label: "SLA de Vagas",
    description: "Status de prazo das vagas abertas",
    removable: true,
    defaultLayout: { i: "sla", x: 0, y: 24, w: 12, h: 5, minH: 4 },
  },
  {
    id: "proximasAcoes",
    label: "Próximas Ações",
    description: "Deadlines e compromissos próximos",
    removable: true,
    defaultLayout: { i: "proximasAcoes", x: 0, y: 29, w: 6, h: 6, minH: 4, minW: 3 },
  },
  {
    id: "humor",
    label: "Humor da Equipe",
    description: "Tendência de humor e bem-estar do time",
    removable: true,
    defaultLayout: { i: "humor", x: 6, y: 29, w: 6, h: 6, minH: 4, minW: 3 },
  },
  {
    id: "pdi",
    label: "Planos de Desenvolvimento",
    description: "PDIs ativos por status e progresso",
    removable: true,
    defaultLayout: { i: "pdi", x: 0, y: 35, w: 5, h: 6, minH: 4, minW: 3 },
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    description: "Ranking de pontos de engajamento (RenderCoins)",
    removable: true,
    defaultLayout: { i: "leaderboard", x: 5, y: 35, w: 7, h: 6, minH: 4, minW: 4 },
  },
  {
    id: "inboxFeed",
    label: "Feed de CVs",
    description: "Atualizações em tempo real do processamento de currículos",
    removable: true,
    defaultLayout: { i: "inboxFeed", x: 0, y: 41, w: 12, h: 5, minH: 3 },
  },
  {
    id: "meuTime",
    label: "Meu Time",
    description: "Colaboradores diretos e indiretos da sua hierarquia",
    removable: true,
    defaultLayout: { i: "meuTime", x: 0, y: 46, w: 6, h: 8, minH: 5, minW: 3 },
  },
];

export const DEFAULT_LAYOUT: LayoutItem[] = WIDGET_CATALOG.map((w) => w.defaultLayout);

// By default only original 6 are visible; new widgets are opt-in
export const DEFAULT_VISIBLE: WidgetId[] = [
  "oQueFazer",
  "kpis",
  "resumo",
  "funil",
  "aprovacoes",
  "topMatches",
];

export const GRID_COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
export const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
