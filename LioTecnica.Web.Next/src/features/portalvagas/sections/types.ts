/** Tipos compartilhados para as seções do perfil do Portal de Vagas */

export type SkillDto = {
  id: string;
  tipo: string;
  nome: string;
  nivel: string;
  evidencia?: string | null;
};

export type CertificationDto = {
  id: string;
  nome: string;
  instituicao?: string | null;
  ano?: string | null;
  link?: string | null;
};

export type SkillsPortfolioResponse = {
  skills: SkillDto[];
  certifications: CertificationDto[];
  links: { linkedin?: string; github?: string; portfolio?: string; drive?: string };
  preferences: { workModel?: string; availability?: string; salary?: string; shift?: string; note?: string };
  tags?: string | null;
};

export type EducationSummary = {
  nivel?: string | null;
  areaPrincipal?: string | null;
  situacao?: string | null;
  dataConclusao?: string | null;
  destaques?: string | null;
};

export type EducationItem = {
  id: string;
  curso: string;
  instituicao?: string | null;
  tipo?: string | null;
  status?: string | null;
  inicio?: string | null;
  fim?: string | null;
  observacoes?: string | null;
  link?: string | null;
};

export type EducationResponse = {
  summary: EducationSummary;
  items: EducationItem[];
};

export type PreferencesResponse = {
  cargoAlvo?: string | null;
  senioridade?: string | null;
  inicioDisponivel?: string | null;
  resumo?: string | null;
  areasInteresse?: string | null;
  modeloTrabalho?: string | null;
  jornada?: string | null;
  tipoContrato?: string | null;
  viagens?: string | null;
  mudanca?: string | null;
  cidadePreferida?: string | null;
  distanciaMaxKm?: string | null;
  obsDeslocamento?: string | null;
  pretensaoSalarial?: string | null;
  pretensaoNegociavel?: string | null;
  beneficiosDesejados?: string | null;
  naoAbreMaoDe?: string | null;
};

export type LgpdResponse = {
  processarCandidatura: boolean;
  permitirContato: boolean;
  bancoTalentos: boolean;
  retencaoMeses?: number | null;
  compartilhamento?: string | null;
  dadosSensiveis: boolean;
  comunicacoes: boolean;
  consentidoEmUtc?: string | null;
  revogadoEmUtc?: string | null;
};

export type NotificationsResponse = {
  canalEmail: boolean;
  canalWhatsapp: boolean;
  canalSms: boolean;
  canalPush: boolean;
  frequencia?: string | null;
  idioma?: string | null;
  email?: string | null;
  telefone?: string | null;
  permiteContato: boolean;
  alertaNovasVagas: boolean;
  alertaAtualizacoes: boolean;
  alertaEntrevistas: boolean;
  alertaMensagens: boolean;
  alertaDocumentos: boolean;
  alertaLembretes: boolean;
  silencioAtivo?: string | null;
  silencioInicio?: string | null;
  silencioFim?: string | null;
  silencioPrioridade?: string | null;
  assinatura?: string | null;
};

export type DocumentDto = {
  id: string;
  tipo: string;
  nome: string;
  link?: string | null;
  data?: string | null;
  observacoes?: string | null;
  fileName?: string | null;
  createdAtUtc: string;
};

export type ExperienceDto = {
  id: string;
  empresa: string;
  cargo: string;
  inicio?: string | null;
  fim?: string | null;
  local?: string | null;
  atividades?: string | null;
};

export type ProjectDto = {
  id: string;
  nome: string;
  periodo?: string | null;
  descricao?: string | null;
  link?: string | null;
  stack?: string | null;
  destaques?: string | null;
};

export type ReferenceDto = {
  id: string;
  nome: string;
  relacao?: string | null;
  empresa?: string | null;
  cargo?: string | null;
  contato?: string | null;
  periodo?: string | null;
  linkedin?: string | null;
  observacoes?: string | null;
  podeContatar: boolean;
  updatedAtUtc: string;
};

export type AccessibilityResponse = {
  idioma?: string | null;
  canal?: string | null;
  melhorHorario?: string | null;
  observacoesComunicacao?: string | null;
  precisaLegendas: boolean;
  precisaInterprete: boolean;
  precisaLeitorTela: boolean;
  precisaBaixaEstimulo: boolean;
  precisaMobilidade: boolean;
  precisaTempoExtra: boolean;
  detalhesNecessidades?: string | null;
  consentimentoPcd: boolean;
  pcdIdentificacao?: string | null;
  pcdTipo?: string | null;
  pcdComprovacao?: string | null;
  pcdObservacoes?: string | null;
};
