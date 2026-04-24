// Tipos do contrato /api/dashboard/agregado?perfil=... (Sessão 31).
// Mantém 1:1 com RhPortal.Api.Contracts.Dashboard.DashboardAgregadoContracts.

export type PerfilAgregado = "gestor" | "rh" | "diretor";

export interface DashboardGestorVagaAbertaItem {
  vagaId: string;
  codigo: string | null;
  titulo: string;
  diasAberta: number;
  foraDoSla: boolean;
  candidaturas: number;
}

export interface DashboardGestorCandidaturaItem {
  candidaturaId: string;
  vagaId: string;
  vagaTitulo: string | null;
  candidatoId: string;
  candidatoNome: string;
  etapaMacro: string;
  diasNaEtapa: number | null;
}

export interface DashboardGestorSection {
  diretosAtivos: number;
  diretosComDadosIncompletos: number;
  carteiraVagasAbertas: number;
  carteiraVagasParadas: number;
  carteiraCandidaturasAtivas: number;
  candidaturasEtapaAvancada: number;
  aprovacoesPendentesMinhas: number;
  solicitacoesEquipePendentes: number;
  avaliacoesDiretosPendentes: number;
  vagasMaisAntigas: DashboardGestorVagaAbertaItem[];
  candidaturasEmDestaque: DashboardGestorCandidaturaItem[];
}

export interface DashboardRhVagaForaSlaItem {
  vagaId: string;
  codigo: string | null;
  titulo: string;
  area: string | null;
  diasAberta: number;
  metaSlaDias: number;
}

export interface DashboardRhPreAdmissaoItem {
  preAdmissaoId: string;
  nome: string;
  status: string;
  updatedAtUtc: string;
  completionPercent: number | null;
}

export interface DashboardRhSection {
  vagasAbertas: number;
  vagasForaSla: number;
  vagasRascunho: number;
  pipelineAplicadas: number;
  pipelineEmTriagem: number;
  pipelineEntrevista: number;
  pipelineProposta: number;
  pipelineContratadoMes: number;
  preAdmissoesEmAndamento: number;
  preAdmissoesAguardandoAprovacao: number;
  preAdmissoesAprovadasMes: number;
  admissoesSemana: number;
  admissoesMes: number;
  notificacoesFalhadas7d: number;
  matchingScoresUltimas48h: number;
  aprovacoesFaixaPendentes: number;
  solicitacoesVagaPendentes: number;
  vagasForaSlaTop: DashboardRhVagaForaSlaItem[];
  preAdmissoesRecentes: DashboardRhPreAdmissaoItem[];
}

export interface DashboardDiretorAreaItem {
  centroCustoId: string | null;
  centroCustoNome: string;
  /** @deprecated use centroCustoId */
  areaId?: string | null;
  /** @deprecated use centroCustoNome */
  areaNome?: string;
  headcount: number;
  vagasAbertas: number;
}

export interface DashboardDiretorCicloItem {
  cicloId: string;
  nome: string;
  periodo: string;
  status: string;
  convitesTotal: number;
  convitesRespondidos: number;
}

export interface DashboardDiretorSection {
  headcountTotal: number;
  headcountComDadosIncompletos: number;
  admissoesMes: number;
  desligamentosConcluidosMes: number;
  desligamentosAguardandoIntegracaoMes: number;
  vagasAprovadasMes: number;
  solicitacoesVagaPendentes: number;
  alcadaSalarialAprovadaMes: number;
  ciclosAvaliacaoAbertos: number;
  ciclosAvaliacaoEmCalibragem: number;
  convitesAvaliacaoPendentes: number;
  headcountPorArea: DashboardDiretorAreaItem[];
  ciclosResumo: DashboardDiretorCicloItem[];
}

export interface DashboardAgregadoResponse {
  perfil: PerfilAgregado;
  geradoEmUtc: string;
  funcionarioId: string | null;
  gestor: DashboardGestorSection | null;
  rh: DashboardRhSection | null;
  diretor: DashboardDiretorSection | null;
}
