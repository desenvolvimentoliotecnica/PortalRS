/** Mapa de rotas do protótipo mobile Talent RH */
export const ROUTES = {
  hub: {
    file: 'index.html',
    world: 'hub',
    nav: null,
    title: 'Protótipo Mobile',
  },
  'rh-dashboard': {
    file: 'dashboard-mobile.html',
    world: 'rh',
    nav: 'inicio',
    title: 'Dashboard',
  },
  'rh-requisicao': {
    file: 'detalhe-requisicao-mobile.html',
    world: 'rh',
    nav: 'requisicoes',
    title: 'Detalhe da requisição',
  },
  'rh-vagas': {
    file: 'gestao-vagas-mobile.html',
    world: 'rh',
    nav: 'vagas',
    title: 'Gestão de vagas',
  },
  'rh-vaga-detalhe': {
    file: 'detalhe-vaga-publicada-mobile.html',
    world: 'rh',
    nav: 'vagas',
    title: 'Detalhe da vaga',
  },
  'rh-banco': {
    file: 'banco-talentos-mobile.html',
    world: 'rh',
    nav: 'candidatos',
    title: 'Banco de talentos',
  },
  'rh-matching': {
    file: 'matching-candidatos-mobile.html',
    world: 'rh',
    nav: 'candidatos',
    title: 'Matching de candidatos',
  },
  'rh-kanban': {
    file: 'kanban-candidatos-mobile.html',
    world: 'rh',
    nav: 'candidatos',
    title: 'Kanban de candidatos',
  },
  'rh-perfil': {
    file: 'perfil-candidato-mobile.html',
    world: 'rh',
    nav: 'candidatos',
    title: 'Perfil do candidato',
  },
  'rh-agenda': {
    file: 'agenda-entrevistas-mobile.html',
    world: 'rh',
    nav: 'candidatos',
    title: 'Agenda de entrevistas',
  },
  'rh-avaliacao': {
    file: 'avaliacao-entrevista-mobile.html',
    world: 'rh',
    nav: 'candidatos',
    title: 'Avaliação da entrevista',
  },
  'rh-aprovacao': {
    file: 'aprovacao-gestor-mobile.html',
    world: 'rh',
    nav: 'candidatos',
    title: 'Aprovação do gestor',
  },
  'rh-proposta': {
    file: 'proposta-pre-admissao-mobile.html',
    world: 'rh',
    nav: 'candidatos',
    title: 'Proposta e pré-admissão',
  },
  'rh-relatorios': {
    file: 'relatorios-mobile.html',
    world: 'rh',
    nav: 'mais',
    title: 'Relatórios',
  },
  'pub-oportunidades': {
    file: 'portal-oportunidades-mobile.html',
    world: 'portal',
    nav: 'inicio',
    title: 'Oportunidades',
  },
  'pub-vaga': {
    file: 'portal-detalhe-vaga-mobile.html',
    world: 'portal',
    nav: 'vagas',
    title: 'Detalhe da vaga',
  },
  'pub-candidatura': {
    file: 'portal-candidatura-mobile.html',
    world: 'portal',
    nav: null,
    title: 'Candidatura',
  },
  'pub-area': {
    file: 'portal-area-candidato-mobile.html',
    world: 'portal',
    nav: 'candidaturas',
    title: 'Área do candidato',
  },
};

export const DEFAULT_RH = 'rh-dashboard';
export const DEFAULT_PORTAL = 'pub-oportunidades';

export const RH_BOTTOM_NAV = {
  inicio: 'rh-dashboard',
  requisicoes: 'rh-requisicao',
  vagas: 'rh-vagas',
  candidatos: 'rh-banco',
  mais: 'rh-relatorios',
};

export const PORTAL_BOTTOM_NAV = {
  inicio: 'pub-oportunidades',
  vagas: 'pub-oportunidades',
  candidaturas: 'pub-area',
};
