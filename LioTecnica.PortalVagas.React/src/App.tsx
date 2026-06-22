import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

type AuthCandidate = {
  id: string
  nome: string
  email: string
  tenantId: string
}

type AuthSession = {
  accessToken: string
  accessTokenExpiresAtUtc: string
  accessTokenExpiresInSeconds: number
  refreshToken: string
  refreshTokenExpiresAtUtc: string
  candidate: AuthCandidate
}

type LegacyAuthResponse = {
  id: string
  nome: string
  email: string
  tenantId?: string
}

type AuthResponse = AuthSession | LegacyAuthResponse

type PortalProfile = {
  id: string
  nome: string
  email: string
  fone?: string | null
  celular?: string | null
  cidade?: string | null
  uf?: string | null
  linkedinUrl?: string | null
  resumoProfissional?: string | null
  avatarUrl?: string | null
  curriculo?: { id: string; nomeArquivo: string; createdAtUtc: string } | null
}

type PortalCompletion = {
  sections: Record<string, number>
  overall: number
  warnings?: string[]
  evidence?: Record<string, string>
  suggestions?: { section: string; text: string; impact: string }[]
}

type PortalMatchItem = {
  vagaId: string
  score: number
  title?: string | null
  area?: string | null
  city?: string | null
  uf?: string | null
  mode?: string | null
  level?: string | null
  reason?: string | null
}

type PortalSkill = { id: string; tipo: string; nome: string; nivel: string; evidencia?: string | null }
type PortalCertification = { id: string; nome: string; instituicao?: string | null; ano?: string | null; link?: string | null }
type PortalPortfolio = {
  skills: PortalSkill[]
  certifications: PortalCertification[]
  links: { linkedin?: string | null; github?: string | null; portfolio?: string | null; drive?: string | null }
  preferences: { workModel?: string | null; availability?: string | null; salary?: string | null; shift?: string | null; note?: string | null }
  tags?: string | null
}
type PortalEducationItem = { id: string; curso: string; instituicao?: string | null; tipo?: string | null; status?: string | null; inicio?: string | null; fim?: string | null; observacoes?: string | null; link?: string | null }
type PortalEducation = {
  summary: {
    nivel?: string | null
    areaPrincipal?: string | null
    situacao?: string | null
    dataConclusao?: string | null
    destaques?: string | null
  }
  items: PortalEducationItem[]
}
type PortalExperience = { id: string; empresa: string; cargo: string; inicio?: string | null; fim?: string | null; local?: string | null; atividades?: string | null }
type PortalProject = { id: string; nome: string; periodo?: string | null; descricao?: string | null; link?: string | null; stack?: string | null; destaques?: string | null }
type PortalExperienceProject = { experiences: PortalExperience[]; projects: PortalProject[] }
type PortalPreferences = {
  CargoAlvo?: string | null
  Senioridade?: string | null
  InicioDisponivel?: string | null
  Resumo?: string | null
  AreasInteresse?: string | null
  ModeloTrabalho?: string | null
  Jornada?: string | null
  TipoContrato?: string | null
  Viagens?: string | null
  Mudanca?: string | null
  CidadePreferida?: string | null
  DistanciaMaxKm?: string | null
  ObsDeslocamento?: string | null
  PretensaoSalarial?: string | null
  PretensaoNegociavel?: string | null
  BeneficiosDesejados?: string | null
  NaoAbreMaoDe?: string | null
  UpdatedAtUtc?: string | null
  updatedAtUtc?: string | null
}
type PortalAccessibility = {
  idioma?: string | null
  canal?: string | null
  melhorHorario?: string | null
  observacoesComunicacao?: string | null
  precisaLegendas: boolean
  precisaInterprete: boolean
  precisaLeitorTela: boolean
  precisaBaixaEstimulo: boolean
  precisaMobilidade: boolean
  precisaTempoExtra: boolean
  detalhesNecessidades?: string | null
  consentimentoPcd: boolean
  pcdIdentificacao?: string | null
  pcdTipo?: string | null
  pcdComprovacao?: string | null
  pcdObservacoes?: string | null
}
type PortalNotifications = {
  canalEmail: boolean
  canalWhatsapp: boolean
  canalSms: boolean
  canalPush: boolean
  frequencia?: string | null
  idioma?: string | null
  email?: string | null
  telefone?: string | null
  permiteContato: boolean
  alertaNovasVagas: boolean
  alertaAtualizacoes: boolean
  alertaEntrevistas: boolean
  alertaMensagens: boolean
  alertaDocumentos: boolean
  alertaLembretes: boolean
  silencioAtivo?: string | null
  silencioInicio?: string | null
  silencioFim?: string | null
  silencioPrioridade?: string | null
  assinatura?: string | null
}
type PortalDocument = { id: string; tipo: string; nome: string; link?: string | null; data?: string | null; observacoes?: string | null; fileName?: string | null; createdAtUtc: string }
type PortalReference = { id: string; nome: string; relacao?: string | null; empresa?: string | null; cargo?: string | null; contato?: string | null; periodo?: string | null; linkedin?: string | null; observacoes?: string | null; podeContatar: boolean; updatedAtUtc: string }
type PortalLgpd = {
  processarCandidatura: boolean
  permitirContato: boolean
  bancoTalentos: boolean
  retencaoMeses?: number | null
  compartilhamento?: string | null
  dadosSensiveis: boolean
  comunicacoes: boolean
  consentidoEmUtc?: string | null
  revogadoEmUtc?: string | null
}
type PortalJob = {
  id: string
  titulo: string
  area?: string | null
  modalidade?: string | null
  tipoContratacao?: string | null
  senioridade?: string | null
  cidade?: string | null
  uf?: string | null
  tagsKeywordsRaw?: string | null
  tagsStackRaw?: string | null
  tagsResponsabilidadesRaw?: string | null
  createdAtUtc: string
  tenantName?: string | null
  descricaoPublica?: string | null
  urgente?: boolean
  aceitaPcd?: boolean
  quantidadeVagas?: number | null
  etapas?: Array<{ id?: string; nome?: string | null }>
}

type PortalApplicationSummary = {
  id: string
  candidatoId: string
  vagaId: string
  vagaTitulo?: string | null
  status?: string | number | null
  etapaMacro?: string | number | null
  aplicadaEmUtc?: string | null
}

type PortalInternalNotification = {
  id: string
  candidatoId: string
  vagaId?: string | null
  vagaTitulo?: string | null
  candidaturaId?: string | null
  tipo: string
  titulo: string
  mensagem: string
  camposPendentes: string[]
  lidaEmUtc?: string | null
  resolvidaEmUtc?: string | null
  criadaPorNome?: string | null
  createdAtUtc: string
  updatedAtUtc: string
}

type PortalInternalNotificationsResponse = {
  items: PortalInternalNotification[]
  naoLidas: number
  pendentes: number
}

type WorkspaceState = {
  profile: PortalProfile | null
  completion: PortalCompletion | null
  matches: PortalMatchItem[]
  portfolio: PortalPortfolio | null
  education: PortalEducation | null
  experience: PortalExperienceProject | null
  preferences: PortalPreferences | null
  accessibility: PortalAccessibility | null
  notifications: PortalNotifications | null
  internalNotifications: PortalInternalNotificationsResponse | null
  documents: PortalDocument[]
  references: PortalReference[]
  lgpd: PortalLgpd | null
}

const WORKSPACE_SECTIONS = [
  { id: 'perfil-curriculo', label: 'Perfil e currículo', icon: 'fa-user' },
  { id: 'experiencias', label: 'Experiências', icon: 'fa-briefcase' },
  { id: 'projetos', label: 'Projetos', icon: 'fa-diagram-project' },
  { id: 'preferencias', label: 'Preferências de vaga', icon: 'fa-bullseye' },
  { id: 'skills', label: 'Portfólio e links', icon: 'fa-link' },
  { id: 'competencias', label: 'Competências', icon: 'fa-layer-group' },
  { id: 'credenciais', label: 'Credenciais', icon: 'fa-certificate' },
  { id: 'notificacoes', label: 'Notificações', icon: 'fa-bell' },
  { id: 'lgpd', label: 'LGPD e privacidade', icon: 'fa-shield-alt' },
  { id: 'educacao', label: 'Educação', icon: 'fa-graduation-cap' },
  { id: 'cursos-formacoes', label: 'Cursos e formações', icon: 'fa-book-open' },
  { id: 'documentos', label: 'Documentos', icon: 'fa-paperclip' },
  { id: 'referencias', label: 'Referências', icon: 'fa-users' },
  { id: 'acessibilidade', label: 'Acessibilidade', icon: 'fa-universal-access' },
  { id: 'matches', label: 'Conclusão e aderência', icon: 'fa-chart-line' },
] as const

type WorkspaceSectionId = (typeof WORKSPACE_SECTIONS)[number]['id']

function normalizeWorkspaceSection(hash: string): WorkspaceSectionId {
  const cleanHash = hash.replace(/^#/, '')
  const migrated = cleanHash === 'notificacoes-lgpd' ? 'notificacoes' : cleanHash
  return WORKSPACE_SECTIONS.some((section) => section.id === migrated)
    ? migrated as WorkspaceSectionId
    : 'perfil-curriculo'
}

type AccessLanguage = 'pt-BR' | 'en-US' | 'es-ES'
type BrazilianStateOption = { sigla: string; nome: string }

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'https://localhost:7073'
const DEFAULT_TENANT = (import.meta.env.VITE_DEFAULT_TENANT as string | undefined) ?? 'liotecnica'
const TENANT_QUERY_KEY = 'tenantId'
const ACCESS_LANGUAGE_STORAGE_KEY = 'portal-vagas-lang'
const DEV_PROXY_BASE_URL = ''
const IBGE_STATES_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome'
const IBGE_CITIES_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados'
const FALLBACK_JOB_AREAS = ['Administrativo', 'Comercial', 'Financeiro', 'Operações', 'Recursos Humanos', 'Tecnologia da Informação']
const SENIORITY_OPTIONS = ['Estágio', 'Trainee', 'Júnior', 'Pleno', 'Sênior', 'Especialista', 'Coordenação', 'Gerência', 'Diretoria']
const AVAILABILITY_OPTIONS = ['Imediato', 'Até 15 dias', 'Até 30 dias', 'Até 60 dias', 'A combinar']
const WORK_MODEL_OPTIONS = ['Presencial', 'Híbrido', 'Remoto', 'Indiferente']
const WORKDAY_OPTIONS = ['Integral', 'Parcial', 'Noturno', 'Escala', 'Flexível', 'A combinar']
const CONTRACT_OPTIONS = ['CLT', 'PJ', 'Temporário', 'Estágio', 'Trainee', 'A combinar']
const YES_NO_NEGOTIABLE_OPTIONS = ['Sim', 'Não', 'A combinar']
const DISTANCE_OPTIONS = ['5', '10', '20', '30', '50', '75', '100']
const ACCESSIBILITY_LANGUAGE_OPTIONS = ['Português', 'Inglês', 'Espanhol', 'Outro']
const ACCESSIBILITY_CHANNEL_OPTIONS = ['E-mail', 'WhatsApp', 'Telefone', 'SMS', 'Portal', 'Indiferente']
const ACCESSIBILITY_TIME_OPTIONS = ['Manhã', 'Tarde', 'Noite', 'Horário comercial', 'A combinar']
const PCD_IDENTIFICATION_OPTIONS = ['Sim', 'Não', 'Prefiro não informar']
const PCD_TYPE_OPTIONS = ['Física', 'Auditiva', 'Visual', 'Intelectual', 'Psicossocial', 'Múltipla', 'Outra']
const BRAZILIAN_STATE_OPTIONS: BrazilianStateOption[] = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
]
let resolvedApiBaseUrl: string | null = null

const ACCESS_TRANSLATIONS: Record<AccessLanguage, Record<string, string>> = {
  'pt-BR': {
    helpLink: 'Precisa de ajuda?',
    brandEyebrow: 'Portal de Vagas',
    brandTitle: 'Construa sua carreira onde a inovação nasce.',
    brandSubtitle: 'Entre no portal de vagas da Liotécnica para explorar oportunidades, completar seu perfil e acompanhar cada etapa da sua candidatura.',
    brandBadge: 'Vagas abertas em 2026',
    secureLogin: 'Conexão segura - LGPD',
    copyright: '© 2026 Liotécnica Indústria de Alimentos',
    pillar1Title: '+1.500 colaboradores',
    pillar1: 'Indústria líder no setor alimentício, presente em todo o Brasil.',
    pillar2Title: 'Plano de carreira',
    pillar2: 'Trilhas estruturadas, mentorias e programas de desenvolvimento.',
    pillar3Title: 'Pacote completo',
    pillar3: 'Plano de saúde, refeição, Gympass, PLR e auxílio educação.',
    title: 'Acesse sua conta',
    subtitle: 'Acompanhe suas candidaturas, complete seu perfil e descubra vagas que combinam com você.',
    titleRegister: 'Crie sua conta',
    subtitleRegister: 'Leva menos de 2 minutos. Você poderá completar seu perfil depois.',
    tenant: 'Organização',
    email: 'E-mail',
    emailPlaceholder: 'voce@empresa.com',
    password: 'Senha',
    passwordPlaceholder: 'Mínimo 8 caracteres',
    forgot: 'Esqueci minha senha',
    rememberMe: 'Manter conectado neste dispositivo',
    loginButton: 'Entrar no portal',
    processing: 'Entrando...',
    creating: 'Criando conta...',
    createHint: 'Ainda não tem cadastro?',
    createAccess: 'Criar conta',
    haveAccount: 'Já tem uma conta?',
    signIn: 'Entrar',
    languageLabel: 'Idioma',
    helpTitle: 'Como funciona o processo seletivo',
    helpSubtitle: 'Etapas para acompanhar sua candidatura na Liotécnica.',
    helpStep1: 'Crie seu perfil único e candidate-se às vagas em poucos cliques.',
    helpStep2: 'Nossa equipe analisa seu perfil e dá retorno em até 5 dias úteis.',
    helpStep3: 'Entrevista com gestor.',
    helpStep4: 'Recebimento da oferta, exames e onboarding.',
    close: 'Fechar',
    fullName: 'Nome completo',
    fullNamePlaceholder: 'Como aparece no seu RG',
    phone: 'Telefone',
    phonePlaceholder: '(11) 99999-9999',
    city: 'Cidade',
    cityPlaceholder: 'Selecione sua cidade',
    uf: 'UF',
    ufPlaceholder: 'Selecione a UF',
    loadingCities: 'Carregando cidades...',
    confirmPassword: 'Confirmar senha',
    ssoMicrosoft: 'Continuar com Microsoft',
    ssoGoogle: 'Continuar com Google',
    unavailable: 'em breve',
    or: 'ou',
    termsPrefix: 'Ao continuar, você concorda com os',
    termsUse: 'Termos de uso',
    termsAnd: 'e a',
    privacyPolicy: 'Política de Privacidade',
    termsSuffix: 'da Liotécnica.',
    passwordsDontMatch: 'As senhas não conferem.',
  },
  'en-US': {
    helpLink: 'Need help?',
    brandEyebrow: 'Jobs Portal',
    brandTitle: 'Build your career where innovation begins.',
    brandSubtitle: 'Access Liotécnica jobs, complete your profile, and follow every step of your application.',
    brandBadge: 'Open roles in 2026',
    secureLogin: 'Secure connection - LGPD',
    copyright: '© 2026 Liotécnica Food Industries',
    pillar1Title: '1,500+ employees',
    pillar1: 'Leading food-industry company, present across Brazil.',
    pillar2Title: 'Career growth',
    pillar2: 'Structured tracks, mentorship and development programs.',
    pillar3Title: 'Full benefits',
    pillar3: 'Health, meal, Gympass, profit share and education aid.',
    title: 'Access your account',
    subtitle: 'Track applications, complete your profile, and discover roles that fit you.',
    titleRegister: 'Create your account',
    subtitleRegister: 'Takes less than 2 minutes. You can complete your profile later.',
    tenant: 'Organization',
    email: 'Email',
    emailPlaceholder: 'you@company.com',
    password: 'Password',
    passwordPlaceholder: 'At least 8 characters',
    forgot: 'Forgot password',
    rememberMe: 'Keep me signed in on this device',
    loginButton: 'Enter the portal',
    processing: 'Signing in...',
    creating: 'Creating account...',
    createHint: 'Do not have access yet?',
    createAccess: 'Create account',
    haveAccount: 'Already have an account?',
    signIn: 'Sign in',
    languageLabel: 'Language',
    helpTitle: 'How the hiring process works',
    helpSubtitle: 'Steps to follow your application at Liotécnica.',
    helpStep1: 'Quick signup and a single profile.',
    helpStep2: 'Screening and response within 5 days.',
    helpStep3: 'Interview with the manager.',
    helpStep4: 'Offer and onboarding.',
    close: 'Close',
    fullName: 'Full name',
    fullNamePlaceholder: 'As on your ID',
    phone: 'Phone',
    phonePlaceholder: '+1 555 000 0000',
    city: 'City',
    cityPlaceholder: 'Select your city',
    uf: 'State',
    ufPlaceholder: 'Select state',
    loadingCities: 'Loading cities...',
    confirmPassword: 'Confirm password',
    ssoMicrosoft: 'Continue with Microsoft',
    ssoGoogle: 'Continue with Google',
    unavailable: 'coming soon',
    or: 'or',
    termsPrefix: 'By continuing, you agree to Liotécnica',
    termsUse: 'Terms of Use',
    termsAnd: 'and',
    privacyPolicy: 'Privacy Policy',
    termsSuffix: '',
    passwordsDontMatch: 'Passwords do not match.',
  },
  'es-ES': {
    helpLink: '¿Necesitas ayuda?',
    brandEyebrow: 'Portal de Vacantes',
    brandTitle: 'Construye tu carrera donde nace la innovación.',
    brandSubtitle: 'Accede al portal de vacantes de Liotécnica para explorar oportunidades, completar tu perfil y seguir tu candidatura.',
    brandBadge: 'Vacantes abiertas en 2026',
    secureLogin: 'Conexión segura - LGPD',
    copyright: '© 2026 Liotécnica Industria de Alimentos',
    pillar1Title: '+1.500 colaboradores',
    pillar1: 'Industria líder del sector alimenticio, presente en todo Brasil.',
    pillar2Title: 'Plan de carrera',
    pillar2: 'Trayectorias estructuradas, mentorías y programas de desarrollo.',
    pillar3Title: 'Beneficios completos',
    pillar3: 'Salud, comida, Gympass, participación en utilidades y apoyo educativo.',
    title: 'Accede a tu cuenta',
    subtitle: 'Sigue tus candidaturas, completa tu perfil y descubre vacantes para ti.',
    titleRegister: 'Crea tu cuenta',
    subtitleRegister: 'Toma menos de 2 minutos. Puedes completar tu perfil después.',
    tenant: 'Organización',
    email: 'Correo',
    emailPlaceholder: 'tu@empresa.com',
    password: 'Contraseña',
    passwordPlaceholder: 'Mínimo 8 caracteres',
    forgot: 'Olvidé mi contraseña',
    rememberMe: 'Mantenerme conectado en este dispositivo',
    loginButton: 'Entrar al portal',
    processing: 'Entrando...',
    creating: 'Creando cuenta...',
    createHint: '¿Aún no tienes cuenta?',
    createAccess: 'Crear cuenta',
    haveAccount: '¿Ya tienes cuenta?',
    signIn: 'Entrar',
    languageLabel: 'Idioma',
    helpTitle: 'Cómo funciona el proceso',
    helpSubtitle: 'Pasos para seguir tu candidatura en Liotécnica.',
    helpStep1: 'Crea tu perfil único y postúlate en pocos clics.',
    helpStep2: 'Nuestro equipo revisa tu perfil y responde en hasta 5 días hábiles.',
    helpStep3: 'Entrevista con el responsable.',
    helpStep4: 'Oferta, exámenes e incorporación.',
    close: 'Cerrar',
    fullName: 'Nombre completo',
    fullNamePlaceholder: 'Como en tu documento',
    phone: 'Teléfono',
    phonePlaceholder: '+34 600 000 000',
    city: 'Ciudad',
    cityPlaceholder: 'Selecciona tu ciudad',
    uf: 'Estado',
    ufPlaceholder: 'Selecciona estado',
    loadingCities: 'Cargando ciudades...',
    confirmPassword: 'Confirmar contraseña',
    ssoMicrosoft: 'Continuar con Microsoft',
    ssoGoogle: 'Continuar con Google',
    unavailable: 'próximamente',
    or: 'o',
    termsPrefix: 'Al continuar, aceptas los',
    termsUse: 'Términos de uso',
    termsAnd: 'y la',
    privacyPolicy: 'Política de Privacidad',
    termsSuffix: 'de Liotécnica.',
    passwordsDontMatch: 'Las contraseñas no coinciden.',
  },
}

function App() {
  return (
    <BrowserRouter>
      <PortalApp />
    </BrowserRouter>
  )
}

function PortalApp() {
  const location = useLocation()
  const isAccessRoute = location.pathname === '/acesso'
  const tenantId = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return (params.get(TENANT_QUERY_KEY) ?? DEFAULT_TENANT).trim().toLowerCase()
  }, [location.search])
  const storageKey = `portal-vagas-react-session:${tenantId}`
  const [session, setSession] = useState<AuthSession | null>(() => loadStoredSession(storageKey, tenantId))
  const [initializing, setInitializing] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [profileModalOpen, setProfileModalOpen] = useState(false)
  useEffect(() => {
    setSession(loadStoredSession(storageKey, tenantId))
  }, [storageKey, tenantId])
  useEffect(() => {
    if (!session) {
      setInitializing(false)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const refreshed = await ensureSession(session, tenantId)
        if (cancelled) return
        persistSession(storageKey, refreshed)
        setSession(refreshed)
      } catch {
        if (cancelled) return
        clearSession(storageKey)
        setSession(null)
      } finally {
        if (!cancelled) setInitializing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session, storageKey, tenantId])
  const authContext = useMemo(() => ({
    tenantId,
    session,
    setSession: (next: AuthSession | null) => {
      if (next) {
        persistSession(storageKey, next)
      } else {
        clearSession(storageKey)
      }
      setSession(next)
    },
    notifyAuthError: setAuthError,
  }), [session, storageKey, tenantId])
  useEffect(() => {
    if (!authError) return
    const timeout = window.setTimeout(() => setAuthError(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [authError])
  useEffect(() => {
    setUserMenuOpen(false)
  }, [location.pathname, location.search])
  const initials = session ?getInitials(session.candidate.nome) : 'LT'
  return (
    <div className={`portal-root${isAccessRoute ?' access-route' : ''}`}>
      {!isAccessRoute ?(
        <div className="header-wrapper">
          <nav className="portal-navbar">
            <div className="portal-container portal-nav-inner">
              <Link className="portal-brand" to={withTenant('/', tenantId)}>
                <img
                  className="portal-brand-logo"
                  src="/images/logo-liotecnica.png"
                  alt="Liotécnica"
                />
                <span>Portal de Vagas</span>
              </Link>
              <div className="portal-actions">
                {session ?(
                  <div className="portal-user-menu">
                    <Link className="portal-action-link" to={withTenant('/candidato', tenantId)}>Meu espaço</Link>
                    <button
                      className="portal-user-btn"
                      type="button"
                      aria-expanded={userMenuOpen}
                      aria-haspopup="menu"
                      onClick={() => setUserMenuOpen((value) => !value)}
                    >
                      <span className="portal-user-avatar">{initials}</span>
                      <span className="portal-user-copy">
                        <span className="portal-user-name">{session.candidate.nome}</span>
                        <span className="portal-user-email">{session.candidate.email}</span>
                      </span>
                      <i className="fas fa-chevron-down portal-user-chevron" aria-hidden="true"></i>
                    </button>
                    {userMenuOpen ?(
                      <div className="portal-user-dropdown" role="menu">
                        <Link
                          className="portal-user-dropdown-item"
                          to={withTenant('/candidato', tenantId)}
                          onClick={() => {
                            setProfileModalOpen(false)
                            setUserMenuOpen(false)
                          }}
                        >
                          Meu espaço
                        </Link>
                        <div className="portal-user-dropdown-divider" />
                        <button
                          className="portal-user-dropdown-item danger"
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false)
                            void signOutPortalSession(authContext)
                          }}
                        >
                          Sair
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <Link className="portal-login-pill" to={withTenant('/acesso', tenantId)}>
                    Entrar no portal
                  </Link>
                )}
              </div>
            </div>
          </nav>
        </div>
      ) : null}
      {authError ?<div className="toast-banner error">{authError}</div> : null}
      <Routes>
        <Route path="/acesso" element={<AccessPage ctx={authContext} />} />
        <Route
          path="/"
          element={
            initializing ?(
              <PageLoading label="Validando seu acesso..." />
            ) : session ?(
              <JobsPage ctx={authContext} />
            ) : (
              <Navigate to={withTenant('/acesso', tenantId)} replace />
            )
          }
        />
        <Route
          path="/candidato"
          element={
            initializing ?(
              <PageLoading label="Preparando seu workspace..." />
            ) : session ?(
              <CandidateWorkspace ctx={authContext} />
            ) : (
              <Navigate to={withTenant('/acesso', tenantId)} replace />
            )
          }
        />
        <Route path="*" element={<Navigate to={withTenant(session ? '/' : '/acesso', tenantId)} replace />} />
      </Routes>
      {session && profileModalOpen ?(
        <CandidateProfileModal ctx={authContext} onClose={() => setProfileModalOpen(false)} />
      ) : null}
    </div>
  )
}

function AccessPage({ ctx }: { ctx: AuthContext }) {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [registerPending, setRegisterPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [language, setLanguage] = useState<AccessLanguage>(() => {
    if (typeof window === 'undefined') return 'pt-BR'
    const stored = window.localStorage.getItem(ACCESS_LANGUAGE_STORAGE_KEY)
    return stored === 'en-US' || stored === 'es-ES' || stored === 'pt-BR' ?stored : 'pt-BR'
  })
  const [login, setLogin] = useState({ email: '', password: '', remember: true })
  const [register, setRegister] = useState({
    nome: '',
    email: '',
    fone: '',
    cidade: '',
    uf: '',
    password: '',
    confirmPassword: '',
  })
  const [ufOptions, setUfOptions] = useState(BRAZILIAN_STATE_OPTIONS)
  const [cityOptions, setCityOptions] = useState<string[]>([])
  const [cityLoading, setCityLoading] = useState(false)
  const text = ACCESS_TRANSLATIONS[language]

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(ACCESS_LANGUAGE_STORAGE_KEY, language)
  }, [language])

  useEffect(() => {
    let cancelled = false
    fetch(IBGE_STATES_URL)
      .then((response) => response.ok ? response.json() as Promise<BrazilianStateOption[]> : Promise.reject(new Error('IBGE indisponível')))
      .then((states) => {
        if (cancelled) return
        const normalized = states
          .map((state) => ({ sigla: state.sigla, nome: state.nome }))
          .filter((state) => state.sigla && state.nome)
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        if (normalized.length) setUfOptions(normalized)
      })
      .catch(() => {
        if (!cancelled) setUfOptions(BRAZILIAN_STATE_OPTIONS)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!register.uf) {
      setCityOptions([])
      setCityLoading(false)
      return
    }

    let cancelled = false
    setCityLoading(true)
    fetch(`${IBGE_CITIES_URL}/${encodeURIComponent(register.uf)}/municipios?orderBy=nome`)
      .then((response) => response.ok ? response.json() as Promise<Array<{ nome: string }>> : Promise.reject(new Error('IBGE indisponível')))
      .then((cities) => {
        if (cancelled) return
        const names = cities.map((city) => city.nome).filter(Boolean)
        setCityOptions(names)
        setRegister((current) => current.cidade && !names.includes(current.cidade) ?{ ...current, cidade: '' } : current)
      })
      .catch(() => {
        if (!cancelled) setCityOptions([])
      })
      .finally(() => {
        if (!cancelled) setCityLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [register.uf])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      const session = await portalRequest<AuthResponse>(ctx.tenantId, '/api/public/portal-auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: login.email.trim(),
          password: login.password,
        }),
      })
      ctx.setSession(normalizeAuthSession(session, ctx.tenantId))
      navigate(withTenant('/', ctx.tenantId))
    } catch (err) {
      setError(readError(err))
    } finally {
      setPending(false)
    }
  }

  async function onRegisterSubmit(event: FormEvent) {
    event.preventDefault()
    setRegisterPending(true)
    setRegisterError(null)

    try {
      if (register.password !== register.confirmPassword) {
        throw new Error(text.passwordsDontMatch)
      }

      const session = await portalRequest<AuthResponse>(ctx.tenantId, '/api/public/portal-auth/register', {
        method: 'POST',
        body: JSON.stringify({
          nome: register.nome.trim(),
          email: register.email.trim(),
          fone: register.fone.trim(),
          cidade: register.cidade.trim(),
          uf: register.uf.trim().toUpperCase(),
          password: register.password,
        }),
      })

      ctx.setSession(normalizeAuthSession(session, ctx.tenantId))
      navigate(withTenant('/', ctx.tenantId))
    } catch (err) {
      setRegisterError(readError(err))
    } finally {
      setRegisterPending(false)
    }
  }

  return (
    <main className="auth-page-shell">
      <aside className="auth-brand-panel">
        <div className="auth-brand-pattern" aria-hidden="true"></div>
        <div className="auth-brand-grid" aria-hidden="true"></div>

        <div className="auth-brand-top">
          <div className="auth-brand-lockup">
            <img src="/images/logo-liotecnica.png" alt="Liotécnica" />
          </div>
          <span className="auth-brand-secure">
            <i className="fas fa-lock" aria-hidden="true"></i>
            {text.secureLogin}
          </span>
        </div>

        <div className="auth-brand-content">
          <span className="auth-brand-badge">
            <i className="fas fa-sparkles" aria-hidden="true"></i>
            {text.brandBadge}
          </span>
          <h1>{text.brandTitle}</h1>
          <p>{text.brandSubtitle}</p>
          <div className="auth-brand-pillars">
            <div>
              <span>01</span>
              <strong>{text.pillar1Title}</strong>
              <p>{text.pillar1}</p>
            </div>
            <div>
              <span>02</span>
              <strong>{text.pillar2Title}</strong>
              <p>{text.pillar2}</p>
            </div>
            <div>
              <span>03</span>
              <strong>{text.pillar3Title}</strong>
              <p>{text.pillar3}</p>
            </div>
          </div>
        </div>

        <footer className="auth-brand-footer">{text.copyright}</footer>
      </aside>

      <section className="auth-form-panel">
        <header className="auth-form-header">
          <div className="auth-language-switch" aria-label={text.languageLabel}>
            <button type="button" className={language === 'pt-BR' ?'is-active' : ''} onClick={() => setLanguage('pt-BR')}>PT</button>
            <button type="button" className={language === 'en-US' ?'is-active' : ''} onClick={() => setLanguage('en-US')}>EN</button>
            <button type="button" className={language === 'es-ES' ?'is-active' : ''} onClick={() => setLanguage('es-ES')}>ES</button>
          </div>
          <button className="auth-page-help" type="button" onClick={() => setShowHelpModal(true)}>
            <i className="fas fa-circle-question" aria-hidden="true"></i>
            {text.helpLink}
          </button>
        </header>

        <div className="auth-form-card">
          <div className="auth-title">
            <h1>{authMode === 'register' ?text.titleRegister : text.title}</h1>
            <h2>{authMode === 'register' ?text.subtitleRegister : text.subtitle}</h2>
          </div>

          <div className="auth-sso-grid">
            <button type="button" className="auth-sso-btn" disabled>
              <i className="fab fa-microsoft" aria-hidden="true"></i>
              {text.ssoMicrosoft}
              <span>{text.unavailable}</span>
            </button>
            <button type="button" className="auth-sso-btn" disabled>
              <i className="fab fa-google" aria-hidden="true"></i>
              {text.ssoGoogle}
              <span>{text.unavailable}</span>
            </button>
          </div>

          <div className="auth-divider">{text.or}</div>

          {authMode === 'login' ?(
            <form className="auth-card auth-card-main" onSubmit={onSubmit}>
              <label className="auth-field">
                <span>{text.email}</span>
                <input type="email" value={login.email} onChange={(e) => setLogin((v) => ({ ...v, email: e.target.value }))} placeholder={text.emailPlaceholder} required />
              </label>
              <label className="auth-field">
                <span className="auth-field-row">
                  {text.password}
                  <button className="auth-link-button is-disabled" type="button" disabled>{text.forgot}</button>
                </span>
                <input type="password" value={login.password} onChange={(e) => setLogin((v) => ({ ...v, password: e.target.value }))} placeholder={text.passwordPlaceholder} required />
              </label>
              <label className="auth-checkbox">
                <input type="checkbox" checked={login.remember} onChange={(e) => setLogin((v) => ({ ...v, remember: e.target.checked }))} />
                <span>{text.rememberMe}</span>
              </label>
              {error ?<div className="inline-alert error auth-inline-alert">{error}</div> : null}
              <button className="auth-submit" type="submit" disabled={pending}>
                {pending ?text.processing : text.loginButton}
              </button>
            </form>
          ) : (
            <form className="auth-card auth-card-main" onSubmit={onRegisterSubmit}>
              <label className="auth-field">
                <span>{text.fullName}</span>
                <input value={register.nome} onChange={(e) => setRegister((v) => ({ ...v, nome: e.target.value }))} placeholder={text.fullNamePlaceholder} required />
              </label>
              <label className="auth-field">
                <span>{text.email}</span>
                <input type="email" value={register.email} onChange={(e) => setRegister((v) => ({ ...v, email: e.target.value }))} placeholder={text.emailPlaceholder} required />
              </label>
              <div className="grid two">
                <label className="auth-field">
                  <span>{text.phone}</span>
                  <input inputMode="tel" maxLength={15} value={register.fone} onChange={(e) => setRegister((v) => ({ ...v, fone: formatBrazilianPhone(e.target.value) }))} placeholder={text.phonePlaceholder} required />
                </label>
                <label className="auth-field">
                  <span>{text.uf}</span>
                  <select value={register.uf} onChange={(e) => setRegister((v) => ({ ...v, uf: e.target.value, cidade: '' }))} required>
                    <option value="">{text.ufPlaceholder}</option>
                    {ufOptions.map((state) => (
                      <option key={state.sigla} value={state.sigla}>{state.sigla} - {state.nome}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="auth-field">
                <span>{text.city}</span>
                <select value={register.cidade} onChange={(e) => setRegister((v) => ({ ...v, cidade: e.target.value }))} disabled={!register.uf || cityLoading || cityOptions.length === 0} required>
                  <option value="">{cityLoading ?text.loadingCities : text.cityPlaceholder}</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </label>
              <div className="grid two">
                <label className="auth-field">
                  <span>{text.password}</span>
                  <input type="password" value={register.password} onChange={(e) => setRegister((v) => ({ ...v, password: e.target.value }))} placeholder={text.passwordPlaceholder} required />
                </label>
                <label className="auth-field">
                  <span>{text.confirmPassword}</span>
                  <input type="password" value={register.confirmPassword} onChange={(e) => setRegister((v) => ({ ...v, confirmPassword: e.target.value }))} placeholder={text.passwordPlaceholder} required />
                </label>
              </div>
              {registerError ?<div className="inline-alert error auth-inline-alert">{registerError}</div> : null}
              <button className="auth-submit" type="submit" disabled={registerPending}>
                {registerPending ?text.creating : text.createAccess}
              </button>
            </form>
          )}

          <div className="auth-links">
            <span className="auth-note">{authMode === 'register' ?text.haveAccount : text.createHint}</span>
            <button
              className="auth-secondary-btn"
              type="button"
              onClick={() => {
                setAuthMode((value) => value === 'register' ? 'login' : 'register')
                setError(null)
                setRegisterError(null)
              }}
            >
              {authMode === 'register' ?text.signIn : text.createAccess}
            </button>
          </div>

          <p className="auth-terms">
            {text.termsPrefix}{' '}
            <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer">{text.termsUse}</a>{' '}
            {text.termsAnd}{' '}
            <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer">{text.privacyPolicy}</a>
            {text.termsSuffix ?` ${text.termsSuffix}` : ''}
          </p>
        </div>
      </section>

      {showHelpModal ?(
        <div className="auth-modal-backdrop" onClick={() => setShowHelpModal(false)}>
          <div className="auth-help-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-help-modal-header">
              <div>
                <h2>{text.helpTitle}</h2>
                <div className="auth-help-modal-subtitle">{text.helpSubtitle}</div>
              </div>
              <button type="button" className="auth-modal-close" onClick={() => setShowHelpModal(false)} aria-label="Fechar">
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <div className="auth-help-timeline">
              <div className="auth-help-step"><span className="auth-help-dot"></span><span>{text.helpStep1}</span></div>
              <div className="auth-help-step"><span className="auth-help-dot"></span><span>{text.helpStep2}</span></div>
              <div className="auth-help-step"><span className="auth-help-dot"></span><span>{text.helpStep3}</span></div>
              <div className="auth-help-step"><span className="auth-help-dot"></span><span>{text.helpStep4}</span></div>
            </div>
            <div className="auth-help-modal-footer">
              <button className="auth-submit auth-modal-primary auth-submit-inline" type="button" onClick={() => setShowHelpModal(false)}>
                {text.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </main>
  )
}

function trimApplyField(value?: string | null): string {
  return (value ?? '').trim()
}

/** LinkedIn pode estar no PUT do perfil (`linkedinUrl`) e/ou em skills-portfolio (`links.linkedin`). */
function mergeLinkedInForApply(profileLinkedIn?: string | null, portfolioLinkedIn?: string | null): string {
  const fromProfile = trimApplyField(profileLinkedIn)
  if (fromProfile) return fromProfile
  return trimApplyField(portfolioLinkedIn)
}

function parseExperienceStartDate(value?: string | null): Date | null {
  const v = trimApplyField(value)
  if (!v) return null
  const d = new Date(v.includes('T') ? v : `${v}T12:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Cargo em experiência sem data de fim, senão a experiência mais recente; por fim “cargo alvo” das preferências. */
function deriveCargoAtualFromExperiences(experiences: PortalExperience[], cargoAlvo?: string | null): string {
  if (!experiences.length) return trimApplyField(cargoAlvo)
  const hasFim = (e: PortalExperience) => trimApplyField(e.fim).length > 0
  const current = experiences.filter((e) => !hasFim(e))
  const pool = current.length > 0 ? current : experiences
  const sorted = [...pool].sort((a, b) => {
    const tb = parseExperienceStartDate(b.inicio)?.getTime() ?? 0
    const ta = parseExperienceStartDate(a.inicio)?.getTime() ?? 0
    return tb - ta
  })
  if (sorted[0]?.cargo) return trimApplyField(sorted[0].cargo)
  return trimApplyField(cargoAlvo)
}

/** Estimativa a partir da data de início mais antiga nas experiências (campo data do formulário). */
function deriveAnosExperienciaFromExperiences(experiences: PortalExperience[]): string {
  const times = experiences
    .map((e) => parseExperienceStartDate(e.inicio)?.getTime())
    .filter((t): t is number => t != null && !Number.isNaN(t))
  if (!times.length) return ''
  const earliest = Math.min(...times)
  const years = (Date.now() - earliest) / (365.25 * 24 * 60 * 60 * 1000)
  const rounded = Math.max(0, Math.min(80, Math.round(years)))
  return String(rounded)
}

/** Apenas dígitos; limita a 0–80 (contrato da API). */
function sanitizeAnosExperienciaInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 3)
  if (digits === '') return ''
  const n = Math.min(80, parseInt(digits, 10))
  return Number.isNaN(n) ? '' : String(n)
}

function JobsPage({ ctx }: { ctx: AuthContext }) {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Carregando vagas...')
  const [error, setError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<PortalJob[]>([])
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(() => new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({ q: '', location: '', mode: '', type: '', level: '', area: '', sort: 'recent' })
  const [selectedJob, setSelectedJob] = useState<PortalJob | null>(null)
  const [applyPending, setApplyPending] = useState(false)
  const [applyResult, setApplyResult] = useState<string | null>(null)
  const [applicationFeedback, setApplicationFeedback] = useState<{
    type: 'success' | 'error'
    title: string
    message: string
  } | null>(null)
  const [applyData, setApplyData] = useState({
    nome: ctx.session?.candidate.nome ?? '',
    email: ctx.session?.candidate.email ?? '',
    fone: '',
    cidadeUf: '',
    linkedin: '',
    portfolio: '',
    cargoAtual: '',
    anosExperiencia: '',
    observacoes: '',
    arquivo: null as File | null,
  })
  async function loadJobs(activeFilters = filters) {
    setLoading(true)
    setError(null)
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        setMessage(attempt === 1 ?'Buscando oportunidades abertas...' : `API indisponível, tentando novamente (${attempt}/3)...`)
        const params = new URLSearchParams({
          tenantId: ctx.tenantId,
          page: '1',
          pageSize: '100',
          sort: activeFilters.sort,
        })
        for (const [key, value] of Object.entries(activeFilters)) {
          if (value && key !== 'sort' && key !== 'q') params.set(key, value)
        }
        const result = await fetchJson<{ items: PortalJob[] }>(`/api/public/vagas?${params.toString()}`)
        setJobs(filterJobsBySearch(result.items, activeFilters.q))
        setLoading(false)
        return
      } catch (err) {
        if (attempt < 3) {
          await sleep(1800 * attempt)
          continue
        }
        setError(readError(err) || 'Portal temporariamente indisponível. Tente novamente mais tarde.')
        setLoading(false)
        return
      }
    }
  }
  useEffect(() => {
    void loadJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const candidate = ctx.session?.candidate
    if (!candidate) {
      setAppliedJobIds(new Set())
      return
    }

    let cancelled = false
    fetchJson<PortalApplicationSummary[]>(`/api/public/portal-auth/minhas-candidaturas/${candidate.id}?tenantId=${encodeURIComponent(ctx.tenantId)}`)
      .then((items) => {
        if (cancelled) return
        setAppliedJobIds(new Set(items.map((item) => item.vagaId).filter(Boolean)))
      })
      .catch(() => {
        if (!cancelled) setAppliedJobIds(new Set())
      })

    return () => {
      cancelled = true
    }
  }, [ctx.session?.candidate.id, ctx.tenantId])
  useEffect(() => {
    const candidate = ctx.session?.candidate
    if (!selectedJob || !candidate) return

    let cancelled = false
    setApplyResult(null)
    setApplyData((current) => ({
      ...current,
      nome: candidate.nome,
      email: candidate.email,
    }))

    const authFetch = createAuthorizedClient(ctx)
    const base = `/api/public/portal-candidates/${candidate.id}`
    void Promise.all([
      authFetch<PortalProfile>(base).catch(() => null),
      authFetch<PortalPortfolio>(`${base}/skills-portfolio`).catch(() => null),
      authFetch<PortalExperienceProject>(`${base}/experience-projects`).catch(() => null),
      authFetch<PortalPreferences>(`${base}/preferences`).catch(() => null),
    ]).then(([profile, skillsPortfolio, expProject, preferences]) => {
      if (cancelled) return
      if (!profile) {
        setApplyResult('Não foi possível carregar seus dados básicos. Saia e entre novamente no portal para atualizar sua sessão.')
        return
      }
      const experiences = expProject?.experiences ?? []
      const linkedin = mergeLinkedInForApply(profile.linkedinUrl, skillsPortfolio?.links?.linkedin)
      const portfolioUrl = trimApplyField(skillsPortfolio?.links?.portfolio)
      const cargoAtual = deriveCargoAtualFromExperiences(experiences, preferences?.CargoAlvo)
      const anos = deriveAnosExperienciaFromExperiences(experiences)

      setApplyData((current) => ({
        ...current,
        nome: candidate.nome,
        email: candidate.email,
        fone: current.fone || formatBrazilianPhone(profile.fone) || '',
        cidadeUf: current.cidadeUf || formatCandidateCityUf(profile.cidade, profile.uf),
        linkedin: current.linkedin || linkedin,
        portfolio: current.portfolio || portfolioUrl,
        cargoAtual: current.cargoAtual || cargoAtual,
        anosExperiencia: current.anosExperiencia || anos,
      }))
    })

    return () => {
      cancelled = true
    }
  }, [ctx.session?.accessToken, ctx.session?.candidate.email, ctx.session?.candidate.id, ctx.session?.candidate.nome, selectedJob?.id])
  const filterOptions = useMemo(() => ({
    area: listUniqueJobValues(jobs, (job) => job.area),
    mode: listUniqueJobValues(jobs, (job) => job.modalidade),
    type: listUniqueJobValues(jobs, (job) => job.tipoContratacao),
    level: listUniqueJobValues(jobs, (job) => job.senioridade),
    location: listUniqueJobValues(jobs, (job) => formatJobLocation(job)).filter((value) => value !== 'Local a definir'),
  }), [jobs])
  const activeFilterCount = [filters.location, filters.mode, filters.type, filters.level, filters.area].filter(Boolean).length
  function openJobApplication(job: PortalJob) {
    if (appliedJobIds.has(job.id)) {
      setApplicationFeedback({
        type: 'success',
        title: 'Você já se candidatou',
        message: `Sua candidatura para "${job.titulo}" já está registrada.`,
      })
      return
    }
    setSelectedJob(job)
  }
  function clearFilters() {
    const next = { q: '', location: '', mode: '', type: '', level: '', area: '', sort: 'recent' }
    setFilters(next)
    void loadJobs(next)
  }
  async function submitApplication(event: FormEvent) {
    event.preventDefault()
    if (!selectedJob) return
    setApplyPending(true)
    setApplyResult(null)
    try {
      const form = new FormData()
      form.append('vagaId', selectedJob.id)
      form.append('nome', applyData.nome)
      form.append('email', applyData.email)
      form.append('fone', applyData.fone)
      form.append('cidadeUf', normalizeCityUfForSubmit(applyData.cidadeUf))
      form.append('linkedin', applyData.linkedin)
      form.append('portfolio', applyData.portfolio)
      form.append('cargoAtual', applyData.cargoAtual)
      form.append('anosExperiencia', applyData.anosExperiencia)
      form.append('observacoes', applyData.observacoes)
      if (applyData.arquivo) {
        form.append('arquivo', applyData.arquivo)
      }
      await fetch(await buildApiUrl('/api/public/candidaturas', ctx.tenantId), {
        method: 'POST',
        headers: {
          'X-Tenant-Id': ctx.tenantId,
        },
        body: form,
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error(await readApiMessage(response))
        }
      })
      setAppliedJobIds((current) => new Set(current).add(selectedJob.id))
      setSelectedJob(null)
      setApplicationFeedback({
        type: 'success',
        title: 'Candidatura enviada',
        message: `Sua candidatura para "${selectedJob.titulo}" foi registrada com sucesso.`,
      })
    } catch (err) {
      setSelectedJob(null)
      setApplicationFeedback({
        type: 'error',
        title: 'Não foi possível enviar',
        message: readError(err),
      })
    } finally {
      setApplyPending(false)
    }
  }
  return (
    <>
      <section className="jobs-board-hero">
        <div className="portal-container jobs-board-hero-inner">
          <div className="jobs-board-heading">
            <h1>Vagas abertas <em>na Liotécnica</em></h1>
            <p>{jobs.length} {jobs.length === 1 ? 'oportunidade disponível' : 'oportunidades disponíveis'} · atualizado hoje</p>
          </div>
          <div className="jobs-board-controls">
            <div className="jobs-board-search">
              <i className="fas fa-search" aria-hidden="true"></i>
              <input
                name="q"
                type="search"
                placeholder="Buscar por cargo, área ou cidade..."
                autoComplete="off"
                value={filters.q}
                onChange={(e) => setFilters((v) => ({ ...v, q: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void loadJobs()
                  }
                }}
              />
            </div>
            <button className="jobs-board-filter-btn" type="button" onClick={() => setShowFilters((v) => !v)}>
              <i className="fas fa-filter" aria-hidden="true"></i>
              Filtros
              {activeFilterCount > 0 ?<span>{activeFilterCount}</span> : null}
            </button>
            <select className="jobs-board-sort" value={filters.sort} onChange={(e) => setFilters((v) => ({ ...v, sort: e.target.value }))}>
              <option value="recent">Mais recentes</option>
              <option value="companyAsc">Empresa (A-Z)</option>
            </select>
            <button className="jobs-board-search-btn" type="button" onClick={() => void loadJobs()}>Buscar</button>
          </div>
          {showFilters ?(
            <section className="jobs-board-filters">
              <JobFilterGroup label="Área" options={filterOptions.area} value={filters.area} onChange={(area) => setFilters((v) => ({ ...v, area }))} />
              <JobFilterGroup label="Localização" options={filterOptions.location} value={filters.location} onChange={(location) => setFilters((v) => ({ ...v, location }))} />
              <JobFilterGroup label="Modalidade" options={filterOptions.mode} value={filters.mode} onChange={(mode) => setFilters((v) => ({ ...v, mode }))} />
              <JobFilterGroup label="Contratação" options={filterOptions.type} value={filters.type} onChange={(type) => setFilters((v) => ({ ...v, type }))} />
              <JobFilterGroup label="Senioridade" options={filterOptions.level} value={filters.level} onChange={(level) => setFilters((v) => ({ ...v, level }))} />
              <div className="jobs-board-filter-actions">
                <span>{activeFilterCount} filtro{activeFilterCount === 1 ? '' : 's'} ativo{activeFilterCount === 1 ? '' : 's'}</span>
                <button type="button" onClick={() => void loadJobs()}>Aplicar filtros</button>
                <button type="button" onClick={clearFilters}>Limpar todos</button>
              </div>
            </section>
          ) : null}
        </div>
      </section>
      <main className="portal-container jobs-board-main">
        {loading ?(
          <section className="jobs-loading-state">
            <div className="loader-ring" aria-hidden="true"></div>
            <p>{message}</p>
          </section>
        ) : null}
        {!loading && error ?(
          <section className="empty-state service-unavailable-state">
            <div className="service-unavailable-icon" aria-hidden="true">
              <i className="fas fa-cloud-slash"></i>
            </div>
            <h3>Portal temporariamente indisponível</h3>
            <p>{error}</p>
            <button className="toolbar-btn toolbar-btn-primary" type="button" onClick={() => void loadJobs()}>Tentar novamente</button>
          </section>
        ) : null}
        {!loading && !error && jobs.length === 0 ?(
          <section className="jobs-board-empty">
            <h3>Nenhuma vaga encontrada</h3>
            <p>Tente remover alguns filtros ou refinar o texto de busca.</p>
            <button type="button" onClick={clearFilters}>Limpar filtros</button>
          </section>
        ) : null}
        {!loading && !error ?(
          <section className="jobs-board-list" aria-label="Vagas abertas">
            {jobs.map((job) => {
              const alreadyApplied = appliedJobIds.has(job.id)
              const tags = buildJobTags(job)
              const badges = buildJobBadgeValues(job)
              const isNew = isRecentJob(job.createdAtUtc)
              return (
                <article
                  className={`jobs-board-row${alreadyApplied ? ' is-applied' : ''}`}
                  key={job.id}
                  onClick={() => openJobApplication(job)}
                  role="button"
                  tabIndex={0}
                  aria-disabled={alreadyApplied}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openJobApplication(job)
                    }
                  }}
                >
                  <div className="jobs-board-row-main">
                    <div className="jobs-board-pills">
                      {job.area ?<span className="jobs-board-pill">{job.area}</span> : null}
                      {badges.slice(0, 3).map((badge) => <span className="jobs-board-pill subtle" key={badge}>{badge}</span>)}
                      {isNew ?<span className="jobs-board-pill accent">Nova</span> : null}
                      {alreadyApplied ?(
                        <span className="jobs-board-pill applied">
                          <i className="fas fa-check" aria-hidden="true"></i>
                          Já candidatado
                        </span>
                      ) : null}
                    </div>
                    <h3>{job.titulo}</h3>
                    <div className="jobs-board-meta">
                      <span><i className="fas fa-location-dot" aria-hidden="true"></i>{formatJobLocation(job)}</span>
                      {job.senioridade ?<span><i className="fas fa-briefcase" aria-hidden="true"></i>{job.senioridade}</span> : null}
                      <span><i className="fas fa-clock" aria-hidden="true"></i>{formatJobDate(job.createdAtUtc)}</span>
                    </div>
                    <div className="jobs-board-tags">
                      {(tags.length ?tags : ['Perfil geral']).slice(0, 5).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="jobs-board-row-side">
                    <small>{job.quantidadeVagas && job.quantidadeVagas > 1 ? `${job.quantidadeVagas} vagas` : '1 vaga'}</small>
                  </div>
                  <button
                    className="jobs-board-details-btn"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      openJobApplication(job)
                    }}
                    disabled={alreadyApplied}
                  >
                    {alreadyApplied ?'Candidatado' : 'Ver detalhes'}
                    <i className={`fas ${alreadyApplied ? 'fa-check' : 'fa-arrow-right'}`} aria-hidden="true"></i>
                  </button>
                </article>
              )
            })}
          </section>
        ) : null}
        {selectedJob ?(
          <div className="modal-backdrop" onClick={() => setSelectedJob(null)}>
            <div className="modal-card application-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="eyebrow">Candidatura rápida</div>
                <button className="application-modal-close" type="button" onClick={() => setSelectedJob(null)} aria-label="Fechar">
                  <i className="fas fa-times" aria-hidden="true"></i>
                </button>
              </div>
              <div className="application-modal-body">
                <JobDetailsPanel job={selectedJob} />
                <section className="application-form-panel" aria-label="Formulário de candidatura">
                  <form className="stack-form" onSubmit={submitApplication}>
                <div className="grid two">
                  <label><span>Nome</span><input value={applyData.nome} onChange={(e) => setApplyData((v) => ({ ...v, nome: e.target.value }))} required readOnly={Boolean(ctx.session)} /></label>
                  <label><span>E-mail</span><input type="email" value={applyData.email} onChange={(e) => setApplyData((v) => ({ ...v, email: e.target.value }))} required readOnly={Boolean(ctx.session)} /></label>
                </div>
                <div className="grid two">
                  <label><span>Telefone</span><input value={applyData.fone} onChange={(e) => setApplyData((v) => ({ ...v, fone: formatBrazilianPhone(e.target.value) }))} readOnly={Boolean(ctx.session)} /></label>
                  <label><span>Cidade / UF</span><input value={applyData.cidadeUf} onChange={(e) => setApplyData((v) => ({ ...v, cidadeUf: e.target.value }))} readOnly={Boolean(ctx.session)} /></label>
                </div>
                <div className="grid two">
                  <label><span>LinkedIn</span><input value={applyData.linkedin} onChange={(e) => setApplyData((v) => ({ ...v, linkedin: e.target.value }))} /></label>
                  <label><span>Portfólio</span><input value={applyData.portfolio} onChange={(e) => setApplyData((v) => ({ ...v, portfolio: e.target.value }))} /></label>
                </div>
                <div className="grid two">
                  <label><span>Cargo atual</span><input value={applyData.cargoAtual} onChange={(e) => setApplyData((v) => ({ ...v, cargoAtual: e.target.value }))} /></label>
                  <label>
                    <span>Anos de experiência</span>
                    <input
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Ex.: 5"
                      value={applyData.anosExperiencia}
                      onChange={(e) => setApplyData((v) => ({ ...v, anosExperiencia: sanitizeAnosExperienciaInput(e.target.value) }))}
                    />
                  </label>
                </div>
                <label><span>Observações</span><textarea rows={4} value={applyData.observacoes} onChange={(e) => setApplyData((v) => ({ ...v, observacoes: e.target.value }))} /></label>
                <label>
                  <span>Currículo (PDF, DOC ou DOCX)</span>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setApplyData((v) => ({ ...v, arquivo: e.target.files?.[0] ?? null }))} />
                </label>
                {applyResult ?<div className={`inline-alert ${applyResult.includes('sucesso') ?'success' : 'error'}`}>{applyResult}</div> : null}
                <button className="primary-btn" type="submit" disabled={applyPending}>{applyPending ?'Enviando...' : 'Enviar candidatura'}</button>
                  </form>
                </section>
              </div>
            </div>
          </div>
        ) : null}
        {applicationFeedback ?(
          <div className="swal-backdrop" role="presentation" onClick={() => setApplicationFeedback(null)}>
            <section
              className={`swal-card ${applicationFeedback.type}`}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="application-feedback-title"
              aria-describedby="application-feedback-message"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="swal-icon" aria-hidden="true">
                <i className={`fas ${applicationFeedback.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i>
              </div>
              <h3 id="application-feedback-title">{applicationFeedback.title}</h3>
              <p id="application-feedback-message">{applicationFeedback.message}</p>
              <button className="primary-btn" type="button" onClick={() => setApplicationFeedback(null)}>
                Entendi
              </button>
            </section>
          </div>
        ) : null}
      </main>
    </>
  )
}

function JobFilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="jobs-board-filter-group">
      <div className="jobs-board-filter-label">{label}</div>
      <div className="jobs-board-filter-options">
        {options.length ?options.map((option) => (
          <label className="jobs-board-check" key={option}>
            <input
              type="checkbox"
              checked={value === option}
              onChange={() => onChange(value === option ? '' : option)}
            />
            <span>{option}</span>
          </label>
        )) : (
          <span className="jobs-board-filter-empty">Sem opções</span>
        )}
      </div>
    </div>
  )
}

function JobDetailsPanel({ job }: { job: PortalJob }) {
  const tags = buildJobTags(job)
  const badges = buildJobBadgeValues(job)
  const etapas = (job.etapas ?? [])
    .map((etapa) => (etapa.nome || '').trim())
    .filter(Boolean)

  return (
    <aside className="application-job-panel" aria-label="Detalhes da vaga">
      <div className="application-job-hero">
        <div className="eyebrow">Detalhes da vaga</div>
        <h4>{job.titulo}</h4>
        <p>{job.tenantName || 'Liotecnica'}</p>
      </div>

      <div className="application-job-meta">
        <DetailItem label="Área" value={job.area || 'Não informado'} />
        <DetailItem label="Local" value={formatJobLocation(job)} />
        <DetailItem label="Vagas" value={`${job.quantidadeVagas || 1}`} />
      </div>

      <div className="application-badge-row">
        {(badges.length ?badges : ['Perfil geral']).map((badge) => (
          <span className="job-tag" key={badge}>{badge}</span>
        ))}
        {job.urgente ?<span className="job-tag urgent">Urgente</span> : null}
      </div>

      <section className="application-detail-section">
        <h5>Descrição</h5>
        <p>{job.descricaoPublica?.trim() || 'Descrição pública não informada para esta vaga.'}</p>
      </section>

      <section className="application-detail-section">
        <h5>Tags e responsabilidades</h5>
        <div className="application-chip-list">
          {(tags.length ?tags : ['Perfil geral']).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </section>

      {etapas.length ?(
        <section className="application-detail-section">
          <h5>Etapas do processo</h5>
          <ol className="application-stage-list">
            {etapas.map((etapa) => <li key={etapa}>{etapa}</li>)}
          </ol>
        </section>
      ) : null}
    </aside>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

type CandidateProfileModalProps = {
  ctx: AuthContext
  onClose: () => void
}

function CandidateProfileModal({ ctx, onClose }: CandidateProfileModalProps) {
  const candidateId = ctx.session?.candidate.id ?? ''
  const authFetch = useMemo(() => createAuthorizedClient(ctx), [ctx])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [profile, setProfile] = useState<PortalProfile | null>(null)
  const [completion, setCompletion] = useState<PortalCompletion | null>(null)
  const [matches, setMatches] = useState<PortalMatchItem[]>([])
  const [portfolio, setPortfolio] = useState<PortalPortfolio | null>(null)
  const [education, setEducation] = useState<PortalEducation | null>(null)
  const [experience, setExperience] = useState<PortalExperienceProject | null>(null)
  const [preferences, setPreferences] = useState<PortalPreferences | null>(null)
  const [accessibility, setAccessibility] = useState<PortalAccessibility | null>(null)
  const [notifications, setNotifications] = useState<PortalNotifications | null>(null)
  const [lgpd, setLgpd] = useState<PortalLgpd | null>(null)
  const [documents, setDocuments] = useState<PortalDocument[]>([])
  const [references, setReferences] = useState<PortalReference[]>([])
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    nome: '',
    email: '',
    fone: '',
    celular: '',
    cidade: '',
    uf: '',
  })
  const [portfolioPrefsForm, setPortfolioPrefsForm] = useState({
    workModel: '',
    availability: '',
    salary: '',
    shift: '',
    note: '',
  })
  const [portfolioLinksForm, setPortfolioLinksForm] = useState({
    linkedin: '',
    github: '',
    portfolio: '',
    drive: '',
  })
  const [skillEditorOpen, setSkillEditorOpen] = useState(false)
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null)
  const [skillDraft, setSkillDraft] = useState({
    tipo: 'Hard',
    nome: '',
    nivel: 'Intermediário',
    evidencia: '',
  })
  const [certEditorOpen, setCertEditorOpen] = useState(false)
  const [editingCertId, setEditingCertId] = useState<string | null>(null)
  const [certDraft, setCertDraft] = useState({
    nome: '',
    instituicao: '',
    ano: '',
    link: '',
  })

  useEffect(() => {
    const { body, documentElement } = document
    const previousBodyOverflow = body.style.overflow
    const previousHtmlOverflow = documentElement.style.overflow
    const previousBodyPaddingRight = body.style.paddingRight
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth

    body.style.overflow = 'hidden'
    documentElement.style.overflow = 'hidden'

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`
    }

    return () => {
      body.style.overflow = previousBodyOverflow
      documentElement.style.overflow = previousHtmlOverflow
      body.style.paddingRight = previousBodyPaddingRight
    }
  }, [])

  async function readProfileSnapshot() {
    const [
      profileData,
      completionData,
      matchesData,
      portfolioData,
      educationData,
      experienceData,
      preferencesData,
      accessibilityData,
      notificationsData,
      documentsData,
      referencesData,
      lgpdData,
    ] = await Promise.all([
      authFetch<PortalProfile>(`/api/public/portal-candidates/${candidateId}`),
      authFetch<PortalCompletion>(`/api/public/portal-candidates/${candidateId}/profile-completion`),
      authFetch<{ matches: PortalMatchItem[] }>(`/api/public/portal-candidates/${candidateId}/job-matches`),
      authFetch<PortalPortfolio>(`/api/public/portal-candidates/${candidateId}/skills-portfolio`),
      authFetch<PortalEducation>(`/api/public/portal-candidates/${candidateId}/education`),
      authFetch<PortalExperienceProject>(`/api/public/portal-candidates/${candidateId}/experience-projects`),
      authFetch<PortalPreferences>(`/api/public/portal-candidates/${candidateId}/preferences`),
      authFetch<PortalAccessibility>(`/api/public/portal-candidates/${candidateId}/accessibility`),
      authFetch<PortalNotifications>(`/api/public/portal-candidates/${candidateId}/notifications`),
      authFetch<{ items: PortalDocument[] }>(`/api/public/portal-candidates/${candidateId}/documents`),
      authFetch<{ items: PortalReference[] }>(`/api/public/portal-candidates/${candidateId}/references`),
      authFetch<PortalLgpd>(`/api/public/portal-candidates/${candidateId}/lgpd`),
    ])

    let avatarUrl: string | null = null
    if (profileData.avatarUrl) {
      try {
        avatarUrl = await fetchAuthorizedBlobUrl(ctx, `/api/public/portal-candidates/${candidateId}/avatar`)
      } catch {
        avatarUrl = null
      }
    }

    return {
      profileData,
      completionData,
      matches: matchesData.matches ?? [],
      portfolioData,
      educationData,
      experienceData,
      preferencesData,
      accessibilityData,
      notificationsData,
      documents: documentsData.items ?? [],
      references: referencesData.items ?? [],
      lgpdData,
      avatarUrl,
    }
  }

  function applyProfileSnapshot(snapshot: Awaited<ReturnType<typeof readProfileSnapshot>>) {
    setProfile(snapshot.profileData)
    setCompletion(snapshot.completionData)
    setMatches(snapshot.matches)
    setPortfolio(snapshot.portfolioData)
    setEducation(snapshot.educationData)
    setExperience(snapshot.experienceData)
    setPreferences(snapshot.preferencesData)
    setAccessibility(snapshot.accessibilityData)
    setNotifications(snapshot.notificationsData)
    setDocuments(snapshot.documents)
    setReferences(snapshot.references)
    setLgpd(snapshot.lgpdData)
    setAvatarPreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
      return snapshot.avatarUrl
    })
    setForm({
      nome: snapshot.profileData.nome ?? '',
      email: snapshot.profileData.email ?? '',
      fone: snapshot.profileData.fone ?? '',
      celular: snapshot.profileData.celular ?? '',
      cidade: snapshot.profileData.cidade ?? '',
      uf: snapshot.profileData.uf ?? '',
    })
  }

  async function refreshProfileModal(options?: { keepMessage?: boolean }) {
    if (!candidateId) return
    setLoading(true)
    if (!options?.keepMessage) setMessage(null)
    try {
      const snapshot = await readProfileSnapshot()
      applyProfileSnapshot(snapshot)
    } catch (err) {
      setMessage(readError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!candidateId) return
    let cancelled = false

    void (async () => {
      setLoading(true)
      setMessage(null)
      try {
        const snapshot = await readProfileSnapshot()
        if (cancelled) return
        applyProfileSnapshot(snapshot)
      } catch (err) {
        if (!cancelled) setMessage(readError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [authFetch, candidateId])

  useEffect(() => {
    setPortfolioPrefsForm({
      workModel: portfolio?.preferences.workModel ?? '',
      availability: portfolio?.preferences.availability ?? '',
      salary: portfolio?.preferences.salary ?? '',
      shift: portfolio?.preferences.shift ?? '',
      note: portfolio?.preferences.note ?? '',
    })
    setPortfolioLinksForm({
      linkedin: portfolio?.links.linkedin ?? '',
      github: portfolio?.links.github ?? '',
      portfolio: portfolio?.links.portfolio ?? '',
      drive: portfolio?.links.drive ?? '',
    })
  }, [portfolio])

  async function saveJson(path: string, payload: unknown, successText: string, method: 'PUT' | 'POST' = 'PUT') {
    try {
      await authFetch(path, {
        method,
        body: JSON.stringify(payload),
      })
      setMessage(successText)
      await refreshProfileModal({ keepMessage: true })
    } catch (err) {
      setMessage(readError(err))
    }
  }

  async function removeItem(path: string, successText: string) {
    try {
      await authFetch(path, { method: 'DELETE' })
      setMessage(successText)
      await refreshProfileModal({ keepMessage: true })
    } catch (err) {
      setMessage(readError(err))
    }
  }

  async function uploadFile(path: string, fieldName: string, file: File, successText: string) {
    const formData = new FormData()
    formData.append(fieldName, file)
    try {
      await authFetch(path, {
        method: 'POST',
        body: formData,
      }, false)
      setMessage(successText)
      await refreshProfileModal({ keepMessage: true })
    } catch (err) {
      setMessage(readError(err))
    }
  }

  function buildPortfolioSummaryPayload(
    prefs = portfolioPrefsForm,
    links = portfolioLinksForm,
  ) {
    return {
      workModel: prefs.workModel,
      availability: prefs.availability,
      salary: prefs.salary,
      shift: prefs.shift,
      note: prefs.note,
      linkedin: links.linkedin,
      github: links.github,
      portfolio: links.portfolio,
      drive: links.drive,
      tags: portfolio?.tags ?? '',
    }
  }

  async function savePortfolioSummary(
    prefs = portfolioPrefsForm,
    links = portfolioLinksForm,
    successText = 'Competências & portfólio atualizados.',
  ) {
    await saveJson(
      `/api/public/portal-candidates/${candidateId}/skills-portfolio`,
      buildPortfolioSummaryPayload(prefs, links),
      successText,
    )
  }

  function openPortfolioLink(url?: string | null) {
    const value = (url ?? '').trim()
    if (!value) {
      setMessage('Nenhum link salvo ainda.')
      return
    }
    window.open(value, '_blank', 'noopener,noreferrer')
  }

  function openSkillEditor(skill?: PortalSkill) {
    setEditingSkillId(skill?.id ?? null)
    setSkillDraft({
      tipo: skill?.tipo ?? 'Hard',
      nome: skill?.nome ?? '',
      nivel: skill?.nivel ?? 'Intermediário',
      evidencia: skill?.evidencia ?? '',
    })
    setSkillEditorOpen(true)
  }

  async function saveSkillEditor() {
    if (!skillDraft.nome.trim()) {
      setMessage('Informe o nome da competência.')
      return
    }
    const path = editingSkillId
      ?`/api/public/portal-candidates/${candidateId}/skills-portfolio/skills/${editingSkillId}`
      : `/api/public/portal-candidates/${candidateId}/skills-portfolio/skills`
    await saveJson(
      path,
      {
        tipo: skillDraft.tipo,
        nome: skillDraft.nome.trim(),
        nivel: skillDraft.nivel,
        evidencia: skillDraft.evidencia.trim(),
      },
      editingSkillId ?'Competência atualizada.' : 'Competência adicionada.',
      editingSkillId ?'PUT' : 'POST',
    )
    setSkillEditorOpen(false)
    setEditingSkillId(null)
  }

  function openCertificationEditor(cert?: PortalCertification) {
    setEditingCertId(cert?.id ?? null)
    setCertDraft({
      nome: cert?.nome ?? '',
      instituicao: cert?.instituicao ?? '',
      ano: cert?.ano ?? '',
      link: cert?.link ?? '',
    })
    setCertEditorOpen(true)
  }

  async function saveCertificationEditor() {
    if (!certDraft.nome.trim()) {
      setMessage('Informe o nome da certificação.')
      return
    }
    const path = editingCertId
      ?`/api/public/portal-candidates/${candidateId}/skills-portfolio/certifications/${editingCertId}`
      : `/api/public/portal-candidates/${candidateId}/skills-portfolio/certifications`
    await saveJson(
      path,
      {
        nome: certDraft.nome.trim(),
        instituicao: certDraft.instituicao.trim(),
        ano: certDraft.ano.trim(),
        link: certDraft.link.trim(),
      },
      editingCertId ?'Certificação atualizada.' : 'Certificação adicionada.',
      editingCertId ?'PUT' : 'POST',
    )
    setCertEditorOpen(false)
    setEditingCertId(null)
  }

  async function handleResetProfile() {
    if (!window.confirm('Tem certeza que deseja limpar o perfil do candidato?')) return
    setMessage(null)
    try {
      await authFetch(`/api/public/portal-candidates/${candidateId}/profile/reset`, { method: 'POST' })
      setSelectedSection(null)
      setMessage('Perfil limpo com sucesso.')
      await refreshProfileModal({ keepMessage: true })
    } catch (err) {
      setMessage(readError(err))
    }
  }

  const matchesCount = matches.length
  const referencesCount = references.length

  const currentRole = portfolio?.preferences.workModel || preferences?.CargoAlvo || 'Perfil em construção'
  const currentLocation = [form.cidade, form.uf].filter(Boolean).join(', ') || 'Localidade não informada'
  const linkedinValue = profile?.linkedinUrl || portfolioLinksForm.linkedin || 'Não informado'
  const clampProgress = (value?: number | null) => Math.max(0, Math.min(100, Math.round(value ?? 0)))
  const countProgress = (count: number) => (count > 0 ?100 : 0)
  const sectionProgress = (key: string, fallback = 0) => clampProgress(completion?.sections?.[key] ?? fallback)

  const primarySectionTiles = [
    { key: 'perfil', label: 'Identidade', sub: 'Dados básicos, avatar e currículo', icon: 'fa-user', value: sectionProgress('perfil', completion?.overall ?? 0), kind: 'percent' as const },
    { key: 'exp', label: 'Experiência & Projetos', sub: 'Histórico profissional e entregas', icon: 'fa-briefcase', value: sectionProgress('exp', countProgress((experience?.experiences.length ?? 0) + (experience?.projects.length ?? 0))), kind: 'percent' as const },
    { key: 'formacao', label: 'Formação & Educação', sub: 'Cursos, instituições e destaques', icon: 'fa-graduation-cap', value: sectionProgress('formacao', countProgress(education?.items.length ?? 0)), kind: 'percent' as const },
    { key: 'comp', label: 'Competências & Portfólio', sub: 'Skills, certificados e links', icon: 'fa-bolt', value: sectionProgress('comp', countProgress((portfolio?.skills.length ?? 0) + (portfolio?.certifications.length ?? 0))), kind: 'percent' as const },
    { key: 'pref', label: 'Preferências / Objetivos', sub: 'Pretensão, benefícios e prioridades', icon: 'fa-bullseye', value: sectionProgress('pref'), kind: 'percent' as const },
    { key: 'notif', label: 'Notificações & Comunicação', sub: 'Canais, alertas e frequência', icon: 'fa-bell', value: sectionProgress('notif'), kind: 'percent' as const },
    { key: 'docs', label: 'Documentos & Anexos', sub: 'Arquivos e comprovantes', icon: 'fa-paperclip', value: documents.length, progress: countProgress(documents.length), kind: 'count' as const },
    { key: 'refs', label: 'Referências', sub: 'Contatos profissionais', icon: 'fa-users', value: referencesCount, progress: countProgress(referencesCount), kind: 'count' as const },
    { key: 'acess', label: 'Acessibilidade & Inclusão', sub: 'Preferências e necessidades de apoio', icon: 'fa-universal-access', value: sectionProgress('acess'), kind: 'percent' as const },
    { key: 'lgpd', label: 'Privacidade / LGPD', sub: 'Consentimentos e retenção de dados', icon: 'fa-shield-alt', value: sectionProgress('lgpd', lgpd?.processarCandidatura ?100 : 0), kind: 'percent' as const },
  ]

  const secondarySectionTiles = [
    { key: 'testes', label: 'Testes', sub: 'Etapas complementares do RH', icon: 'fa-clipboard-check', value: sectionProgress('testes'), kind: 'percent' as const },
    { key: 'hist', label: 'Histórico de candidaturas', sub: 'Acompanhamento das inscrições', icon: 'fa-history', value: sectionProgress('hist'), kind: 'percent' as const },
    { key: 'matches', label: 'Vagas sugeridas', sub: 'Oportunidades com maior aderência', icon: 'fa-star', value: matchesCount, progress: countProgress(matchesCount), kind: 'count' as const },
    { key: 'clear', label: 'Limpar perfil', sub: 'Remover dados auxiliares do perfil', icon: 'fa-eraser', value: 0, progress: 0, kind: 'action' as const },
  ]

  const sectionTiles = [...primarySectionTiles, ...secondarySectionTiles]
  const selectedTile = selectedSection ? sectionTiles.find((tile) => tile.key === selectedSection) ?? null : null
  const tileProgress = (tile: (typeof sectionTiles)[number]) => tile.kind === 'action' ?0 : clampProgress('progress' in tile ?tile.progress : tile.value)
  const tileStatus = (tile: (typeof sectionTiles)[number]) => {
    if (tile.kind === 'action') return 'Ação'
    const progress = tileProgress(tile)
    if (progress === 100) return 'Completo'
    if (progress >= 50) return 'Em andamento'
    if (progress > 0) return 'Iniciado'
    return 'Pendente'
  }

  return (
    <div className="modal-backdrop profile-modal-backdrop">
      <div className="profile-modal-card" onClick={(event) => event.stopPropagation()}>
        <div>
          <div className="profile-modal-header">
            <div className="profile-modal-identity">
              <div className="profile-modal-avatar">
                {avatarPreview ?(
                  <img src={avatarPreview} alt={profile?.nome || 'Avatar do candidato'} />
                ) : (
                  <span>{getInitials(form.nome || ctx.session?.candidate.nome || 'Candidato')}</span>
                )}
              </div>
              <div>
                <h2 className="profile-modal-title">{form.nome || ctx.session?.candidate.nome || 'Meu perfil'}</h2>
                <div className="profile-modal-subtitle">{currentRole} · {currentLocation}</div>
              </div>
            </div>
            <div className="profile-modal-header-actions">
              <button className="profile-modal-action secondary" type="button" onClick={() => void openResumeHtml(authFetch, candidateId)}>
                <i className="fas fa-eye" aria-hidden="true"></i>
                <span>Visualizar currículo</span>
              </button>
              <button className="profile-modal-action primary" type="button" onClick={() => void downloadResumePdf(authFetch, candidateId)}>
                <i className="fas fa-file-pdf" aria-hidden="true"></i>
                <span>Baixar currículo</span>
              </button>
              <button type="button" className="profile-modal-close" onClick={onClose} aria-label="Fechar">
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
          </div>

          <div className="profile-modal-body">
            {message ?<div className={`inline-alert ${message.includes('sucesso') ?'success' : 'error'}`}>{message}</div> : null}
            {loading ?(
              <PageLoading label="Sincronizando seu perfil e suas preferências..." />
            ) : (
              <div className={`profile-modal-grid${selectedSection ?' is-detail' : ''}`}>
                {!selectedSection ?(
                  <section className="profile-overview-panel">
                    <div className="profile-mini-grid">
                      <div className="profile-mini-card">
                        <span>E-mail</span>
                        <strong>{form.email || 'Não informado'}</strong>
                      </div>
                      <div className="profile-mini-card">
                        <span>Telefone</span>
                        <strong>{formatBrazilianPhone(form.fone) || 'Não informado'}</strong>
                      </div>
                      <div className="profile-mini-card">
                        <span>Celular</span>
                        <strong>{formatBrazilianPhone(form.celular) || 'Não informado'}</strong>
                      </div>
                      <div className="profile-mini-card">
                        <span>LinkedIn</span>
                        <strong>{linkedinValue}</strong>
                      </div>
                    </div>

                    <div className="profile-modal-section-heading">
                      <span>Áreas do perfil</span>
                      <strong>{clampProgress(completion?.overall)}% completo</strong>
                    </div>

                    <div className="profile-sections-grid">
                      {primarySectionTiles.map((tile) => {
                        const progress = tileProgress(tile)
                        return (
                          <button
                            className="profile-section-tile"
                            key={tile.key}
                            type="button"
                            onClick={() => setSelectedSection(tile.key)}
                          >
                            <div className="profile-section-topline">
                              <span className="profile-section-icon">
                                <i className={`fas ${tile.icon}`} aria-hidden="true"></i>
                              </span>
                              <span className={`profile-section-status${progress === 100 ?' is-complete' : progress > 0 ?' is-started' : ''}`}>
                                {tileStatus(tile)}
                              </span>
                            </div>
                            <div>
                              <div className="profile-section-label">{tile.label}</div>
                              <div className="profile-section-subtitle">{tile.sub}</div>
                            </div>
                            <div className="profile-section-progress" aria-hidden="true">
                              <span style={{ width: `${progress}%` }}></span>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    <div className="profile-secondary-area">
                      <div className="profile-modal-section-heading compact">
                        <span>Ações complementares</span>
                      </div>
                      <div className="profile-secondary-grid">
                        {secondarySectionTiles.map((tile) => (
                          <button
                            className={`profile-secondary-tile${tile.kind === 'action' ?' danger' : ''}`}
                            key={tile.key}
                            type="button"
                            onClick={() => setSelectedSection(tile.key)}
                          >
                            <i className={`fas ${tile.icon}`} aria-hidden="true"></i>
                            <span>{tile.label}</span>
                            {tile.kind !== 'action' ?<strong>{tile.kind === 'percent' ?`${tile.value}%` : tile.value}</strong> : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>
                ) : (
                  <section className="profile-right-panel is-detail">
                    <div className="profile-section-detail">
                      {selectedSection !== 'comp' ?(
                        <div className="profile-section-detail-head">
                          <div>
                            <div className="profile-section-detail-title">{selectedTile?.label}</div>
                            <div className="profile-section-detail-subtitle">{selectedTile?.sub || 'Detalhes da seção selecionada.'}</div>
                          </div>
                          <button className="profile-back-button" type="button" onClick={() => setSelectedSection(null)}>
                            <i className="fas fa-arrow-left" aria-hidden="true"></i>
                            <span>Todas as áreas</span>
                          </button>
                        </div>
                      ) : null}

                      {selectedSection === 'perfil' ?(
                        <div className="profile-section-detail-body">
                          <div className="profile-shell">
                            <div className="avatar-plate">
                              {avatarPreview ?<img src={avatarPreview} alt={profile?.nome || 'Avatar do candidato'} /> : <span>{getInitials(profile?.nome || ctx.session?.candidate.nome || 'Candidato')}</span>}
                            </div>
                            <label className="upload-label">
                              Alterar avatar
                              <input type="file" accept="image/*" onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (file) void uploadFile(`/api/public/portal-candidates/${candidateId}/avatar`, 'arquivo', file, 'Avatar atualizado.')
                              }} />
                            </label>
                          </div>

                          <RecordForm
                            fields={[
                              field('Nome', profile?.nome),
                              field('Telefone', profile?.fone),
                              field('Celular', profile?.celular),
                              field('Cidade', profile?.cidade),
                              field('UF', profile?.uf),
                              field('LinkedIn', profile?.linkedinUrl),
                              field('Resumo', profile?.resumoProfissional, 'textarea'),
                            ]}
                            onSubmit={(values) => void saveJson(`/api/public/portal-candidates/${candidateId}`, {
                              nome: values.Nome,
                              fone: values.Telefone,
                              celular: values.Celular,
                              cidade: values.Cidade,
                              uf: values.UF,
                              linkedinUrl: values.LinkedIn,
                              resumoProfissional: values.Resumo,
                            }, 'Perfil atualizado.')}
                          />

                          <div className="toolbar-row">
                            <label className="upload-label">
                              Enviar currículo
                              <input type="file" accept=".pdf,.doc,.docx" onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (file) void uploadFile(`/api/public/portal-candidates/${candidateId}/curriculos`, 'arquivo', file, 'Currículo enviado.')
                              }} />
                            </label>
                            <label className="upload-label">
                              Parsear currículo
                              <input type="file" accept=".pdf,.doc,.docx" onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (!file) return
                                const formData = new FormData()
                                formData.append('arquivo', file)
                                void authFetch<Record<string, unknown>>(`/api/public/portal-candidates/${candidateId}/parse-resume`, { method: 'POST', body: formData }, false)
                                  .then(() => setMessage('Currículo processado com sucesso.'))
                                  .catch((err) => setMessage(readError(err)))
                              }} />
                            </label>
                          </div>
                        </div>
                      ) : null}

                      {selectedSection === 'testes' ?(
                        <div className="profile-section-detail-body">
                          <div className="detail-group">
                            <div className="detail-group-title">Testes de RH</div>
                            <p className="detail-paragraph">
                              Complete os testes para enriquecer seu perfil e aumentar o match com as vagas.
                            </p>
                            <div className="detail-callout">
                              <strong>Status atual:</strong> {completion?.sections?.testes ?? 0}% preenchido.
                            </div>
                          </div>
                          <div className="detail-group">
                            <div className="detail-group-title">Privacidade</div>
                            <p className="detail-paragraph">
                              No MVP React, os testes ainda serão trazidos em detalhe como no .NET. A estrutura da seção e o fluxo de navegação já foram espelhados.
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {selectedSection === 'comp' ?(
                        <div className="profile-section-detail-body">
                          <div className="profile-detail-toolbar">
                            <div>
                              <div className="profile-section-detail-title">Competências & Portfólio</div>
                              <div className="profile-section-detail-subtitle">Organize skills, idiomas, certificados e links.</div>
                            </div>
                            <div className="profile-detail-toolbar-actions">
                              <button className="profile-back-button" type="button" onClick={() => setSelectedSection(null)}>
                                <i className="fas fa-arrow-left" aria-hidden="true"></i>
                                <span>Voltar às seções</span>
                              </button>
                              <button className="profile-clear-button" type="button" onClick={() => void saveJson(`/api/public/portal-candidates/${candidateId}/skills-portfolio`, {
                                workModel: '',
                                availability: '',
                                salary: '',
                                shift: '',
                                note: '',
                                linkedin: '',
                                github: '',
                                portfolio: '',
                                drive: '',
                                tags: '',
                              }, 'Competências & portfólio limpos.')}>
                                <i className="fas fa-eraser" aria-hidden="true"></i>
                                <span>Limpar</span>
                              </button>
                            </div>
                          </div>

                          <div className="profile-skill-top-grid">
                            <section className="profile-skill-card">
                              <div className="profile-skill-card-title"><i className="fas fa-briefcase" aria-hidden="true"></i><span>Preferências</span></div>
                              <div className="profile-skill-fields-grid">
                                <label className="profile-mini-field">
                                  <span>Modelo de trabalho</span>
                                  <select
                                    value={portfolioPrefsForm.workModel}
                                    onChange={(e) => setPortfolioPrefsForm((v) => ({ ...v, workModel: e.target.value }))}
                                    onBlur={() => void savePortfolioSummary()}
                                  >
                                    <option value="">Selecionar</option>
                                    <option value="Presencial">Presencial</option>
                                    <option value="Híbrido">Híbrido</option>
                                    <option value="Remoto">Remoto</option>
                                  </select>
                                </label>
                                <label className="profile-mini-field">
                                  <span>Disponibilidade</span>
                                  <select
                                    value={portfolioPrefsForm.availability}
                                    onChange={(e) => setPortfolioPrefsForm((v) => ({ ...v, availability: e.target.value }))}
                                    onBlur={() => void savePortfolioSummary()}
                                  >
                                    <option value="">Selecionar</option>
                                    <option value="Imediata">Imediata</option>
                                    <option value="Até 15 dias">Até 15 dias</option>
                                    <option value="Até 30 dias">Até 30 dias</option>
                                    <option value="A combinar">A combinar</option>
                                  </select>
                                </label>
                                <label className="profile-mini-field">
                                  <span>Pretensão (R$)</span>
                                  <input
                                    placeholder="Ex.: 4500"
                                    value={portfolioPrefsForm.salary}
                                    onChange={(e) => setPortfolioPrefsForm((v) => ({ ...v, salary: e.target.value }))}
                                    onBlur={() => void savePortfolioSummary()}
                                  />
                                </label>
                                <label className="profile-mini-field">
                                  <span>Turno</span>
                                  <select
                                    value={portfolioPrefsForm.shift}
                                    onChange={(e) => setPortfolioPrefsForm((v) => ({ ...v, shift: e.target.value }))}
                                    onBlur={() => void savePortfolioSummary()}
                                  >
                                    <option value="">Selecionar</option>
                                    <option value="Diurno">Diurno</option>
                                    <option value="Noturno">Noturno</option>
                                    <option value="Escala">Escala</option>
                                    <option value="A combinar">A combinar</option>
                                  </select>
                                </label>
                                <label className="profile-mini-field profile-mini-field-full">
                                  <span>Observação</span>
                                  <input
                                    placeholder="Ex.: Disponível para viagens"
                                    value={portfolioPrefsForm.note}
                                    onChange={(e) => setPortfolioPrefsForm((v) => ({ ...v, note: e.target.value }))}
                                    onBlur={() => void savePortfolioSummary()}
                                  />
                                </label>
                              </div>
                            </section>

                            <section className="profile-skill-card">
                              <div className="profile-skill-card-title"><i className="fas fa-link" aria-hidden="true"></i><span>Links de portfólio</span></div>
                              <div className="profile-skill-fields-grid">
                                <label className="profile-mini-field">
                                  <span>LinkedIn</span>
                                  <input
                                    placeholder="https://linkedin.com/in/..."
                                    value={portfolioLinksForm.linkedin}
                                    onChange={(e) => setPortfolioLinksForm((v) => ({ ...v, linkedin: e.target.value }))}
                                    onBlur={() => void savePortfolioSummary()}
                                  />
                                </label>
                                <label className="profile-mini-field">
                                  <span>GitHub</span>
                                  <input
                                    placeholder="https://github.com/..."
                                    value={portfolioLinksForm.github}
                                    onChange={(e) => setPortfolioLinksForm((v) => ({ ...v, github: e.target.value }))}
                                    onBlur={() => void savePortfolioSummary()}
                                  />
                                </label>
                                <label className="profile-mini-field">
                                  <span>Portfólio</span>
                                  <input
                                    placeholder="https://..."
                                    value={portfolioLinksForm.portfolio}
                                    onChange={(e) => setPortfolioLinksForm((v) => ({ ...v, portfolio: e.target.value }))}
                                    onBlur={() => void savePortfolioSummary()}
                                  />
                                </label>
                                <label className="profile-mini-field">
                                  <span>Drive / Certificados</span>
                                  <input
                                    placeholder="https://drive.google.com/..."
                                    value={portfolioLinksForm.drive}
                                    onChange={(e) => setPortfolioLinksForm((v) => ({ ...v, drive: e.target.value }))}
                                    onBlur={() => void savePortfolioSummary()}
                                  />
                                </label>
                                <div className="profile-link-actions">
                                  <button className="profile-link-button" type="button" onClick={() => openPortfolioLink(portfolioLinksForm.linkedin)}>
                                    <i className="fab fa-linkedin" aria-hidden="true"></i><span>Abrir LinkedIn</span>
                                  </button>
                                  <button className="profile-link-button" type="button" onClick={() => openPortfolioLink(portfolioLinksForm.github)}>
                                    <i className="fab fa-github" aria-hidden="true"></i><span>Abrir GitHub</span>
                                  </button>
                                  <button className="profile-link-button" type="button" onClick={() => openPortfolioLink(portfolioLinksForm.portfolio)}>
                                    <i className="fas fa-globe" aria-hidden="true"></i><span>Abrir Portfólio</span>
                                  </button>
                                  <button className="profile-link-button" type="button" onClick={() => openPortfolioLink(portfolioLinksForm.drive)}>
                                    <i className="fab fa-google-drive" aria-hidden="true"></i><span>Abrir Drive</span>
                                  </button>
                                </div>
                              </div>
                            </section>
                          </div>

                          <section className="profile-block-card">
                            <div className="profile-block-head">
                              <div className="profile-block-title">
                                <i className="fas fa-tools" aria-hidden="true"></i>
                                <span>Competências</span>
                                <small>(Hard/Soft/Idiomas)</small>
                              </div>
                              <button className="profile-add-button" type="button" onClick={() => openSkillEditor()}>
                                <i className="fas fa-plus" aria-hidden="true"></i><span>Adicionar</span>
                              </button>
                            </div>
                            {portfolio?.skills?.length ?(
                              <div className="profile-chip-list">
                                {portfolio.skills.map((skill) => (
                                  <button key={skill.id} className="profile-skill-chip" type="button" onClick={() => openSkillEditor(skill)}>
                                    <span className="profile-skill-chip-main">{skill.nome}</span>
                                    <span className="profile-skill-chip-meta">{skill.nivel}</span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="profile-empty-note">Nenhuma competência adicionada ainda.</div>
                            )}
                          </section>

                          <section className="profile-block-card">
                            <div className="profile-block-head">
                              <div className="profile-block-title">
                                <i className="fas fa-certificate" aria-hidden="true"></i>
                                <span>Certificações & Cursos</span>
                              </div>
                              <button className="profile-add-button" type="button" onClick={() => openCertificationEditor()}>
                                <i className="fas fa-plus" aria-hidden="true"></i><span>Adicionar</span>
                              </button>
                            </div>
                            {portfolio?.certifications?.length ?(
                              <div className="profile-cert-list">
                                {portfolio.certifications.map((cert) => (
                                  <article className="profile-cert-item" key={cert.id}>
                                    <div>
                                      <strong>{cert.nome}</strong>
                                      <p>{[cert.instituicao, cert.ano].filter(Boolean).join(' • ') || 'Sem detalhes adicionais'}</p>
                                    </div>
                                    <div className="profile-cert-actions">
                                      <button className="ghost-btn" type="button" onClick={() => openCertificationEditor(cert)}>Editar</button>
                                      <button className="ghost-btn danger" type="button" onClick={() => void removeItem(`/api/public/portal-candidates/${candidateId}/skills-portfolio/certifications/${cert.id}`, 'Certificação removida.')}>Remover</button>
                                    </div>
                                  </article>
                                ))}
                              </div>
                            ) : (
                              <div className="profile-empty-note">Nenhum curso/certificação informado ainda.</div>
                            )}
                          </section>
                        </div>
                      ) : null}

                      {selectedSection === 'formacao' ?(
                        <div className="profile-section-detail-body">
                          <div className="subsection-card">
                            <div className="subsection-head">
                              <strong>Resumo da formação</strong>
                            </div>
                            <RecordForm
                              fields={[
                                fieldSelect('nivel', education?.summary.nivel, EDUCATION_SUMMARY_NIVEL_PRESETS, 'Nível'),
                                field('areaPrincipal', education?.summary.areaPrincipal, 'input', 'Área principal'),
                                fieldSelect('situacao', education?.summary.situacao, EDUCATION_SUMMARY_SITUACAO_PRESETS, 'Situação'),
                                fieldDate('dataConclusao', education?.summary.dataConclusao, 'Data de conclusão'),
                                field('destaques', education?.summary.destaques, 'textarea', 'Destaques'),
                              ]}
                              onSubmit={(values) => void saveJson(`/api/public/portal-candidates/${candidateId}/education`, values, 'Resumo educacional salvo.')}
                              submitLabel="Salvar resumo"
                              submitButtonClassName="secondary-btn"
                            />
                          </div>
                          <EducationRepeaterSection
                            title="Cursos e formações"
                            items={education?.items ?? []}
                            describe={(item) =>
                              [
                                item.instituicao || 'Instituição livre',
                                item.status || 'Status aberto',
                                [item.inicio, item.fim].filter(Boolean).join(' “ '),
                              ]
                                .filter((part) => Boolean(part && String(part).trim()))
                                .join(' • ')
                            }
                            onAdd={(values) => void saveJson(`/api/public/portal-candidates/${candidateId}/education/items`, values, 'Formação adicionada.', 'POST')}
                            onUpdate={(item, values) =>
                              void saveJson(`/api/public/portal-candidates/${candidateId}/education/items/${item.id}`, values, 'Formação atualizada.')
                            }
                            onDelete={(item) => void removeItem(`/api/public/portal-candidates/${candidateId}/education/items/${item.id}`, 'Formação removida.')}
                            setAnnouncement={setMessage}
                          />
                        </div>
                      ) : null}

                      {selectedSection === 'exp' ?(
                        <div className="profile-section-detail-body">
                          <RepeaterSection
                            title="Experiências"
                            items={experience?.experiences ?? []}
                            describe={(item) => `${item.cargo} • ${item.inicio || '?'} a ${item.fim || 'atual'}`}
                            fields={[
                              { name: 'empresa', label: 'Empresa' },
                              { name: 'cargo', label: 'Cargo' },
                              { name: 'inicio', label: 'Inicio' },
                              { name: 'fim', label: 'Fim' },
                              { name: 'local', label: 'Local / modelo' },
                              { name: 'atividades', label: 'Atividades' },
                            ]}
                            onAdd={(values) => void saveJson(`/api/public/portal-candidates/${candidateId}/experiences`, values, 'Experiencia adicionada.', 'POST')}
                            onDelete={(item) => void removeItem(`/api/public/portal-candidates/${candidateId}/experiences/${item.id}`, 'Experiencia removida.')}
                          />

                          <RepeaterSection
                            title="Projetos"
                            items={experience?.projects ?? []}
                            describe={(item) => `${item.periodo || 'Período livre'} • ${item.stack || 'Stack aberta'}`}
                            fields={[
                              { name: 'nome', label: 'Nome' },
                              { name: 'periodo', label: 'Período' },
                              { name: 'descricao', label: 'Descrição' },
                              { name: 'link', label: 'Link' },
                              { name: 'stack', label: 'Stack' },
                              { name: 'destaques', label: 'Destaques' },
                            ]}
                            onAdd={(values) => void saveJson(`/api/public/portal-candidates/${candidateId}/projects`, values, 'Projeto adicionado.', 'POST')}
                            onDelete={(item) => void removeItem(`/api/public/portal-candidates/${candidateId}/projects/${item.id}`, 'Projeto removido.')}
                          />
                        </div>
                      ) : null}

                      {selectedSection === 'lgpd' ?(
                        <div className="profile-section-detail-body">
                          <CandidateLgpdWorkspaceForm
                            data={lgpd}
                            onSubmit={(payload) => void saveJson(`/api/public/portal-candidates/${candidateId}/lgpd`, payload, 'Preferências LGPD atualizadas.')}
                            onOpenReceipt={() => void openLgpdReceipt(authFetch, candidateId)}
                          />
                        </div>
                      ) : null}

                      {selectedSection === 'pref' ?(
                        <div className="profile-section-detail-body">
                          <RecordForm
                            fields={[
                              field('CargoAlvo', asString(preferences?.CargoAlvo)),
                              field('Senioridade', asString(preferences?.Senioridade)),
                              field('InicioDisponivel', asString(preferences?.InicioDisponivel)),
                              field('Resumo', asString(preferences?.Resumo), 'textarea'),
                              field('AreasInteresse', asString(preferences?.AreasInteresse)),
                              field('ModeloTrabalho', asString(preferences?.ModeloTrabalho)),
                              field('Jornada', asString(preferences?.Jornada)),
                              field('TipoContrato', asString(preferences?.TipoContrato)),
                              field('Viagens', asString(preferences?.Viagens)),
                              field('Mudanca', asString(preferences?.Mudanca)),
                              field('CidadePreferida', asString(preferences?.CidadePreferida)),
                              field('DistanciaMaxKm', asString(preferences?.DistanciaMaxKm)),
                              field('ObsDeslocamento', asString(preferences?.ObsDeslocamento)),
                              field('PretensaoSalarial', asString(preferences?.PretensaoSalarial)),
                              field('PretensaoNegociavel', asString(preferences?.PretensaoNegociavel)),
                              field('BeneficiosDesejados', asString(preferences?.BeneficiosDesejados)),
                              field('NaoAbreMaoDe', asString(preferences?.NaoAbreMaoDe)),
                            ]}
                            onSubmit={(values) => void saveJson(`/api/public/portal-candidates/${candidateId}/preferences`, values, 'Preferências salvas.')}
                          />
                        </div>
                      ) : null}

                      {selectedSection === 'docs' ?(
                        <div className="profile-section-detail-body">
                          <RepeaterSection
                            title="Documentos"
                            items={documents}
                            describe={(item) => `${item.tipo} • ${item.data || 'Sem data'}${item.fileName ?` • ${item.fileName}` : ''}`}
                            fields={[
                              { name: 'tipo', label: 'Tipo' },
                              { name: 'nome', label: 'Nome' },
                              { name: 'link', label: 'Link' },
                              { name: 'data', label: 'Data' },
                              { name: 'observacoes', label: 'Observações' },
                              { name: 'fileName', label: 'Nome do arquivo' },
                            ]}
                            onAdd={(values) => void saveJson(`/api/public/portal-candidates/${candidateId}/documents`, values, 'Documento salvo.', 'POST')}
                            onDelete={(item) => void removeItem(`/api/public/portal-candidates/${candidateId}/documents/${item.id}`, 'Documento removido.')}
                          />
                        </div>
                      ) : null}

                      {selectedSection === 'refs' ?(
                        <div className="profile-section-detail-body">
                          <RepeaterSection
                            title="Referências"
                            items={references}
                            describe={(item) => `${item.relacao || 'Relação livre'} • ${item.contato || 'Contato não informado'}`}
                            fields={[
                              { name: 'nome', label: 'Nome' },
                              { name: 'relacao', label: 'Relação' },
                              { name: 'empresa', label: 'Empresa' },
                              { name: 'cargo', label: 'Cargo' },
                              { name: 'contato', label: 'Contato' },
                              { name: 'periodo', label: 'Período' },
                              { name: 'linkedin', label: 'LinkedIn' },
                              { name: 'observacoes', label: 'Observações' },
                              { name: 'podeContatar', label: 'Pode contatar?(true/false)' },
                            ]}
                            onAdd={(values) => void saveJson(`/api/public/portal-candidates/${candidateId}/references`, {
                              ...values,
                              podeContatar: Boolean(values.podeContatar),
                            }, 'Referência salva.', 'POST')}
                            onDelete={(item) => void removeItem(`/api/public/portal-candidates/${candidateId}/references/${item.id}`, 'Referência removida.')}
                          />
                        </div>
                      ) : null}

                      {selectedSection === 'acess' ?(
                        <div className="profile-section-detail-body">
                          <RecordForm
                            fields={[
                              field('idioma', accessibility?.idioma),
                              field('canal', accessibility?.canal),
                              field('melhorHorario', accessibility?.melhorHorario),
                              field('observacoesComunicacao', accessibility?.observacoesComunicacao, 'textarea'),
                              field('detalhesNecessidades', accessibility?.detalhesNecessidades, 'textarea'),
                              field('pcdIdentificacao', accessibility?.pcdIdentificacao),
                              field('pcdTipo', accessibility?.pcdTipo),
                              field('pcdComprovacao', accessibility?.pcdComprovacao),
                              field('pcdObservacoes', accessibility?.pcdObservacoes, 'textarea'),
                            ]}
                            checks={[
                              check('precisaLegendas', accessibility?.precisaLegendas),
                              check('precisaInterprete', accessibility?.precisaInterprete),
                              check('precisaLeitorTela', accessibility?.precisaLeitorTela),
                              check('precisaBaixaEstimulo', accessibility?.precisaBaixaEstimulo),
                              check('precisaMobilidade', accessibility?.precisaMobilidade),
                              check('precisaTempoExtra', accessibility?.precisaTempoExtra),
                              check('consentimentoPcd', accessibility?.consentimentoPcd),
                            ]}
                            onSubmit={(values) => void saveJson(`/api/public/portal-candidates/${candidateId}/accessibility`, values, 'Acessibilidade atualizada.')}
                          />
                        </div>
                      ) : null}

                      {selectedSection === 'hist' ?(
                        <div className="profile-section-detail-body">
                          <div className="detail-group">
                            <div className="detail-group-title">Histórico de candidaturas</div>
                            <div className="detail-callout">
                              <strong>Paridade em andamento:</strong> a timeline detalhada entra na próxima rodada, mas o fluxo do modal já está alinhado com o .NET.
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {selectedSection === 'notif' ?(
                        <div className="profile-section-detail-body">
                          <CandidateNotificationsWorkspaceForm
                            data={notifications}
                            onSubmit={(payload) => void saveJson(`/api/public/portal-candidates/${candidateId}/notifications`, payload, 'Notificações atualizadas.')}
                          />
                        </div>
                      ) : null}

                      {selectedSection === 'matches' ?(
                        <div className="profile-section-detail-body">
                          <div className="detail-group">
                            <div className="detail-group-title">Vagas sugeridas</div>
                            {matches.length ?(
                              <div className="detail-match-list">
                                {matches.map((match) => (
                                  <article className="detail-match-card" key={match.vagaId}>
                                    <div>
                                      <strong>{match.title || 'Vaga sem t?tulo'}</strong>
                                      <p>{match.area || '?rea n?o informada'} ? {match.city || 'Cidade'} {match.uf || ''}</p>
                                    </div>
                                    <span>{match.score}%</span>
                                  </article>
                                ))}
                              </div>
                            ) : (
                              <p className="detail-paragraph">Nenhuma vaga sugerida no momento.</p>
                            )}
                          </div>
                        </div>
                      ) : null}

                      {selectedSection === 'clear' ?(
                        <div className="profile-section-detail-body">
                          <div className="detail-group">
                            <div className="detail-group-title">Limpar perfil</div>
                            <p className="detail-paragraph">
                              Use esta ação para limpar os dados auxiliares do perfil, como no portal .NET.
                            </p>
                            <button className="profile-danger-button" type="button" onClick={() => void handleResetProfile()}>
                              <i className="fas fa-eraser" aria-hidden="true"></i>
                              <span>Limpar perfil</span>
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>

          {skillEditorOpen ?(
            <div className="profile-inline-modal-backdrop" onClick={() => setSkillEditorOpen(false)}>
              <div className="profile-inline-modal-card" onClick={(event) => event.stopPropagation()}>
                <div className="profile-inline-modal-header">
                  <h3>Competência</h3>
                  <button type="button" className="profile-modal-close" onClick={() => setSkillEditorOpen(false)} aria-label="Fechar">
                    <i className="fas fa-times" aria-hidden="true"></i>
                  </button>
                </div>
                <div className="profile-inline-modal-body">
                  <label className="profile-mini-field">
                    <span>Tipo</span>
                    <select value={skillDraft.tipo} onChange={(e) => setSkillDraft((v) => ({ ...v, tipo: e.target.value }))}>
                      <option value="Hard">Hard skill</option>
                      <option value="Soft">Soft skill</option>
                      <option value="Idioma">Idioma</option>
                    </select>
                  </label>
                  <label className="profile-mini-field">
                    <span>Nome</span>
                    <input value={skillDraft.nome} onChange={(e) => setSkillDraft((v) => ({ ...v, nome: e.target.value }))} placeholder="Ex.: Excel, Comunicação, Inglês" />
                  </label>
                  <label className="profile-mini-field">
                    <span>Nível</span>
                    <select value={skillDraft.nivel} onChange={(e) => setSkillDraft((v) => ({ ...v, nivel: e.target.value }))}>
                      <option value="Básico">Básico</option>
                      <option value="Intermediário">Intermediário</option>
                      <option value="Avançado">Avançado</option>
                    </select>
                  </label>
                  <label className="profile-mini-field">
                    <span>Evidência (opcional)</span>
                    <input value={skillDraft.evidencia} onChange={(e) => setSkillDraft((v) => ({ ...v, evidencia: e.target.value }))} placeholder="Ex.: Projeto X, curso Y" />
                  </label>
                </div>
                <div className="profile-inline-modal-footer">
                  <button className="profile-modal-footer-btn secondary" type="button" onClick={() => setSkillEditorOpen(false)}>Cancelar</button>
                  <button className="profile-modal-footer-btn primary" type="button" onClick={() => void saveSkillEditor()}>Salvar</button>
                </div>
              </div>
            </div>
          ) : null}

          {certEditorOpen ?(
            <div className="profile-inline-modal-backdrop" onClick={() => setCertEditorOpen(false)}>
              <div className="profile-inline-modal-card" onClick={(event) => event.stopPropagation()}>
                <div className="profile-inline-modal-header">
                  <h3>Certificação / Curso</h3>
                  <button type="button" className="profile-modal-close" onClick={() => setCertEditorOpen(false)} aria-label="Fechar">
                    <i className="fas fa-times" aria-hidden="true"></i>
                  </button>
                </div>
                <div className="profile-inline-modal-body">
                  <label className="profile-mini-field">
                    <span>Nome</span>
                    <input value={certDraft.nome} onChange={(e) => setCertDraft((v) => ({ ...v, nome: e.target.value }))} placeholder="Ex.: NR-10, Excel Avançado" />
                  </label>
                  <div className="profile-inline-modal-grid">
                    <label className="profile-mini-field">
                      <span>Instituição</span>
                      <input value={certDraft.instituicao} onChange={(e) => setCertDraft((v) => ({ ...v, instituicao: e.target.value }))} placeholder="Ex.: SENAI" />
                    </label>
                    <label className="profile-mini-field">
                      <span>Ano</span>
                      <input value={certDraft.ano} onChange={(e) => setCertDraft((v) => ({ ...v, ano: e.target.value }))} placeholder="Ex.: 2025" />
                    </label>
                  </div>
                  <label className="profile-mini-field">
                    <span>Link (opcional)</span>
                    <input value={certDraft.link} onChange={(e) => setCertDraft((v) => ({ ...v, link: e.target.value }))} placeholder="https://..." />
                  </label>
                </div>
                <div className="profile-inline-modal-footer">
                  <button className="profile-modal-footer-btn secondary" type="button" onClick={() => setCertEditorOpen(false)}>Cancelar</button>
                  <button className="profile-modal-footer-btn primary" type="button" onClick={() => void saveCertificationEditor()}>Salvar</button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="profile-modal-footer">
            <span className="profile-modal-lgpd-note">Suas informações são privadas e protegidas pela LGPD.</span>
            <button className="profile-modal-footer-btn primary" type="button" onClick={onClose} disabled={loading}>
              Concluir
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CandidateWorkspace({ ctx }: { ctx: AuthContext }) {
  const navigate = useNavigate()
  const location = useLocation()
  const candidateId = ctx.session?.candidate.id ?? ''
  const [activeWorkspaceSection, setActiveWorkspaceSection] = useState<WorkspaceSectionId>(() => normalizeWorkspaceSection(window.location.hash))
  const [state, setState] = useState<WorkspaceState>({
    profile: null,
    completion: null,
    matches: [],
    portfolio: null,
    education: null,
    experience: null,
    preferences: null,
    accessibility: null,
    notifications: null,
    internalNotifications: null,
    documents: [],
    references: [],
    lgpd: null,
  })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [uploadFeedback, setUploadFeedback] = useState<{
    title: string
    message: string
  } | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [resumeParsePreview, setResumeParsePreview] = useState<string>('')
  const authFetch = useMemo(() => createAuthorizedClient(ctx), [ctx])

  async function refreshWorkspace() {
    if (!candidateId) return

    setLoading(true)
    setMessage(null)

    try {
      const [profile, completion, matches, portfolio, education, experience, preferences, accessibility, notifications, internalNotifications, documents, references, lgpd] = await Promise.all([
        authFetch<PortalProfile>(`/api/public/portal-candidates/${candidateId}`),
        authFetch<PortalCompletion>(`/api/public/portal-candidates/${candidateId}/profile-completion`),
        authFetch<{ matches: PortalMatchItem[] }>(`/api/public/portal-candidates/${candidateId}/job-matches`),
        authFetch<PortalPortfolio>(`/api/public/portal-candidates/${candidateId}/skills-portfolio`),
        authFetch<PortalEducation>(`/api/public/portal-candidates/${candidateId}/education`),
        authFetch<PortalExperienceProject>(`/api/public/portal-candidates/${candidateId}/experience-projects`),
        authFetch<PortalPreferences>(`/api/public/portal-candidates/${candidateId}/preferences`),
        authFetch<PortalAccessibility>(`/api/public/portal-candidates/${candidateId}/accessibility`),
        authFetch<PortalNotifications>(`/api/public/portal-candidates/${candidateId}/notifications`),
        authFetch<PortalInternalNotificationsResponse>(`/api/public/portal-candidates/${candidateId}/portal-notifications`),
        authFetch<{ items: PortalDocument[] }>(`/api/public/portal-candidates/${candidateId}/documents`),
        authFetch<{ items: PortalReference[] }>(`/api/public/portal-candidates/${candidateId}/references`),
        authFetch<PortalLgpd>(`/api/public/portal-candidates/${candidateId}/lgpd`),
      ])

      setState({
        profile,
        completion,
        matches: matches.matches ?? [],
        portfolio,
        education,
        experience,
        preferences,
        accessibility,
        notifications,
        internalNotifications,
        documents: documents.items ?? [],
        references: references.items ?? [],
        lgpd,
      })

      if (profile.avatarUrl) {
        try {
          const url = await fetchAuthorizedBlobUrl(ctx, `/api/public/portal-candidates/${candidateId}/avatar`)
          setAvatarPreview((prev) => {
            if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
            return url
          })
        } catch {
          setAvatarPreview((prev) => {
            if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
            return null
          })
        }
      } else {
        setAvatarPreview((prev) => {
          if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev)
          return null
        })
      }
    } catch (err) {
      setMessage(readError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshWorkspace()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId])

  useEffect(() => {
    setActiveWorkspaceSection(normalizeWorkspaceSection(location.hash))
  }, [location.hash])

  function selectWorkspaceSection(sectionId: WorkspaceSectionId) {
    setActiveWorkspaceSection(sectionId)
    window.history.replaceState(null, '', `${location.pathname}${location.search}#${sectionId}`)
  }

  async function saveJson(path: string, payload: unknown, successText: string, method: 'PUT' | 'POST' = 'PUT') {
    try {
      await authFetch(path, {
        method,
        body: JSON.stringify(payload),
      })
      setMessage(successText)
      await refreshWorkspace()
    } catch (err) {
      setMessage(readError(err))
    }
  }

  async function updateInternalNotification(notificationId: string, action: 'read' | 'resolve') {
    try {
      await authFetch(`/api/public/portal-candidates/${candidateId}/portal-notifications/${notificationId}/${action}`, {
        method: 'POST',
      })
      setMessage(action === 'resolve' ? 'Mensagem do RH marcada como resolvida.' : 'Mensagem do RH marcada como lida.')
      await refreshWorkspace()
    } catch (err) {
      setMessage(readError(err))
    }
  }

  async function removeItem(path: string, successText: string) {
    try {
      await authFetch(path, { method: 'DELETE' })
      setMessage(successText)
      await refreshWorkspace()
    } catch (err) {
      setMessage(readError(err))
    }
  }

  async function deleteDocument(item: PortalDocument) {
    try {
      if (!ctx.session) throw new Error('Sessão não encontrada.')
      const ensured = await ensureSession(ctx.session, ctx.tenantId)
      ctx.setSession(ensured)

      const response = await fetch(
        await buildApiUrl(`/api/public/portal-candidates/${candidateId}/documents/${item.id}`, ctx.tenantId),
        {
          method: 'DELETE',
          headers: {
            'X-Tenant-Id': ctx.tenantId,
            ...(ensured.accessToken ? { Authorization: `Bearer ${ensured.accessToken}` } : {}),
          },
        },
      )

      if (!response.ok) {
        throw new Error(await readApiMessage(response))
      }

      setState((current) => ({
        ...current,
        documents: current.documents.filter((documentItem) => documentItem.id !== item.id),
      }))
      setMessage('Documento removido.')
      await refreshWorkspace()
    } catch (err) {
      setMessage(readError(err))
      throw err
    }
  }

  async function uploadFile(path: string, fieldName: string, file: File, successText: string) {
    const form = new FormData()
    form.append(fieldName, file)
    try {
      await authFetch(path, {
        method: 'POST',
        body: form,
      }, false)
      setMessage(successText)
      await refreshWorkspace()
      if (path.includes('/curriculos')) {
        setUploadFeedback({
          title: 'Currículo enviado com sucesso',
          message: 'O arquivo já está disponível para consulta na seção Documentos do seu perfil.',
        })
      }
    } catch (err) {
      setMessage(readError(err))
    }
  }

  async function uploadDocument(path: string, tipo: string, observacoes: string, arquivo: File) {
    const form = new FormData()
    form.append('Tipo', tipo)
    form.append('Observacoes', observacoes)
    form.append('Arquivo', arquivo)
    try {
      const response = await fetch(await buildApiUrl(path, ctx.tenantId), {
        method: 'POST',
        headers: {
          'X-Tenant-Id': ctx.tenantId,
        },
        body: form,
      })
      if (!response.ok) {
        throw new Error(await readApiMessage(response))
      }
      const created = await response.json() as PortalDocument
      setState((current) => ({
        ...current,
        documents: [created, ...current.documents.filter((documentItem) => documentItem.id !== created.id)],
      }))
      setMessage('Documento enviado.')
    } catch (err) {
      setMessage(readError(err))
    }
  }

  async function handleLogout() {
    await signOutPortalSession(ctx)
    navigate(withTenant('/acesso', ctx.tenantId))
  }

  if (loading) {
    return <PageLoading label="Sincronizando seu perfil e suas preferências..." />
  }

  if (message && !state.profile) {
    return (
      <main className="page-shell">
        <section className="state-card unavailable">
          <h3>Não foi possível carregar seu espaço</h3>
          <p>{message}</p>
          <button className="primary-btn" type="button" onClick={() => void refreshWorkspace()}>Tentar novamente</button>
        </section>
      </main>
    )
  }

  const profileComplete = Math.max(0, Math.min(100, Math.round(state.completion?.overall ?? 0)))
  const candidateName = state.profile?.nome || ctx.session?.candidate.nome || 'Candidato'
  const candidateEmail = state.profile?.email || ctx.session?.candidate.email || ''
  const currentRole = state.portfolio?.preferences.workModel || asString(state.preferences?.CargoAlvo) || 'Perfil em construção'
  const internalNotificationCount = state.internalNotifications?.pendentes ?? 0
  const workspaceNavItems = WORKSPACE_SECTIONS.map((section) => ({
    ...section,
    badge: section.id === 'perfil-curriculo'
      ?`${profileComplete}%`
      : section.id === 'matches' && state.matches.length
        ?String(state.matches.length)
        : section.id === 'cursos-formacoes' && state.education?.items.length
          ?String(state.education.items.length)
          : section.id === 'documentos' && state.documents.length
            ?String(state.documents.length)
            : section.id === 'referencias' && state.references.length
              ?String(state.references.length)
              : section.id === 'competencias' && (state.portfolio?.skills?.length ?? 0)
                ?String(state.portfolio?.skills?.length ?? 0)
                : section.id === 'credenciais' && (state.portfolio?.certifications?.length ?? 0)
                  ?String(state.portfolio?.certifications?.length ?? 0)
                  : section.id === 'notificacoes' && internalNotificationCount > 0
                    ?String(internalNotificationCount)
                    : null,
  }))

  return (
    <main className="workspace-shell workspace-view-shell">
      <div className="workspace-view-grid">
        <aside className="workspace-sidebar">
          <section className="workspace-sidebar-card">
            <div className="workspace-sidebar-profile">
              <div className="workspace-sidebar-avatar">
                {avatarPreview ?<img src={avatarPreview} alt={candidateName} /> : <span>{getInitials(candidateName)}</span>}
              </div>
              <div>
                <strong>{candidateName}</strong>
                <span>{currentRole}</span>
              </div>
            </div>
            <div className="workspace-sidebar-progress">
              <div>
                <span>Perfil completo</span>
                <strong>{profileComplete}%</strong>
              </div>
              <div className="workspace-sidebar-progress-bar" aria-hidden="true">
                <span style={{ width: `${profileComplete}%` }}></span>
              </div>
              <button className="workspace-sidebar-cta" type="button" onClick={() => selectWorkspaceSection('perfil-curriculo')}>
                <i className="fas fa-pen" aria-hidden="true"></i>
                Completar perfil
              </button>
            </div>
          </section>

          <nav className="workspace-sidebar-nav" aria-label="Navegação do meu espaço">
            {workspaceNavItems.map((item) => (
              <button
                className={activeWorkspaceSection === item.id ?'is-active' : ''}
                type="button"
                key={item.id}
                onClick={() => selectWorkspaceSection(item.id)}
              >
                <i className={`fas ${item.icon}`} aria-hidden="true"></i>
                <span>{item.label}</span>
                {item.badge ?<strong>{item.badge}</strong> : null}
              </button>
            ))}
          </nav>
        </aside>

        <section className="workspace-main-pane">
          <section className="workspace-identity-hero">
            <div>
              <div className="eyebrow">Meu espaço</div>
              <h1>Olá, <em>{candidateName.split(' ')[0]}</em></h1>
              <p>{candidateEmail}</p>
            </div>
            <div className="workspace-actions">
              <button className="secondary-btn" type="button" onClick={() => void refreshWorkspace()}>Atualizar tudo</button>
              <button className="ghost-btn" type="button" onClick={handleLogout}>Sair</button>
            </div>
          </section>

          {message ?<div className="toast-banner">{message}</div> : null}
          {uploadFeedback ?(
            <div className="swal-backdrop" role="presentation" onClick={() => setUploadFeedback(null)}>
              <section
                className="swal-card success"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="upload-feedback-title"
                aria-describedby="upload-feedback-message"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="swal-icon" aria-hidden="true">
                  <i className="fas fa-check"></i>
                </div>
                <h3 id="upload-feedback-title">{uploadFeedback.title}</h3>
                <p id="upload-feedback-message">{uploadFeedback.message}</p>
                <div className="swal-actions">
                  <button
                    className="secondary-btn"
                    type="button"
                    onClick={() => setUploadFeedback(null)}
                  >
                    Continuar no perfil
                  </button>
                  <button
                    className="primary-btn"
                    type="button"
                    onClick={() => {
                      setUploadFeedback(null)
                      selectWorkspaceSection('documentos')
                    }}
                  >
                    Ver em Documentos
                  </button>
                </div>
              </section>
            </div>
          ) : null}

          <div className="content-grid workspace-content-grid is-single-section">
        <section className="content-column">
          <WorkspaceSection active={activeWorkspaceSection === 'perfil-curriculo'} id="perfil-curriculo" title="Perfil e currículo" description="Dados pessoais, foto, resumo e documentos principais.">
            <CandidateProfileResumeForm
              authFetch={authFetch}
              avatarPreview={avatarPreview}
              candidateId={candidateId}
              candidateName={candidateName}
              profile={state.profile}
              saveJson={saveJson}
              setMessage={setMessage}
              setResumeParsePreview={setResumeParsePreview}
              uploadFile={uploadFile}
              onOpenDocuments={() => selectWorkspaceSection('documentos')}
            />

            {resumeParsePreview ?<pre className="json-preview">{resumeParsePreview}</pre> : null}
          </WorkspaceSection>

          <WorkspaceSection active={activeWorkspaceSection === 'matches'} id="matches" title="Conclusão e aderência" description="Diagnóstico automático do perfil e vagas com maior match.">
            <CandidateMatchInsightsSection completion={state.completion} matches={state.matches} onSelectSection={selectWorkspaceSection} />
          </WorkspaceSection>

          <WorkspaceSection active={activeWorkspaceSection === 'skills'} id="skills" title="Portfólio e links" description="Preferências rápidas de trabalho, URLs públicos e tags — visão inicial para recrutadores.">
            <CandidateSkillsPortfolioWorkspace portfolio={state.portfolio} candidateId={candidateId} saveJson={saveJson} setMessage={setMessage} />
          </WorkspaceSection>

          <WorkspaceSection active={activeWorkspaceSection === 'competencias'} id="competencias" title="Competências" description="Liste tecnologias, idiomas, metodologias e outras capacidades com nível e evidência.">
            <div className="sp-workspace nl-form">
              <SkillsPortfolioRepeater candidateId={candidateId} items={state.portfolio?.skills ?? []} saveJson={saveJson} removeItem={removeItem} setMessage={setMessage} />
            </div>
          </WorkspaceSection>

          <WorkspaceSection active={activeWorkspaceSection === 'credenciais'} id="credenciais" title="Credenciais" description="Certificações, cursos e credenciais com instituição, período ou link público para validação.">
            <div className="sp-workspace nl-form">
              <CertificationsPortfolioRepeater candidateId={candidateId} items={state.portfolio?.certifications ?? []} saveJson={saveJson} removeItem={removeItem} setMessage={setMessage} />
            </div>
          </WorkspaceSection>

          <WorkspaceSection active={activeWorkspaceSection === 'educacao'} id="educacao" title="Educação" description="Nível, área, situação e destaques do seu percurso acadêmico.">
            <div className="subsection-card">
              <div className="subsection-head">
                <strong>Resumo da formação</strong>
              </div>
              <RecordForm
                fields={[
                  fieldSelect('nivel', state.education?.summary.nivel, EDUCATION_SUMMARY_NIVEL_PRESETS, 'Nível'),
                  field('areaPrincipal', state.education?.summary.areaPrincipal, 'input', 'Área principal'),
                  fieldSelect('situacao', state.education?.summary.situacao, EDUCATION_SUMMARY_SITUACAO_PRESETS, 'Situação'),
                  fieldDate('dataConclusao', state.education?.summary.dataConclusao, 'Data de conclusão'),
                  field('destaques', state.education?.summary.destaques, 'textarea', 'Destaques'),
                ]}
                onSubmit={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/education`, values, 'Resumo educacional salvo.')}
                submitLabel="Salvar resumo"
                submitButtonClassName="secondary-btn"
              />
            </div>
          </WorkspaceSection>

          <WorkspaceSection active={activeWorkspaceSection === 'cursos-formacoes'} id="cursos-formacoes" title="Cursos e formações" description="Cursos, instituições, períodos e certificações. Adicione ou edite cada registro.">
            <EducationRepeaterSection
              title="Formações registradas"
              items={state.education?.items ?? []}
              describe={(item) =>
                [
                  item.instituicao || 'Instituição livre',
                  item.status || 'Status aberto',
                  [item.inicio, item.fim].filter(Boolean).join(' “ '),
                ]
                  .filter((part) => Boolean(part && String(part).trim()))
                  .join(' • ')
              }
              onAdd={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/education/items`, values, 'Formação adicionada.', 'POST')}
              onUpdate={(item, values) =>
                saveJson(`/api/public/portal-candidates/${candidateId}/education/items/${item.id}`, values, 'Formação atualizada.')
              }
              onDelete={(item) => removeItem(`/api/public/portal-candidates/${candidateId}/education/items/${item.id}`, 'Formação removida.')}
              setAnnouncement={setMessage}
            />
          </WorkspaceSection>
        </section>

        <section className="content-column">
          <WorkspaceSection active={activeWorkspaceSection === 'experiencias'} id="experiencias" title="Experiências" description="Linha do tempo profissional.">
            <ExperienceRepeaterSection
              title="Experiências"
              items={state.experience?.experiences ?? []}
              describe={(item) => `${item.cargo} • ${item.inicio || '?'} a ${item.fim || 'atual'}`}
              onAdd={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/experiences`, values, 'Experiência adicionada.', 'POST')}
              onUpdate={(item, values) => saveJson(`/api/public/portal-candidates/${candidateId}/experiences/${item.id}`, values, 'Experiência atualizada.')}
              onDelete={(item) => removeItem(`/api/public/portal-candidates/${candidateId}/experiences/${item.id}`, 'Experiência removida.')}
            />
          </WorkspaceSection>

          <WorkspaceSection active={activeWorkspaceSection === 'projetos'} id="projetos" title="Projetos" description="Cases de entrega, tecnologias e destaques.">
            <ProjectRepeaterSection
              title="Projetos"
              items={state.experience?.projects ?? []}
              describe={(item) => `${item.periodo || 'Período livre'} • ${item.stack || 'Stack aberta'}`}
              onAdd={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/projects`, values, 'Projeto adicionado.', 'POST')}
              onUpdate={(item, values) => saveJson(`/api/public/portal-candidates/${candidateId}/projects/${item.id}`, values, 'Projeto atualizado.')}
              onDelete={(item) => removeItem(`/api/public/portal-candidates/${candidateId}/projects/${item.id}`, 'Projeto removido.')}
            />
          </WorkspaceSection>

          <WorkspaceSection active={activeWorkspaceSection === 'preferencias'} id="preferencias" title="Preferências de vaga" description="Objetivo profissional, deslocamento, jornada e remuneração.">
            <CandidateJobPreferencesForm
              preferences={state.preferences}
              tenantId={ctx.tenantId}
              onSubmit={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/preferences`, values, 'Preferências salvas.')}
            />
          </WorkspaceSection>

          <WorkspaceSection active={activeWorkspaceSection === 'notificacoes'} id="notificacoes" title="Notificações" description="Escolha canais, ritmo dos avisos e horários de silêncio.">
            <CandidateInternalMessagesPanel
              messages={state.internalNotifications?.items ?? []}
              pendingCount={state.internalNotifications?.pendentes ?? 0}
              onOpenProfile={() => selectWorkspaceSection('perfil-curriculo')}
              onUpdate={(notificationId, action) => updateInternalNotification(notificationId, action)}
            />
            <CandidateNotificationsWorkspaceForm
              data={state.notifications}
              onSubmit={(payload) => saveJson(`/api/public/portal-candidates/${candidateId}/notifications`, payload, 'Notificações atualizadas.')}
            />
          </WorkspaceSection>

          <WorkspaceSection active={activeWorkspaceSection === 'lgpd'} id="lgpd" title="LGPD e privacidade" description="Consentimentos, tratamento de dados e comprovante de preferências (LGPD).">
            <CandidateLgpdWorkspaceForm
              data={state.lgpd}
              onSubmit={(payload) => saveJson(`/api/public/portal-candidates/${candidateId}/lgpd`, payload, 'Preferências LGPD atualizadas.')}
              onOpenReceipt={() => void openLgpdReceipt(authFetch, candidateId)}
            />
          </WorkspaceSection>

          <WorkspaceSection active={activeWorkspaceSection === 'documentos'} id="documentos" title="Documentos" description="Arquivos, comprovantes e anexos importantes do seu perfil.">
            <DocumentRepeaterSection
              title="Documentos"
              items={state.documents}
              tenantId={ctx.tenantId}
              onUpload={(values) => uploadDocument(`/api/public/portal-candidates/${candidateId}/documents/upload`, values.tipo, values.observacoes, values.arquivo)}
              onUpdate={(item, values) => saveJson(`/api/public/portal-candidates/${candidateId}/documents/${item.id}`, values, 'Documento atualizado.')}
              onDelete={deleteDocument}
            />
          </WorkspaceSection>

          <WorkspaceSection active={activeWorkspaceSection === 'referencias'} id="referencias" title="Referências" description="Contatos profissionais que podem apoiar sua trajetória.">
            <ReferenceRepeaterSection
              title="Referências"
              items={state.references}
              onAdd={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/references`, {
                ...values,
                podeContatar: Boolean(values.podeContatar),
              }, 'Referência salva.', 'POST')}
              onUpdate={(item, values) => saveJson(`/api/public/portal-candidates/${candidateId}/references/${item.id}`, {
                ...values,
                podeContatar: Boolean(values.podeContatar),
              }, 'Referência atualizada.')}
              onDelete={(item) => removeItem(`/api/public/portal-candidates/${candidateId}/references/${item.id}`, 'Referência removida.')}
            />
          </WorkspaceSection>

          <WorkspaceSection active={activeWorkspaceSection === 'acessibilidade'} id="acessibilidade" title="Acessibilidade" description="Preferências de comunicação, inclusão e necessidades de acessibilidade.">
            <CandidateAccessibilityForm
              accessibility={state.accessibility}
              onSubmit={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/accessibility`, values, 'Acessibilidade atualizada.')}
            />
          </WorkspaceSection>
        </section>
          </div>
        </section>
      </div>
    </main>
  )
}

function CandidateMatchInsightsSection({
  completion,
  matches,
  onSelectSection,
}: {
  completion: PortalCompletion | null
  matches: PortalMatchItem[]
  onSelectSection: (sectionId: WorkspaceSectionId) => void
}) {
  const overall = clampCompletionPercent(completion?.overall)
  const sections = Object.entries(completion?.sections ?? {})
    .map(([key, value]) => ({ key, label: formatCompletionSectionLabel(key), value: clampCompletionPercent(value) }))
    .sort((a, b) => a.value - b.value || a.label.localeCompare(b.label, 'pt-BR'))
  const suggestions = completion?.suggestions ?? []
  const incompleteSections = sections.filter((section) => section.value < 100).length
  const topMatch = matches.reduce((best, match) => Math.max(best, clampCompletionPercent(match.score)), 0)
  const ringStyle = { '--match-score': `${overall}%` } as CSSProperties

  return (
    <div className="match-insights">
      <section className="match-insights-hero">
        <div className="match-score-ring" style={ringStyle} aria-label={`Perfil ${overall}% completo`}>
          <span>{overall}%</span>
          <small>perfil</small>
        </div>
        <div className="match-insights-copy">
          <div className="eyebrow">Diagnóstico do candidato</div>
          <h3>{overall >= 80 ? 'Seu perfil já está bem encaminhado.' : 'Complete os pontos certos para ganhar aderência.'}</h3>
          <p>
            Cruzamos a conclusão do seu perfil com as vagas abertas para indicar onde ajustar informações e quais oportunidades parecem mais próximas.
          </p>
        </div>
      </section>

      <div className="match-kpi-grid" aria-label="Resumo de aderência">
        <article>
          <span>Perfil completo</span>
          <strong>{overall}%</strong>
          <small>{sections.length ? `${sections.length} áreas avaliadas` : 'Aguardando diagnóstico'}</small>
        </article>
        <article>
          <span>Pontos de melhoria</span>
          <strong>{suggestions.length || incompleteSections}</strong>
          <small>{suggestions.length ? 'sugestões priorizadas' : 'áreas incompletas'}</small>
        </article>
        <article>
          <span>Melhor aderência</span>
          <strong>{matches.length ? `${topMatch}%` : '-'}</strong>
          <small>{matches.length ? `${matches.length} vagas sugeridas` : 'sem vagas sugeridas agora'}</small>
        </article>
      </div>

      <section className="match-panel">
        <div className="match-panel-head">
          <div>
            <span className="eyebrow">Mapa de conclusão</span>
            <h4>Áreas do perfil</h4>
          </div>
          <p>Priorize os itens com menor percentual para melhorar a qualidade das recomendações.</p>
        </div>
        {sections.length ? (
          <div className="match-section-grid">
            {sections.map((section) => {
              const tone = getCompletionTone(section.value)
              const targetSection = getCompletionTargetSection(section.key)
              const cardContent = (
                <>
                  <div>
                    <strong>{section.label}</strong>
                    <span className="match-status-pill">{tone.label}</span>
                  </div>
                  <div className="match-progress-bar" aria-hidden="true">
                    <span style={{ width: `${section.value}%` }}></span>
                  </div>
                  <small>{section.value}% concluído</small>
                </>
              )
              if (targetSection) {
                return (
                  <button
                    className={`match-section-card is-clickable ${tone.className}`}
                    key={section.key}
                    type="button"
                    onClick={() => onSelectSection(targetSection)}
                    aria-label={`Abrir seção ${section.label}`}
                  >
                    {cardContent}
                  </button>
                )
              }

              return (
                <article className={`match-section-card ${tone.className}`} key={section.key}>
                  {cardContent}
                </article>
              )
            })}
          </div>
        ) : (
          <div className="match-empty-state">
            <strong>Diagnóstico ainda não disponível.</strong>
            <p>Atualize seu perfil ou tente novamente em alguns instantes para carregar a conclusão.</p>
          </div>
        )}
      </section>

      <div className="match-two-column">
        <section className="match-panel">
          <div className="match-panel-head">
            <div>
              <span className="eyebrow">Próximas melhorias</span>
              <h4>Sugestões para aumentar aderência</h4>
            </div>
          </div>
          {suggestions.length ? (
            <div className="match-suggestion-grid">
              {suggestions.map((suggestion) => {
                const impact = formatSuggestionImpact(suggestion.impact)
                return (
                  <article className={`match-suggestion-card ${impact.className}`} key={`${suggestion.section}-${suggestion.text}`}>
                    <span>{impact.label}</span>
                    <strong>{formatCompletionSectionLabel(suggestion.section)}</strong>
                    <p>{suggestion.text}</p>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="match-empty-state compact">
              <strong>Nenhuma sugestão pendente.</strong>
              <p>Seu perfil não possui alertas prioritários neste momento.</p>
            </div>
          )}
        </section>

        <section className="match-panel">
          <div className="match-panel-head">
            <div>
              <span className="eyebrow">Vagas sugeridas</span>
              <h4>Oportunidades com maior match</h4>
            </div>
          </div>
          {matches.length ? (
            <div className="match-job-grid">
              {matches.map((match) => {
                const score = clampCompletionPercent(match.score)
                return (
                  <article className="match-job-card" key={match.vagaId}>
                    <div className="match-job-card-head">
                      <strong>{match.title || 'Vaga sem título'}</strong>
                      <span>{score}%</span>
                    </div>
                    <p>{formatMatchLocation(match)}</p>
                    <div className="match-job-tags">
                      <span>{match.area || 'Área não informada'}</span>
                      <span>{match.mode || 'Formato flexível'}</span>
                      {match.level ? <span>{match.level}</span> : null}
                    </div>
                    <div className="match-progress-bar" aria-hidden="true">
                      <span style={{ width: `${score}%` }}></span>
                    </div>
                    {match.reason ? <small>{match.reason}</small> : null}
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="match-empty-state compact">
              <strong>Nenhuma vaga sugerida agora.</strong>
              <p>Complete preferências, competências e experiências para melhorar o matching.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function CandidateAccessibilityForm({
  accessibility,
  onSubmit,
}: {
  accessibility: PortalAccessibility | null
  onSubmit: (values: PortalAccessibility) => void | Promise<void>
}) {
  const [form, setForm] = useState<PortalAccessibility>(() => normalizeAccessibility(accessibility))

  useEffect(() => {
    setForm(normalizeAccessibility(accessibility))
  }, [accessibility])

  function updateField<K extends keyof PortalAccessibility>(key: K, value: PortalAccessibility[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function toggleField<K extends keyof PortalAccessibility>(key: K) {
    setForm((current) => ({ ...current, [key]: !Boolean(current[key]) as PortalAccessibility[K] }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onSubmit(form)
  }

  const supportOptions: Array<{ key: keyof PortalAccessibility; title: string; description: string; icon: string }> = [
    { key: 'precisaLegendas', title: 'Legendas', description: 'Prefiro conteúdos e entrevistas com legenda.', icon: 'fa-closed-captioning' },
    { key: 'precisaInterprete', title: 'Intérprete', description: 'Preciso de intérprete de Libras ou apoio similar.', icon: 'fa-hands' },
    { key: 'precisaLeitorTela', title: 'Leitor de tela', description: 'Uso tecnologia assistiva para navegação.', icon: 'fa-eye' },
    { key: 'precisaBaixaEstimulo', title: 'Baixo estímulo', description: 'Prefiro ambientes com menos ruído e estímulos.', icon: 'fa-volume-low' },
    { key: 'precisaMobilidade', title: 'Mobilidade', description: 'Preciso de apoio de acesso físico ou deslocamento.', icon: 'fa-wheelchair' },
    { key: 'precisaTempoExtra', title: 'Tempo extra', description: 'Preciso de mais tempo em testes ou dinâmicas.', icon: 'fa-clock' },
  ]

  return (
    <form className="accessibility-form" onSubmit={handleSubmit}>
      <section className="accessibility-hero-card">
        <div>
          <span className="eyebrow">Experiência inclusiva</span>
          <h3>Conte como podemos conduzir o processo seletivo com mais conforto.</h3>
          <p>Essas informações ajudam o RH a ajustar comunicação, etapas e recursos de acessibilidade quando necessário.</p>
        </div>
        <div className="accessibility-privacy-note">
          <i className="fas fa-shield-alt" aria-hidden="true"></i>
          <span>Dados tratados com confidencialidade e usados apenas para apoiar sua candidatura.</span>
        </div>
      </section>

      <section className="accessibility-card">
        <div className="accessibility-card-head">
          <div>
            <span className="eyebrow">Comunicação</span>
            <strong>Como prefere ser contatado?</strong>
          </div>
          <p>Escolha idioma, canal e melhor horário para contato.</p>
        </div>
        <div className="accessibility-grid">
          <AccessibilitySelect label="Idioma preferido" value={asString(form.idioma)} options={ACCESSIBILITY_LANGUAGE_OPTIONS} onChange={(value) => updateField('idioma', value)} />
          <AccessibilitySelect label="Canal preferido" value={asString(form.canal)} options={ACCESSIBILITY_CHANNEL_OPTIONS} onChange={(value) => updateField('canal', value)} />
          <AccessibilitySelect label="Melhor horário" value={asString(form.melhorHorario)} options={ACCESSIBILITY_TIME_OPTIONS} onChange={(value) => updateField('melhorHorario', value)} />
          <label className="accessibility-field is-full">
            <span>Observações de comunicação</span>
            <textarea rows={4} value={asString(form.observacoesComunicacao)} onChange={(event) => updateField('observacoesComunicacao', event.target.value)} placeholder="Ex.: prefiro mensagens por WhatsApp, evitar ligações pela manhã..." />
          </label>
        </div>
      </section>

      <section className="accessibility-card">
        <div className="accessibility-card-head">
          <div>
            <span className="eyebrow">Apoios necessários</span>
            <strong>Recursos para entrevistas, testes e etapas online</strong>
          </div>
          <p>Marque tudo que ajude a tornar a experiência mais adequada.</p>
        </div>
        <div className="accessibility-support-grid">
          {supportOptions.map((option) => (
            <button
              className={`accessibility-support-card${form[option.key] ? ' is-selected' : ''}`}
              key={option.key}
              type="button"
              onClick={() => toggleField(option.key)}
              aria-pressed={Boolean(form[option.key])}
            >
              <i className={`fas ${option.icon}`} aria-hidden="true"></i>
              <span>{option.title}</span>
              <small>{option.description}</small>
            </button>
          ))}
        </div>
        <label className="accessibility-field">
          <span>Detalhes das necessidades</span>
          <textarea rows={4} value={asString(form.detalhesNecessidades)} onChange={(event) => updateField('detalhesNecessidades', event.target.value)} placeholder="Descreva adaptações, equipamentos, restrições ou qualquer informação importante." />
        </label>
      </section>

      <section className="accessibility-card">
        <div className="accessibility-card-head">
          <div>
            <span className="eyebrow">PCD e inclusão</span>
            <strong>Informações opcionais sobre deficiência</strong>
          </div>
          <p>Preencha somente se fizer sentido para você.</p>
        </div>
        <label className="accessibility-consent">
          <input type="checkbox" checked={form.consentimentoPcd} onChange={() => toggleField('consentimentoPcd')} />
          <span>Autorizo o uso dessas informações para adaptações no processo seletivo e enquadramento PCD, quando aplicável.</span>
        </label>
        <div className="accessibility-grid">
          <AccessibilitySelect label="Deseja se identificar como PCD?" value={asString(form.pcdIdentificacao)} options={PCD_IDENTIFICATION_OPTIONS} onChange={(value) => updateField('pcdIdentificacao', value)} />
          <AccessibilitySelect label="Tipo de deficiência" value={asString(form.pcdTipo)} options={PCD_TYPE_OPTIONS} onChange={(value) => updateField('pcdTipo', value)} />
          <label className="accessibility-field">
            <span>Comprovação ou laudo</span>
            <input value={asString(form.pcdComprovacao)} onChange={(event) => updateField('pcdComprovacao', event.target.value)} placeholder="Ex.: tenho laudo disponível, envio quando solicitado..." />
          </label>
          <label className="accessibility-field is-full">
            <span>Observações sobre inclusão</span>
            <textarea rows={4} value={asString(form.pcdObservacoes)} onChange={(event) => updateField('pcdObservacoes', event.target.value)} placeholder="Inclua informações relevantes para acolhimento, acessibilidade ou adaptações." />
          </label>
        </div>
      </section>

      <button className="primary-btn accessibility-submit" type="submit">Salvar acessibilidade</button>
    </form>
  )
}

function AccessibilitySelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="accessibility-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Selecione</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  )
}

function CandidateJobPreferencesForm({
  preferences,
  tenantId,
  onSubmit,
}: {
  preferences: PortalPreferences | null
  tenantId: string
  onSubmit: (values: PortalPreferences) => void | Promise<void>
}) {
  const parsedLocation = parsePreferredLocation(preferences?.CidadePreferida)
  const [form, setForm] = useState({
    CargoAlvo: asString(preferences?.CargoAlvo),
    Senioridade: asString(preferences?.Senioridade),
    InicioDisponivel: asString(preferences?.InicioDisponivel),
    Resumo: asString(preferences?.Resumo),
    AreasInteresse: splitPreferenceList(preferences?.AreasInteresse),
    ModeloTrabalho: asString(preferences?.ModeloTrabalho),
    Jornada: asString(preferences?.Jornada),
    TipoContrato: asString(preferences?.TipoContrato),
    Viagens: asString(preferences?.Viagens),
    Mudanca: asString(preferences?.Mudanca),
    CidadePreferida: parsedLocation.cidade,
    UfPreferida: parsedLocation.uf,
    DistanciaMaxKm: asString(preferences?.DistanciaMaxKm),
    ObsDeslocamento: asString(preferences?.ObsDeslocamento),
    PretensaoSalarial: formatCurrencyInput(asString(preferences?.PretensaoSalarial)),
    PretensaoNegociavel: asString(preferences?.PretensaoNegociavel),
    BeneficiosDesejados: asString(preferences?.BeneficiosDesejados),
    NaoAbreMaoDe: asString(preferences?.NaoAbreMaoDe),
  })
  const [areaOptions, setAreaOptions] = useState<string[]>(FALLBACK_JOB_AREAS)
  const [areaStatus, setAreaStatus] = useState<'loading' | 'ready' | 'fallback'>('loading')
  const [ufOptions, setUfOptions] = useState(BRAZILIAN_STATE_OPTIONS)
  const [cityOptions, setCityOptions] = useState<string[]>([])
  const selectedAreas = form.AreasInteresse

  useEffect(() => {
    const nextLocation = parsePreferredLocation(preferences?.CidadePreferida)
    setForm({
      CargoAlvo: asString(preferences?.CargoAlvo),
      Senioridade: asString(preferences?.Senioridade),
      InicioDisponivel: asString(preferences?.InicioDisponivel),
      Resumo: asString(preferences?.Resumo),
      AreasInteresse: splitPreferenceList(preferences?.AreasInteresse),
      ModeloTrabalho: asString(preferences?.ModeloTrabalho),
      Jornada: asString(preferences?.Jornada),
      TipoContrato: asString(preferences?.TipoContrato),
      Viagens: asString(preferences?.Viagens),
      Mudanca: asString(preferences?.Mudanca),
      CidadePreferida: nextLocation.cidade,
      UfPreferida: nextLocation.uf,
      DistanciaMaxKm: asString(preferences?.DistanciaMaxKm),
      ObsDeslocamento: asString(preferences?.ObsDeslocamento),
      PretensaoSalarial: formatCurrencyInput(asString(preferences?.PretensaoSalarial)),
      PretensaoNegociavel: asString(preferences?.PretensaoNegociavel),
      BeneficiosDesejados: asString(preferences?.BeneficiosDesejados),
      NaoAbreMaoDe: asString(preferences?.NaoAbreMaoDe),
    })
  }, [preferences])

  useEffect(() => {
    let cancelled = false
    portalRequest<{ items: PortalJob[] }>(tenantId, '/api/public/vagas?page=1&pageSize=200')
      .then((result) => {
        if (cancelled) return
        const areas = listUniqueJobValues(result.items ?? [], (job) => job.area)
        const merged = mergePreferenceOptions(areas.length ?areas : FALLBACK_JOB_AREAS, selectedAreas)
        setAreaOptions(merged)
        setAreaStatus(areas.length ?'ready' : 'fallback')
      })
      .catch(() => {
        if (!cancelled) {
          setAreaOptions(mergePreferenceOptions(FALLBACK_JOB_AREAS, selectedAreas))
          setAreaStatus('fallback')
        }
      })
    return () => {
      cancelled = true
    }
  }, [tenantId, selectedAreas.join('|')])

  useEffect(() => {
    let cancelled = false
    fetch(IBGE_STATES_URL)
      .then((response) => response.ok ? response.json() as Promise<BrazilianStateOption[]> : Promise.reject(new Error('IBGE indisponível')))
      .then((states) => {
        if (cancelled) return
        const normalized = states
          .map((state) => ({ sigla: state.sigla, nome: state.nome }))
          .filter((state) => state.sigla && state.nome)
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        if (normalized.length) setUfOptions(normalized)
      })
      .catch(() => {
        if (!cancelled) setUfOptions(BRAZILIAN_STATE_OPTIONS)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!form.UfPreferida) {
      setCityOptions([])
      return
    }

    let cancelled = false
    fetch(`${IBGE_CITIES_URL}/${encodeURIComponent(form.UfPreferida)}/municipios?orderBy=nome`)
      .then((response) => response.ok ? response.json() as Promise<Array<{ nome: string }>> : Promise.reject(new Error('IBGE indisponível')))
      .then((cities) => {
        if (cancelled) return
        const names = cities.map((city) => city.nome).filter(Boolean)
        setCityOptions(names)
        setForm((current) => current.CidadePreferida && !names.includes(current.CidadePreferida)
          ?{ ...current, CidadePreferida: '' }
          : current)
      })
      .catch(() => {
        if (!cancelled) setCityOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [form.UfPreferida])

  function updateField(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }))
  }

  function toggleArea(area: string) {
    setForm((current) => {
      const exists = current.AreasInteresse.includes(area)
      return {
        ...current,
        AreasInteresse: exists
          ?current.AreasInteresse.filter((item) => item !== area)
          : [...current.AreasInteresse, area],
      }
    })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const cidadePreferida = [form.CidadePreferida, form.UfPreferida].filter(Boolean).join(' / ')
    onSubmit({
      CargoAlvo: form.CargoAlvo.trim(),
      Senioridade: form.Senioridade,
      InicioDisponivel: form.InicioDisponivel,
      Resumo: form.Resumo.trim(),
      AreasInteresse: joinPreferenceList(form.AreasInteresse),
      ModeloTrabalho: form.ModeloTrabalho,
      Jornada: form.Jornada,
      TipoContrato: form.TipoContrato,
      Viagens: form.Viagens,
      Mudanca: form.Mudanca,
      CidadePreferida: cidadePreferida,
      DistanciaMaxKm: form.DistanciaMaxKm,
      ObsDeslocamento: form.ObsDeslocamento.trim(),
      PretensaoSalarial: form.PretensaoSalarial.trim(),
      PretensaoNegociavel: form.PretensaoNegociavel,
      BeneficiosDesejados: form.BeneficiosDesejados.trim(),
      NaoAbreMaoDe: form.NaoAbreMaoDe.trim(),
    })
  }

  return (
    <form className="job-preferences-form" onSubmit={handleSubmit}>
      <section className="job-preferences-card">
        <div className="job-preferences-card-head">
          <span>Objetivo</span>
          <strong>Conte para quais vagas você quer ser considerado.</strong>
        </div>
        <div className="job-preferences-grid">
          <PreferenceTextField label="Cargo alvo" value={form.CargoAlvo} onChange={(value) => updateField('CargoAlvo', value)} placeholder="Ex.: Analista Financeiro" />
          <PreferenceSelectField label="Senioridade" value={form.Senioridade} options={SENIORITY_OPTIONS} onChange={(value) => updateField('Senioridade', value)} />
          <PreferenceSelectField label="Início disponível" value={form.InicioDisponivel} options={AVAILABILITY_OPTIONS} onChange={(value) => updateField('InicioDisponivel', value)} />
          <label className="job-preferences-field is-full">
            <span>Resumo profissional</span>
            <textarea rows={4} value={form.Resumo} onChange={(event) => updateField('Resumo', event.target.value)} placeholder="Fale brevemente sobre seu objetivo e momento de carreira." />
          </label>
        </div>
      </section>

      <section className="job-preferences-card">
        <div className="job-preferences-card-head">
          <span>Áreas e modelo</span>
          <strong>Preferências para encontrar oportunidades compatíveis.</strong>
        </div>
        <div className="job-preferences-field is-full">
          <span>Áreas de interesse</span>
          <div className="job-preferences-chip-grid">
            {areaOptions.map((area) => (
              <button
                className={`job-preferences-chip${selectedAreas.includes(area) ?' is-selected' : ''}`}
                key={area}
                type="button"
                onClick={() => toggleArea(area)}
              >
                {area}
              </button>
            ))}
          </div>
          <small>{areaStatus === 'fallback' ?'Usando lista padrão porque não foi possível derivar áreas das vagas agora.' : 'Opções derivadas das vagas abertas do tenant.'}</small>
        </div>
        <div className="job-preferences-grid">
          <PreferenceSelectField label="Modelo de trabalho" value={form.ModeloTrabalho} options={WORK_MODEL_OPTIONS} onChange={(value) => updateField('ModeloTrabalho', value)} />
          <PreferenceSelectField label="Jornada" value={form.Jornada} options={WORKDAY_OPTIONS} onChange={(value) => updateField('Jornada', value)} />
          <PreferenceSelectField label="Tipo de contrato" value={form.TipoContrato} options={CONTRACT_OPTIONS} onChange={(value) => updateField('TipoContrato', value)} />
        </div>
      </section>

      <section className="job-preferences-card">
        <div className="job-preferences-card-head">
          <span>Localidade</span>
          <strong>Defina deslocamento, viagens e mudança.</strong>
        </div>
        <div className="job-preferences-grid">
          <PreferenceSelectField label="Viagens" value={form.Viagens} options={YES_NO_NEGOTIABLE_OPTIONS} onChange={(value) => updateField('Viagens', value)} />
          <PreferenceSelectField label="Mudança" value={form.Mudanca} options={YES_NO_NEGOTIABLE_OPTIONS} onChange={(value) => updateField('Mudanca', value)} />
          <label className="job-preferences-field">
            <span>UF preferida</span>
            <select value={form.UfPreferida} onChange={(event) => setForm((current) => ({ ...current, UfPreferida: event.target.value, CidadePreferida: '' }))}>
              <option value="">Selecionar UF</option>
              {ufOptions.map((state) => (
                <option key={state.sigla} value={state.sigla}>{state.sigla} - {state.nome}</option>
              ))}
            </select>
          </label>
          <label className="job-preferences-field">
            <span>Cidade preferida</span>
            <select value={form.CidadePreferida} onChange={(event) => updateField('CidadePreferida', event.target.value)} disabled={!form.UfPreferida}>
              <option value="">{form.UfPreferida ?'Selecionar cidade' : 'Selecione a UF primeiro'}</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </label>
          <PreferenceSelectField label="Distância máxima" value={form.DistanciaMaxKm} options={DISTANCE_OPTIONS} onChange={(value) => updateField('DistanciaMaxKm', value)} suffix="km" />
          <label className="job-preferences-field is-full">
            <span>Observações de deslocamento</span>
            <textarea rows={3} value={form.ObsDeslocamento} onChange={(event) => updateField('ObsDeslocamento', event.target.value)} placeholder="Ex.: aceito deslocamento para unidades próximas ao transporte público." />
          </label>
        </div>
      </section>

      <section className="job-preferences-card">
        <div className="job-preferences-card-head">
          <span>Remuneração e benefícios</span>
          <strong>Ajude o RH a entender suas expectativas.</strong>
        </div>
        <div className="job-preferences-grid">
          <PreferenceTextField label="Pretensão salarial" value={form.PretensaoSalarial} onChange={(value) => updateField('PretensaoSalarial', formatCurrencyInput(value))} placeholder="R$ 0,00" inputMode="numeric" />
          <PreferenceSelectField label="Pretensão negociável" value={form.PretensaoNegociavel} options={YES_NO_NEGOTIABLE_OPTIONS} onChange={(value) => updateField('PretensaoNegociavel', value)} />
          <label className="job-preferences-field is-full">
            <span>Benefícios desejados</span>
            <textarea rows={3} value={form.BeneficiosDesejados} onChange={(event) => updateField('BeneficiosDesejados', event.target.value)} placeholder="Ex.: plano de saúde, vale alimentação, auxílio educação." />
          </label>
          <label className="job-preferences-field is-full">
            <span>Não abro mão de</span>
            <textarea rows={3} value={form.NaoAbreMaoDe} onChange={(event) => updateField('NaoAbreMaoDe', event.target.value)} placeholder="Ex.: contrato CLT, modelo híbrido, escala específica." />
          </label>
        </div>
      </section>

      <button className="secondary-btn" type="submit">Salvar preferências</button>
    </form>
  )
}

function PreferenceTextField({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'search' | 'email' | 'url'
}) {
  return (
    <label className="job-preferences-field">
      <span>{label}</span>
      <input inputMode={inputMode} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function PreferenceSelectField({
  label,
  value,
  options,
  onChange,
  suffix,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
  suffix?: string
}) {
  return (
    <label className="job-preferences-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Selecionar</option>
        {options.map((option) => (
          <option key={option} value={option}>{suffix ?`${option} ${suffix}` : option}</option>
        ))}
      </select>
    </label>
  )
}

type AuthContext = {
  tenantId: string
  session: AuthSession | null
  setSession: (session: AuthSession | null) => void
  notifyAuthError: (message: string | null) => void
}

function createAuthorizedClient(ctx: AuthContext) {
  return async function request<T>(path: string, init?: RequestInit, json = true): Promise<T> {
    if (!ctx.session) throw new Error('Sessão não encontrada.')

    const ensured = await ensureSession(ctx.session, ctx.tenantId)
    ctx.setSession(ensured)

    const headers: HeadersInit = {
      ...(json ?{ 'Content-Type': 'application/json' } : {}),
      'X-Tenant-Id': ctx.tenantId,
      ...(ensured.accessToken ?{ Authorization: `Bearer ${ensured.accessToken}` } : {}),
      ...(init?.headers ?? {}),
    }

    const response = await fetch(await buildApiUrl(path, ctx.tenantId), {
      ...init,
      headers,
    })

    if (!response.ok) {
      if (response.status === 401) {
        ctx.notifyAuthError('Sua sess?o expirou. Entre novamente.')
        ctx.setSession(null)
      }
      throw new Error(await readApiMessage(response))
    }

    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }
}

async function fetchAuthorizedBlobUrl(ctx: AuthContext, path: string) {
  if (!ctx.session) throw new Error('Sessão não encontrada.')
  const ensured = await ensureSession(ctx.session, ctx.tenantId)
  ctx.setSession(ensured)

  const response = await fetch(await buildApiUrl(path, ctx.tenantId), {
    headers: {
      'X-Tenant-Id': ctx.tenantId,
      ...(ensured.accessToken ?{ Authorization: `Bearer ${ensured.accessToken}` } : {}),
    },
  })
  if (!response.ok) throw new Error(await readApiMessage(response))
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

async function ensureSession(session: AuthSession, tenantId: string) {
  if (!session.accessToken || !session.refreshToken) return session

  const expiresAt = new Date(session.accessTokenExpiresAtUtc).getTime()
  if (expiresAt - Date.now() > 60_000) return session

  const refreshed = await portalRequest<AuthSession>(tenantId, '/api/public/portal-auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: session.refreshToken }),
  })
  return refreshed
}

async function portalRequest<T>(tenantId: string, path: string, init?: RequestInit) {
  const response = await fetch(await buildApiUrl(path, tenantId), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId,
      ...(init?.headers ?? {}),
    },
  })
  if (!response.ok) {
    throw new Error(await readApiMessage(response))
  }

  return response.json() as Promise<T>
}

async function fetchJson<T>(url: string) {
  const response = await fetch(await buildApiUrl(url))
  if (!response.ok) {
    throw new Error(await readApiMessage(response))
  }

  return response.json() as Promise<T>
}

function WorkspaceSection({ active, id, title, description, children }: { active?: boolean; id?: string; title: string; description: string; children: ReactNode }) {
  if (!active) return null

  return (
    <section className="workspace-card" id={id}>
      <div className="section-head">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <div className="section-body">{children}</div>
    </section>
  )
}

function CandidateProfileResumeForm({
  authFetch,
  avatarPreview,
  candidateId,
  candidateName,
  profile,
  saveJson,
  setMessage,
  setResumeParsePreview,
  uploadFile,
  onOpenDocuments,
}: {
  authFetch: ReturnType<typeof createAuthorizedClient>
  avatarPreview: string | null
  candidateId: string
  candidateName: string
  profile: PortalProfile | null
  saveJson: (path: string, payload: unknown, successText: string, method?: 'PUT' | 'POST') => Promise<void>
  setMessage: (message: string | null) => void
  setResumeParsePreview: (value: string) => void
  uploadFile: (path: string, fieldName: string, file: File, successText: string) => Promise<void>
  onOpenDocuments: () => void
}) {
  const [form, setForm] = useState({
    nome: '',
    fone: '',
    celular: '',
    uf: '',
    cidade: '',
    linkedinUrl: '',
    resumoProfissional: '',
  })
  const [ufOptions, setUfOptions] = useState(BRAZILIAN_STATE_OPTIONS)
  const [cityOptions, setCityOptions] = useState<string[]>([])
  const [cityLoading, setCityLoading] = useState(false)

  useEffect(() => {
    setForm({
      nome: profile?.nome ?? '',
      fone: formatBrazilianPhone(profile?.fone),
      celular: formatBrazilianPhone(profile?.celular),
      uf: (profile?.uf ?? '').toUpperCase(),
      cidade: profile?.cidade ?? '',
      linkedinUrl: profile?.linkedinUrl ?? '',
      resumoProfissional: profile?.resumoProfissional ?? '',
    })
  }, [profile])

  useEffect(() => {
    let cancelled = false
    fetch(IBGE_STATES_URL)
      .then((response) => response.ok ? response.json() as Promise<BrazilianStateOption[]> : Promise.reject(new Error('IBGE indisponível')))
      .then((states) => {
        if (cancelled) return
        const normalized = states
          .map((state) => ({ sigla: state.sigla, nome: state.nome }))
          .filter((state) => state.sigla && state.nome)
          .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        if (normalized.length) setUfOptions(normalized)
      })
      .catch(() => {
        if (!cancelled) setUfOptions(BRAZILIAN_STATE_OPTIONS)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!form.uf) {
      setCityOptions([])
      setCityLoading(false)
      return
    }

    let cancelled = false
    setCityLoading(true)
    fetch(`${IBGE_CITIES_URL}/${encodeURIComponent(form.uf)}/municipios?orderBy=nome`)
      .then((response) => response.ok ? response.json() as Promise<Array<{ nome: string }>> : Promise.reject(new Error('IBGE indisponível')))
      .then((cities) => {
        if (cancelled) return
        setCityOptions(cities.map((city) => city.nome).filter(Boolean))
      })
      .catch(() => {
        if (!cancelled) setCityOptions([])
      })
      .finally(() => {
        if (!cancelled) setCityLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [form.uf])

  const citySelectOptions = form.cidade && !cityOptions.includes(form.cidade)
    ?[form.cidade, ...cityOptions]
    : cityOptions
  const latestResume = profile?.curriculo ?? null

  return (
    <>
      <div className="profile-shell">
        <div className="avatar-plate">
          {avatarPreview ?<img src={avatarPreview} alt={profile?.nome || candidateName} /> : <span>{getInitials(profile?.nome || candidateName)}</span>}
        </div>
        <label className="upload-label">
          Enviar Foto
          <input type="file" accept="image/*" onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void uploadFile(`/api/public/portal-candidates/${candidateId}/avatar`, 'arquivo', file, 'Avatar atualizado.')
          }} />
        </label>
      </div>

      <form
        className="stack-form"
        onSubmit={(event) => {
          event.preventDefault()
          void saveJson(`/api/public/portal-candidates/${candidateId}`, {
            nome: form.nome.trim(),
            fone: form.fone.trim(),
            celular: form.celular.trim(),
            uf: form.uf.trim().toUpperCase(),
            cidade: form.cidade.trim(),
            linkedinUrl: form.linkedinUrl.trim(),
            resumoProfissional: form.resumoProfissional.trim(),
          }, 'Perfil atualizado.')
        }}
      >
        <label>
          <span>Nome</span>
          <input value={form.nome} onChange={(event) => setForm((current) => ({ ...current, nome: event.target.value }))} />
        </label>
        <label>
          <span>Telefone</span>
          <input
            inputMode="tel"
            placeholder="(11) 99999-9999"
            value={form.fone}
            onChange={(event) => setForm((current) => ({ ...current, fone: formatBrazilianPhone(event.target.value) }))}
          />
        </label>
        <label>
          <span>Celular</span>
          <div className="profile-copy-field">
            <input
              inputMode="tel"
              placeholder="(11) 99999-9999"
              value={form.celular}
              onChange={(event) => setForm((current) => ({ ...current, celular: formatBrazilianPhone(event.target.value) }))}
            />
            <button
              className="ghost-btn"
              type="button"
              onClick={() => setForm((current) => ({ ...current, celular: formatBrazilianPhone(current.fone) }))}
              disabled={!form.fone.trim()}
            >
              Copiar telefone
            </button>
          </div>
        </label>
        <label>
          <span>UF</span>
          <select
            value={form.uf}
            onChange={(event) => setForm((current) => ({ ...current, uf: event.target.value, cidade: '' }))}
          >
            <option value="">Selecione a UF</option>
            {ufOptions.map((state) => (
              <option key={state.sigla} value={state.sigla}>{state.nome} / {state.sigla}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Cidade</span>
          <select
            value={form.cidade}
            onChange={(event) => setForm((current) => ({ ...current, cidade: event.target.value }))}
            disabled={!form.uf || cityLoading}
          >
            <option value="">{cityLoading ?'Carregando cidades...' : 'Selecione a cidade'}</option>
            {citySelectOptions.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </label>
        <label>
          <span>LinkedIn</span>
          <input value={form.linkedinUrl} onChange={(event) => setForm((current) => ({ ...current, linkedinUrl: event.target.value }))} />
        </label>
        <label>
          <span>Resumo</span>
          <textarea rows={4} value={form.resumoProfissional} onChange={(event) => setForm((current) => ({ ...current, resumoProfissional: event.target.value }))} />
        </label>
        <button className="primary-btn" type="submit">Salvar seção</button>
      </form>

      <section className={`profile-resume-card${latestResume ? ' has-resume' : ' is-empty'}`}>
        <div className="profile-resume-icon" aria-hidden="true">
          <i className="fas fa-file-lines"></i>
        </div>
        <div className="profile-resume-copy">
          <span className="eyebrow">Currículo principal</span>
          <strong>{latestResume?.nomeArquivo ?? 'Nenhum currículo enviado ainda'}</strong>
          <p>
            {latestResume
              ? `Enviado em ${formatDateTime(latestResume.createdAtUtc)}. Também disponível na seção Documentos.`
              : 'Envie um arquivo PDF, DOC ou DOCX para deixar seu currículo disponível no portal.'}
          </p>
        </div>
        <div className="profile-resume-actions">
          <label className="upload-label">
            {latestResume ? 'Substituir currículo' : 'Enviar currículo'}
            <input type="file" accept=".pdf,.doc,.docx" onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void uploadFile(`/api/public/portal-candidates/${candidateId}/curriculos`, 'arquivo', file, 'Currículo enviado.')
            }} />
          </label>
          {latestResume ? (
            <>
              <label className="upload-label">
                Parsear currículo
                <input type="file" accept=".pdf,.doc,.docx" onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  const upload = new FormData()
                  upload.append('arquivo', file)
                  void authFetch<Record<string, unknown>>(`/api/public/portal-candidates/${candidateId}/parse-resume`, { method: 'POST', body: upload }, false)
                    .then((result) => setResumeParsePreview(JSON.stringify(result, null, 2)))
                    .catch((err) => setMessage(readError(err)))
                }} />
              </label>
              <button className="secondary-btn" type="button" onClick={() => void openResumeHtml(authFetch, candidateId)}>Abrir currículo HTML</button>
              <button className="secondary-btn" type="button" onClick={() => void downloadResumePdf(authFetch, candidateId)}>Baixar PDF gerado</button>
              <button className="ghost-btn" type="button" onClick={onOpenDocuments}>Ver em Documentos</button>
            </>
          ) : null}
        </div>
      </section>
    </>
  )
}

const EDUCATION_TIPO_PRESETS = [
  'Graduação',
  'Tecnólogo',
  'Técnico',
  'Pós-graduação',
  'MBA',
  'Mestrado',
  'Doutorado',
  'Curso livre',
  'Certificação',
] as const

const EDUCATION_STATUS_PRESETS = ['Concluído', 'Em andamento', 'Cursando', 'Interrompido'] as const

function buildEducationTipoOptions(current?: string | null) {
  const s = new Set<string>(EDUCATION_TIPO_PRESETS as unknown as string[])
  if (current?.trim()) s.add(current.trim())
  return Array.from(s)
}

function buildEducationStatusOptions(current?: string | null) {
  const s = new Set<string>(EDUCATION_STATUS_PRESETS as unknown as string[])
  if (current?.trim()) s.add(current.trim())
  return Array.from(s)
}

function EducationRepeaterSection({
  title,
  items,
  describe,
  onAdd,
  onUpdate,
  onDelete,
  setAnnouncement,
}: {
  title: string
  items: PortalEducationItem[]
  describe: (item: PortalEducationItem) => string
  onAdd: (values: Record<string, string>) => void | Promise<void>
  onUpdate: (item: PortalEducationItem, values: Record<string, string>) => void | Promise<void>
  onDelete: (item: PortalEducationItem) => void
  setAnnouncement?: (message: string | null) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PortalEducationItem | null>(null)
  const [draft, setDraft] = useState({
    curso: '',
    instituicao: '',
    tipo: '',
    status: '',
    inicio: '',
    fim: '',
    observacoes: '',
    link: '',
  })

  const tipoOptions = useMemo(() => buildEducationTipoOptions(draft.tipo), [draft.tipo])
  const statusOptions = useMemo(() => buildEducationStatusOptions(draft.status), [draft.status])

  function resetDraft() {
    setDraft({
      curso: '',
      instituicao: '',
      tipo: '',
      status: '',
      inicio: '',
      fim: '',
      observacoes: '',
      link: '',
    })
  }

  function openCreate() {
    setEditingItem(null)
    resetDraft()
    setModalOpen(true)
  }

  function openEdit(item: PortalEducationItem) {
    setEditingItem(item)
    setDraft({
      curso: item.curso ?? '',
      instituicao: item.instituicao ?? '',
      tipo: item.tipo ?? '',
      status: item.status ?? '',
      inicio: item.inicio ?? '',
      fim: item.fim ?? '',
      observacoes: item.observacoes ?? '',
      link: item.link ?? '',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingItem(null)
    resetDraft()
  }

  return (
    <div className="subsection-card">
      <div className="subsection-head">
        <strong>{title}</strong>
        <span>{items.length} item(ns)</span>
      </div>
      <div className="list-shell">
        {items.map((item) => (
          <article key={item.id} className="list-item">
            <div>
              <strong>{getRepeaterTitle(item as unknown as Record<string, unknown>)}</strong>
              <p>{describe(item)}</p>
            </div>
            <div className="list-item-actions">
              <button className="ghost-btn" type="button" onClick={() => openEdit(item)}>Editar</button>
              <button className="ghost-btn" type="button" onClick={() => onDelete(item)}>Remover</button>
            </div>
          </article>
        ))}
        {items.length === 0 ? <div className="empty-inline">Nenhum item registrado ainda.</div> : null}
      </div>
      <button className="secondary-btn" type="button" onClick={openCreate}>Adicionar formação</button>
      {modalOpen ? createPortal((
        <div className="workspace-form-modal-backdrop" onClick={closeModal}>
          <div className="workspace-form-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="workspace-form-modal-header">
              <h3>{editingItem ? 'Editar formação' : 'Adicionar formação'}</h3>
              <button className="profile-modal-close" type="button" onClick={closeModal} aria-label="Fechar">
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <form
              className="project-form-grid"
              onSubmit={(event) => {
                event.preventDefault()
                if (!draft.curso.trim()) {
                  setAnnouncement?.('Informe o nome do curso.')
                  return
                }
                const payload = {
                  curso: draft.curso.trim(),
                  instituicao: draft.instituicao.trim(),
                  tipo: draft.tipo.trim(),
                  status: draft.status.trim(),
                  inicio: draft.inicio.trim(),
                  fim: draft.fim.trim(),
                  observacoes: draft.observacoes.trim(),
                  link: draft.link.trim(),
                }
                if (editingItem) {
                  void onUpdate(editingItem, payload)
                } else {
                  void onAdd(payload)
                }
                closeModal()
              }}
            >
              <div className="workspace-form-modal-body">
                <label>
                  <span>Curso</span>
                  <input
                    value={draft.curso}
                    onChange={(event) => setDraft((current) => ({ ...current, curso: event.target.value }))}
                    placeholder="Ex.: Ciência da Computação"
                    required
                  />
                </label>
                <label>
                  <span>Instituição</span>
                  <input
                    value={draft.instituicao}
                    onChange={(event) => setDraft((current) => ({ ...current, instituicao: event.target.value }))}
                    placeholder="Ex.: universidade, plataforma EAD"
                  />
                </label>
                <div className="project-period-row">
                  <label>
                    <span>Tipo</span>
                    <select
                      value={draft.tipo}
                      onChange={(event) => setDraft((current) => ({ ...current, tipo: event.target.value }))}
                    >
                      <option value="">”</option>
                      {tipoOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Status</span>
                    <select
                      value={draft.status}
                      onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
                    >
                      <option value="">”</option>
                      {statusOptions.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="project-period-row">
                  <label>
                    <span>Início</span>
                    <input type="date" value={draft.inicio} onChange={(event) => setDraft((current) => ({ ...current, inicio: event.target.value }))} />
                  </label>
                  <label>
                    <span>Fim</span>
                    <input type="date" value={draft.fim} onChange={(event) => setDraft((current) => ({ ...current, fim: event.target.value }))} />
                  </label>
                </div>
                <label>
                  <span>Observações</span>
                  <textarea rows={4} value={draft.observacoes} onChange={(event) => setDraft((current) => ({ ...current, observacoes: event.target.value }))} />
                </label>
                <label>
                  <span>Link</span>
                  <input
                    placeholder="https://..."
                    value={draft.link}
                    onChange={(event) => setDraft((current) => ({ ...current, link: event.target.value }))}
                  />
                </label>
              </div>
              <div className="workspace-form-modal-actions">
                <button className="ghost-btn" type="button" onClick={closeModal}>Cancelar</button>
                <button className="secondary-btn" type="submit">{editingItem ? 'Salvar formação' : 'Adicionar formação'}</button>
              </div>
            </form>
          </div>
        </div>
      ), document.body) : null}
    </div>
  )
}

function ExperienceRepeaterSection({
  title,
  items,
  describe,
  onAdd,
  onUpdate,
  onDelete,
}: {
  title: string
  items: PortalExperience[]
  describe: (item: PortalExperience) => string
  onAdd: (values: Record<string, string>) => void | Promise<void>
  onUpdate: (item: PortalExperience, values: Record<string, string>) => void | Promise<void>
  onDelete: (item: PortalExperience) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PortalExperience | null>(null)
  const [draft, setDraft] = useState({
    empresa: '',
    cargo: '',
    inicio: '',
    fim: '',
    local: '',
    atividades: '',
  })

  function resetDraft() {
    setDraft({
      empresa: '',
      cargo: '',
      inicio: '',
      fim: '',
      local: '',
      atividades: '',
    })
  }

  function openCreate() {
    setEditingItem(null)
    resetDraft()
    setModalOpen(true)
  }

  function openEdit(item: PortalExperience) {
    setEditingItem(item)
    setDraft({
      empresa: item.empresa ?? '',
      cargo: item.cargo ?? '',
      inicio: item.inicio ?? '',
      fim: item.fim ?? '',
      local: item.local ?? '',
      atividades: item.atividades ?? '',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingItem(null)
    resetDraft()
  }

  return (
    <div className="subsection-card">
      <div className="subsection-head">
        <strong>{title}</strong>
        <span>{items.length} item(ns)</span>
      </div>
      <div className="list-shell">
        {items.map((item) => (
          <article key={item.id} className="list-item">
            <div>
              <strong>{getRepeaterTitle(item)}</strong>
              <p>{describe(item)}</p>
            </div>
            <div className="list-item-actions">
              <button className="ghost-btn" type="button" onClick={() => openEdit(item)}>Editar</button>
              <button className="ghost-btn" type="button" onClick={() => onDelete(item)}>Remover</button>
            </div>
          </article>
        ))}
        {items.length === 0 ?<div className="empty-inline">Nenhum item registrado ainda.</div> : null}
      </div>
      <button className="secondary-btn" type="button" onClick={openCreate}>Adicionar Experiência</button>
      {modalOpen ? createPortal((
        <div className="workspace-form-modal-backdrop" onClick={closeModal}>
          <div className="workspace-form-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="workspace-form-modal-header">
              <h3>{editingItem ?'Editar Experiência' : 'Adicionar Experiência'}</h3>
              <button className="profile-modal-close" type="button" onClick={closeModal} aria-label="Fechar">
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <form
              className="project-form-grid"
              onSubmit={(event) => {
                event.preventDefault()
                if (editingItem) {
                  onUpdate(editingItem, draft)
                } else {
                  onAdd(draft)
                }
                closeModal()
              }}
            >
              <div className="workspace-form-modal-body">
                <label>
                  <span>Empresa</span>
                  <input value={draft.empresa} onChange={(event) => setDraft((current) => ({ ...current, empresa: event.target.value }))} />
                </label>
                <div className="experience-detail-row">
                  <label>
                    <span>Cargo</span>
                    <input value={draft.cargo} onChange={(event) => setDraft((current) => ({ ...current, cargo: event.target.value }))} />
                  </label>
                  <label>
                    <span>Início</span>
                    <input type="date" value={draft.inicio} onChange={(event) => setDraft((current) => ({ ...current, inicio: event.target.value }))} />
                  </label>
                  <label>
                    <span>Fim</span>
                    <input type="date" value={draft.fim} onChange={(event) => setDraft((current) => ({ ...current, fim: event.target.value }))} />
                  </label>
                </div>
                <label>
                  <span>Local / modelo</span>
                  <input value={draft.local} onChange={(event) => setDraft((current) => ({ ...current, local: event.target.value }))} />
                </label>
                <label>
                  <span>Descrição</span>
                  <textarea rows={4} value={draft.atividades} onChange={(event) => setDraft((current) => ({ ...current, atividades: event.target.value }))} />
                </label>
              </div>
              <div className="workspace-form-modal-actions">
                <button className="ghost-btn" type="button" onClick={closeModal}>Cancelar</button>
                <button className="secondary-btn" type="submit">{editingItem ?'Salvar Experiência' : 'Adicionar Experiência'}</button>
              </div>
            </form>
          </div>
        </div>
      ), document.body) : null}
    </div>
  )
}

function ProjectRepeaterSection({
  title,
  items,
  describe,
  onAdd,
  onUpdate,
  onDelete,
}: {
  title: string
  items: PortalProject[]
  describe: (item: PortalProject) => string
  onAdd: (values: Record<string, string>) => void | Promise<void>
  onUpdate: (item: PortalProject, values: Record<string, string>) => void | Promise<void>
  onDelete: (item: PortalProject) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PortalProject | null>(null)
  const [draft, setDraft] = useState({
    nome: '',
    inicio: '',
    fim: '',
    descricao: '',
    link: '',
    stack: '',
    destaques: '',
  })

  function splitPeriod(period?: string | null) {
    const [start = '', end = ''] = (period ?? '').split(' a ')
    return {
      inicio: start.trim(),
      fim: end.trim() === 'atual' ?'' : end.trim(),
    }
  }

  function resetDraft() {
    setDraft({
      nome: '',
      inicio: '',
      fim: '',
      descricao: '',
      link: '',
      stack: '',
      destaques: '',
    })
  }

  function openCreate() {
    setEditingItem(null)
    resetDraft()
    setModalOpen(true)
  }

  function openEdit(item: PortalProject) {
    const period = splitPeriod(item.periodo)
    setEditingItem(item)
    setDraft({
      nome: item.nome ?? '',
      inicio: period.inicio,
      fim: period.fim,
      descricao: item.descricao ?? '',
      link: item.link ?? '',
      stack: item.stack ?? '',
      destaques: item.destaques ?? '',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingItem(null)
    resetDraft()
  }

  function buildPeriod() {
    const start = draft.inicio.trim()
    const end = draft.fim.trim()
    if (start && end) return `${start} a ${end}`
    if (start) return `${start} a atual`
    return end
  }

  return (
    <div className="subsection-card">
      <div className="subsection-head">
        <strong>{title}</strong>
        <span>{items.length} item(ns)</span>
      </div>
      <div className="list-shell">
        {items.map((item) => (
          <article key={item.id} className="list-item">
            <div>
              <strong>{getRepeaterTitle(item)}</strong>
              <p>{describe(item)}</p>
            </div>
            <div className="list-item-actions">
              <button className="ghost-btn" type="button" onClick={() => openEdit(item)}>Editar</button>
              <button className="ghost-btn" type="button" onClick={() => onDelete(item)}>Remover</button>
            </div>
          </article>
        ))}
        {items.length === 0 ?<div className="empty-inline">Nenhum item registrado ainda.</div> : null}
      </div>
      <button className="secondary-btn" type="button" onClick={openCreate}>Adicionar Projeto</button>
      {modalOpen ? createPortal((
        <div className="workspace-form-modal-backdrop" onClick={closeModal}>
          <div className="workspace-form-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="workspace-form-modal-header">
              <h3>{editingItem ?'Editar Projeto' : 'Adicionar Projeto'}</h3>
              <button className="profile-modal-close" type="button" onClick={closeModal} aria-label="Fechar">
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <form
              className="project-form-grid"
              onSubmit={(event) => {
                event.preventDefault()
                const payload = {
                  nome: draft.nome,
                  periodo: buildPeriod(),
                  descricao: draft.descricao,
                  link: draft.link,
                  stack: draft.stack,
                  destaques: draft.destaques,
                }
                if (editingItem) {
                  onUpdate(editingItem, payload)
                } else {
                  onAdd(payload)
                }
                closeModal()
              }}
            >
              <div className="workspace-form-modal-body">
                <label>
                  <span>Nome</span>
                  <input value={draft.nome} onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))} />
                </label>
                <div className="project-period-row">
                  <label>
                    <span>Início</span>
                    <input type="date" value={draft.inicio} onChange={(event) => setDraft((current) => ({ ...current, inicio: event.target.value }))} />
                  </label>
                  <label>
                    <span>Fim</span>
                    <input type="date" value={draft.fim} onChange={(event) => setDraft((current) => ({ ...current, fim: event.target.value }))} />
                  </label>
                </div>
                <label>
                  <span>Descrição</span>
                  <textarea rows={4} value={draft.descricao} onChange={(event) => setDraft((current) => ({ ...current, descricao: event.target.value }))} />
                </label>
                <label>
                  <span>Link</span>
                  <input value={draft.link} onChange={(event) => setDraft((current) => ({ ...current, link: event.target.value }))} />
                </label>
                <label>
                  <span>Stack</span>
                  <textarea rows={4} value={draft.stack} onChange={(event) => setDraft((current) => ({ ...current, stack: event.target.value }))} />
                </label>
                <label>
                  <span>Destaques</span>
                  <textarea rows={4} value={draft.destaques} onChange={(event) => setDraft((current) => ({ ...current, destaques: event.target.value }))} />
                </label>
              </div>
              <div className="workspace-form-modal-actions">
                <button className="ghost-btn" type="button" onClick={closeModal}>Cancelar</button>
                <button className="secondary-btn" type="submit">{editingItem ?'Salvar Projeto' : 'Adicionar Projeto'}</button>
              </div>
            </form>
          </div>
        </div>
      ), document.body) : null}
    </div>
  )
}

function DocumentRepeaterSection({
  title,
  items,
  tenantId,
  onUpload,
  onUpdate,
  onDelete,
}: {
  title: string
  items: PortalDocument[]
  tenantId: string
  onUpload: (values: { tipo: string; observacoes: string; arquivo: File }) => void | Promise<void>
  onUpdate: (item: PortalDocument, values: Record<string, string>) => void | Promise<void>
  onDelete: (item: PortalDocument) => void | Promise<void>
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PortalDocument | null>(null)
  const [uploadPending, setUploadPending] = useState(false)
  const [uploadFeedback, setUploadFeedback] = useState<{
    type: 'success' | 'error'
    title: string
    message: string
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PortalDocument | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteFeedback, setDeleteFeedback] = useState<{
    type: 'success' | 'error'
    title: string
    message: string
  } | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)
  const [draft, setDraft] = useState({
    tipo: '',
    observacoes: '',
    arquivo: null as File | null,
  })

  function resetDraft() {
    setDraft({
      tipo: '',
      observacoes: '',
      arquivo: null,
    })
    setModalError(null)
  }

  function openCreate() {
    setEditingItem(null)
    resetDraft()
    setModalOpen(true)
  }

  function closeModal() {
    if (uploadPending) return
    setModalOpen(false)
    setEditingItem(null)
    resetDraft()
  }

  async function openDocumentLink(link?: string | null) {
    const trimmed = (link ?? '').trim()
    if (!trimmed) return

    const url = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : await buildApiUrl(trimmed, tenantId)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function confirmDeleteDocument() {
    if (!deleteTarget || deletePending) return

    const displayName = deleteTarget.fileName || deleteTarget.nome || 'documento'
    setDeletePending(true)
    try {
      await onDelete(deleteTarget)
      setDeleteTarget(null)
      setDeleteFeedback({
        type: 'success',
        title: 'Documento removido',
        message: `O arquivo "${displayName}" foi removido da sua lista de documentos.`,
      })
    } catch (err) {
      setDeleteFeedback({
        type: 'error',
        title: 'Não foi possível remover',
        message: readError(err),
      })
    } finally {
      setDeletePending(false)
    }
  }

  async function submitDocumentForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (uploadPending) return

    if (!draft.tipo.trim()) {
      setModalError('Selecione o tipo do documento.')
      return
    }

    if (editingItem) {
      await onUpdate(editingItem, {
        tipo: draft.tipo,
        nome: editingItem.nome || editingItem.fileName || 'Documento',
        link: editingItem.link ?? '',
        data: editingItem.data ?? '',
        observacoes: draft.observacoes,
        fileName: editingItem.fileName ?? '',
      })
      closeModal()
      return
    }

    if (!draft.arquivo) {
      setModalError('Selecione um arquivo para enviar.')
      return
    }

    const fileName = draft.arquivo.name
    setUploadPending(true)
    setModalError(null)
    try {
      await onUpload({
        tipo: draft.tipo,
        observacoes: draft.observacoes,
        arquivo: draft.arquivo,
      })
      setModalOpen(false)
      setEditingItem(null)
      resetDraft()
      setUploadFeedback({
        type: 'success',
        title: 'Documento enviado com sucesso',
        message: `O arquivo "${fileName}" já está disponível na sua lista de documentos.`,
      })
    } catch (err) {
      setUploadFeedback({
        type: 'error',
        title: 'Não foi possível enviar',
        message: readError(err),
      })
    } finally {
      setUploadPending(false)
    }
  }

  return (
    <div className="subsection-card document-section-card">
      <div className="subsection-head document-section-head">
        <div>
          <span className="eyebrow">Central de arquivos</span>
          <strong>{title}</strong>
        </div>
        <button className="secondary-btn" type="button" onClick={openCreate}>Adicionar documento</button>
      </div>

      <div className="document-list-grid">
        {items.map((item) => {
          const displayName = item.fileName || item.nome || 'Documento sem nome'
          return (
            <article key={item.id} className="document-card">
              <div className="document-card-head">
                <div className="document-icon" aria-hidden="true">
                  <i className={`fas ${getDocumentIcon(item)}`}></i>
                </div>
                <div>
                  <strong>{displayName}</strong>
                  <p>{item.tipo || 'Tipo não informado'}</p>
                </div>
              </div>
              <dl className={`document-meta-grid${item.data ? '' : ' is-single'}`}>
                {item.data ? (
                  <div>
                    <dt>Data</dt>
                    <dd>{formatDocumentDate(item.data)}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Cadastrado</dt>
                  <dd>{formatJobDate(item.createdAtUtc)}</dd>
                </div>
              </dl>
              <div className="list-item-actions">
                {item.link ? (
                  <button className="document-download-btn" type="button" onClick={() => void openDocumentLink(item.link)}>
                    <i className="fas fa-download" aria-hidden="true"></i>
                    <span>Download</span>
                  </button>
                ) : null}
                <button className="document-remove-btn" type="button" onClick={() => setDeleteTarget(item)}>
                  <i className="fas fa-trash" aria-hidden="true"></i>
                  <span>Remover</span>
                </button>
              </div>
            </article>
          )
        })}
        {items.length === 0 ?(
          <div className="document-empty-state">
            <i className="fas fa-folder-open" aria-hidden="true"></i>
            <strong>Nenhum documento cadastrado ainda.</strong>
            <p>Inclua currículos, certificados, comprovantes ou links relevantes para o seu processo seletivo.</p>
            <button className="secondary-btn" type="button" onClick={openCreate}>Adicionar primeiro documento</button>
          </div>
        ) : null}
      </div>

      {modalOpen ? createPortal((
        <div className="workspace-form-modal-backdrop" onClick={closeModal}>
          <div className="workspace-form-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="workspace-form-modal-header">
              <h3>{editingItem ? 'Editar Documento' : 'Adicionar Documento'}</h3>
              <button className="profile-modal-close" type="button" onClick={closeModal} aria-label="Fechar" disabled={uploadPending}>
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <form
              className="project-form-grid document-form-grid"
              onSubmit={(event) => void submitDocumentForm(event)}
            >
              <div className="workspace-form-modal-body">
                <label>
                  <span>Tipo</span>
                  <select value={draft.tipo} onChange={(event) => setDraft((current) => ({ ...current, tipo: event.target.value }))}>
                    <option value="">Selecione</option>
                    <option value="Currículo">Currículo</option>
                    <option value="Certificado">Certificado</option>
                    <option value="Diploma/Declaração">Diploma/Declaração</option>
                    <option value="Comprovante">Comprovante</option>
                    <option value="Portfólio">Portfólio</option>
                    <option value="Outros">Outro</option>
                  </select>
                </label>
                {!editingItem ? (
                  <label className="document-upload-field">
                    <span>Arquivo</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      disabled={uploadPending}
                      onChange={(event) => setDraft((current) => ({ ...current, arquivo: event.target.files?.[0] ?? null }))}
                    />
                    <small>{draft.arquivo ? draft.arquivo.name : 'PDF, DOC, DOCX, JPG ou PNG.'}</small>
                  </label>
                ) : null}
                <label>
                  <span>Observações</span>
                  <textarea rows={4} value={draft.observacoes} disabled={uploadPending} onChange={(event) => setDraft((current) => ({ ...current, observacoes: event.target.value }))} placeholder="Informe contexto, validade, emissor ou qualquer observação importante." />
                </label>
                {uploadPending ? (
                  <div className="document-upload-pending">
                    <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>
                    <span>Enviando documento...</span>
                  </div>
                ) : null}
                {modalError ? <div className="document-modal-error">{modalError}</div> : null}
              </div>
              <div className="workspace-form-modal-actions">
                <button className="ghost-btn" type="button" onClick={closeModal} disabled={uploadPending}>Cancelar</button>
                <button className="secondary-btn" type="submit" disabled={uploadPending}>
                  {uploadPending ? 'Enviando...' : editingItem ? 'Salvar Documento' : 'Adicionar Documento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ), document.body) : null}
      {uploadFeedback ? createPortal((
        <div className="swal-backdrop" role="presentation" onClick={() => setUploadFeedback(null)}>
          <section
            className={`swal-card ${uploadFeedback.type}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="document-upload-feedback-title"
            aria-describedby="document-upload-feedback-message"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="swal-icon" aria-hidden="true">
              <i className={`fas ${uploadFeedback.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i>
            </div>
            <h3 id="document-upload-feedback-title">{uploadFeedback.title}</h3>
            <p id="document-upload-feedback-message">{uploadFeedback.message}</p>
            <button className="primary-btn" type="button" onClick={() => setUploadFeedback(null)}>Ok</button>
          </section>
        </div>
      ), document.body) : null}
      {deleteTarget ? createPortal((
        <div className="swal-backdrop" role="presentation" onClick={() => !deletePending && setDeleteTarget(null)}>
          <section
            className="swal-card error"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="document-delete-title"
            aria-describedby="document-delete-message"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="swal-icon" aria-hidden="true">
              <i className="fas fa-triangle-exclamation"></i>
            </div>
            <h3 id="document-delete-title">Remover documento?</h3>
            <p id="document-delete-message">
              Esta ação remove o arquivo da sua lista de documentos. Você poderá enviar novamente depois, se necessário.
            </p>
            <div className="swal-actions">
              <button className="secondary-btn" type="button" disabled={deletePending} onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button className="primary-btn" type="button" disabled={deletePending} onClick={() => void confirmDeleteDocument()}>
                {deletePending ? 'Removendo...' : 'Sim, remover'}
              </button>
            </div>
          </section>
        </div>
      ), document.body) : null}
      {deleteFeedback ? createPortal((
        <div className="swal-backdrop" role="presentation" onClick={() => setDeleteFeedback(null)}>
          <section
            className={`swal-card ${deleteFeedback.type}`}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="document-delete-feedback-title"
            aria-describedby="document-delete-feedback-message"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="swal-icon" aria-hidden="true">
              <i className={`fas ${deleteFeedback.type === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}`}></i>
            </div>
            <h3 id="document-delete-feedback-title">{deleteFeedback.title}</h3>
            <p id="document-delete-feedback-message">{deleteFeedback.message}</p>
            <button className="primary-btn" type="button" onClick={() => setDeleteFeedback(null)}>Ok</button>
          </section>
        </div>
      ), document.body) : null}
    </div>
  )
}

function ReferenceRepeaterSection({
  title,
  items,
  onAdd,
  onUpdate,
  onDelete,
}: {
  title: string
  items: PortalReference[]
  onAdd: (values: Record<string, string | boolean>) => void | Promise<void>
  onUpdate: (item: PortalReference, values: Record<string, string | boolean>) => void | Promise<void>
  onDelete: (item: PortalReference) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PortalReference | null>(null)
  const [draft, setDraft] = useState({
    nome: '',
    relacao: '',
    empresa: '',
    cargo: '',
    contato: '',
    periodo: '',
    linkedin: '',
    observacoes: '',
    podeContatar: true,
  })

  function resetDraft() {
    setDraft({
      nome: '',
      relacao: '',
      empresa: '',
      cargo: '',
      contato: '',
      periodo: '',
      linkedin: '',
      observacoes: '',
      podeContatar: true,
    })
  }

  function openCreate() {
    setEditingItem(null)
    resetDraft()
    setModalOpen(true)
  }

  function openEdit(item: PortalReference) {
    setEditingItem(item)
    setDraft({
      nome: item.nome ?? '',
      relacao: item.relacao ?? '',
      empresa: item.empresa ?? '',
      cargo: item.cargo ?? '',
      contato: item.contato ?? '',
      periodo: item.periodo ?? '',
      linkedin: item.linkedin ?? '',
      observacoes: item.observacoes ?? '',
      podeContatar: Boolean(item.podeContatar),
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditingItem(null)
    resetDraft()
  }

  return (
    <div className="subsection-card reference-section-card">
      <div className="subsection-head reference-section-head">
        <div>
          <span className="eyebrow">Rede profissional</span>
          <strong>{title}</strong>
        </div>
        <button className="secondary-btn" type="button" onClick={openCreate}>Adicionar referência</button>
      </div>
      <div className="reference-list-grid">
        {items.map((item) => (
          <article key={item.id} className="reference-card">
            <div className="reference-card-head">
              <div className="reference-avatar" aria-hidden="true">{getInitials(item.nome || 'Referência')}</div>
              <div>
                <strong>{item.nome || 'Referência sem nome'}</strong>
                <p>{[item.relacao, item.empresa].filter(Boolean).join(' - ') || 'Relação não informada'}</p>
              </div>
            </div>
            <dl className="reference-meta-grid">
              <div>
                <dt>Cargo</dt>
                <dd>{item.cargo || 'Não informado'}</dd>
              </div>
              <div>
                <dt>Contato</dt>
                <dd>{item.contato || 'Não informado'}</dd>
              </div>
              <div>
                <dt>Período</dt>
                <dd>{item.periodo || 'Não informado'}</dd>
              </div>
              <div>
                <dt>Contato permitido</dt>
                <dd>{item.podeContatar ? 'Sim' : 'Não'}</dd>
              </div>
            </dl>
            {item.linkedin ? <a className="reference-link" href={item.linkedin} target="_blank" rel="noreferrer">LinkedIn</a> : null}
            {item.observacoes ? <p className="reference-note">{item.observacoes}</p> : null}
            <div className="list-item-actions">
              <button className="ghost-btn" type="button" onClick={() => openEdit(item)}>Editar</button>
              <button className="ghost-btn" type="button" onClick={() => onDelete(item)}>Remover</button>
            </div>
          </article>
        ))}
        {items.length === 0 ?(
          <div className="reference-empty-state">
            <i className="fas fa-users" aria-hidden="true"></i>
            <strong>Nenhuma referência cadastrada ainda.</strong>
            <p>Adicione contatos profissionais que possam confirmar sua trajetória, projetos ou experiência.</p>
            <button className="secondary-btn" type="button" onClick={openCreate}>Adicionar primeira referência</button>
          </div>
        ) : null}
      </div>
      {modalOpen ? createPortal((
        <div className="workspace-form-modal-backdrop" onClick={closeModal}>
          <div className="workspace-form-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="workspace-form-modal-header">
              <h3>{editingItem ? 'Editar Referência' : 'Adicionar Referência'}</h3>
              <button className="profile-modal-close" type="button" onClick={closeModal} aria-label="Fechar">
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <form
              className="project-form-grid reference-form-grid"
              onSubmit={(event) => {
                event.preventDefault()
                if (editingItem) {
                  onUpdate(editingItem, draft)
                } else {
                  onAdd(draft)
                }
                closeModal()
              }}
            >
              <div className="workspace-form-modal-body">
                <label>
                  <span>Nome</span>
                  <input value={draft.nome} onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))} />
                </label>
                <div className="reference-detail-row">
                  <label>
                    <span>Relação</span>
                    <input value={draft.relacao} onChange={(event) => setDraft((current) => ({ ...current, relacao: event.target.value }))} placeholder="Ex.: gestor, colega, cliente..." />
                  </label>
                  <label>
                    <span>Empresa</span>
                    <input value={draft.empresa} onChange={(event) => setDraft((current) => ({ ...current, empresa: event.target.value }))} />
                  </label>
                </div>
                <div className="reference-detail-row">
                  <label>
                    <span>Cargo</span>
                    <input value={draft.cargo} onChange={(event) => setDraft((current) => ({ ...current, cargo: event.target.value }))} />
                  </label>
                  <label>
                    <span>Período</span>
                    <input value={draft.periodo} onChange={(event) => setDraft((current) => ({ ...current, periodo: event.target.value }))} placeholder="Ex.: 2021 a 2024" />
                  </label>
                </div>
                <label>
                  <span>Contato</span>
                  <input value={draft.contato} onChange={(event) => setDraft((current) => ({ ...current, contato: event.target.value }))} placeholder="E-mail, telefone ou WhatsApp" />
                </label>
                <label>
                  <span>LinkedIn</span>
                  <input value={draft.linkedin} onChange={(event) => setDraft((current) => ({ ...current, linkedin: event.target.value }))} placeholder="https://linkedin.com/in/..." />
                </label>
                <label>
                  <span>Observações</span>
                  <textarea rows={4} value={draft.observacoes} onChange={(event) => setDraft((current) => ({ ...current, observacoes: event.target.value }))} placeholder="Contexto da relação, melhor forma de contato ou observações importantes." />
                </label>
                <label className="reference-consent-row">
                  <input type="checkbox" checked={draft.podeContatar} onChange={(event) => setDraft((current) => ({ ...current, podeContatar: event.target.checked }))} />
                  <span>Autorizo contato com esta referência quando necessário.</span>
                </label>
              </div>
              <div className="workspace-form-modal-actions">
                <button className="ghost-btn" type="button" onClick={closeModal}>Cancelar</button>
                <button className="secondary-btn" type="submit">{editingItem ? 'Salvar Referência' : 'Adicionar Referência'}</button>
              </div>
            </form>
          </div>
        </div>
      ), document.body) : null}
    </div>
  )
}

/** Contrato com campo Frequencia (varchar 40) ” valores estáveis recomendados. */
const NOTIFICATION_FREQUENCY_OPTIONS = [
  { value: 'immediate', label: 'Imediato' },
  { value: 'daily', label: 'Resumo diário' },
  { value: 'weekly', label: 'Resumo semanal' },
  { value: 'urgent', label: 'Somente urgentes' },
] as const

/** Mantém valores antigos (rótulos em texto) alinhados aos códigos acima quando o candidato já tinha dados salvos. */
function slugNormNotifications(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

const LEGACY_FREQUENCY_TO_CANONICAL: Record<string, (typeof NOTIFICATION_FREQUENCY_OPTIONS)[number]['value']> = {
  imediato: 'immediate',
  'resumo diario': 'daily',
  'resumo semanal': 'weekly',
  urgentes: 'urgent',
  'somente urgentes': 'urgent',
}

function canonicalFrequenciaFromApi(raw: string): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  const slug = slugNormNotifications(t)
  const canon =
    LEGACY_FREQUENCY_TO_CANONICAL[slug] ??
    LEGACY_FREQUENCY_TO_CANONICAL[t.trim().toLowerCase()] ??
    LEGACY_FREQUENCY_TO_CANONICAL[t]
  if (canon) return canon
  if (NOTIFICATION_FREQUENCY_OPTIONS.some((o) => o.value === t)) return t
  return t
}

/**
 * Silêncio ativo: ver CandidaturaNotificacaoService.EstaDentroSilencio — valores reconhecidos como ligado: true / 1 / on.
 * Vazio=null respeita início/fim quando preenchidos; "false" e outros desligam pela flag explícita.
 */
const SILENCIO_ATIVO_OPTIONS = [
  { value: '', label: 'Automático (preferência não definida; usa só os horários se preenchidos)' },
  { value: 'true', label: 'Sim (true)' },
  { value: 'false', label: 'Não (false) ” ignorar horários mesmo preenchidos' },
] as const

function canonicalSilencioAtivoFromApi(raw: string): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  const l = t.toLowerCase()
  if (l === 'true' || l === '1' || l === 'on' || l === 'sim') return 'true'
  if (l === 'false' || l === '0') return 'false'
  return t
}

/** Contrato campo SilencioPrioridade (varchar 20) ” apenas metadados; sem lógica adicional na API atual. */
const SILENCIO_PRIORIDADE_OPTIONS = [
  { value: '', label: '”' },
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Só urgentes' },
  { value: 'all', label: 'Todas' },
] as const

function canonicalSilencioPrioridadeFromApi(raw: string): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  const slug = slugNormNotifications(t)
  if (slug === 'normal' || t === 'normal') return 'normal'
  if (slug === 'somente urgentes' || slug === 'so urgentes' || t === 'urgent') return 'urgent'
  if (slug === 'todas' || slug === 'todos' || t === 'all') return 'all'
  return t
}

function mergedLabeledOptions(
  presets: readonly { readonly value: string; readonly label: string }[],
  current: string,
  normalize: (raw: string) => string,
) {
  const n = normalize((current ?? '').trim())
  const list = presets.map((o) => ({ value: o.value, label: o.label }))
  if (!n) return list
  if (!list.some((o) => o.value === n))
    list.push({ value: n, label: n.length <= 56 ? `(legado) ${n}` : `(valor legado não listado)` })
  return list
}

const NOTIFICATION_LANG_PRESETS = ['pt-BR', 'en-US', 'es-ES'] as const

const LGPD_SHARING_SCOPE_PRESETS = ['Rh', 'RhGestor', 'Interno'] as const

function CandidateInternalMessagesPanel({
  messages,
  pendingCount,
  onOpenProfile,
  onUpdate,
}: {
  messages: PortalInternalNotification[]
  pendingCount: number
  onOpenProfile: () => void
  onUpdate: (notificationId: string, action: 'read' | 'resolve') => void | Promise<void>
}) {
  return (
    <section className="nl-card" aria-labelledby="rh-messages-title">
      <div className="nl-card-head">
        <div>
          <span className="eyebrow">Mensagens do RH</span>
          <strong id="rh-messages-title">Ações solicitadas pela equipe de recrutamento</strong>
        </div>
        {pendingCount > 0 ? (
          <p><strong>{pendingCount}</strong> pendência(s) aguardando sua ação.</p>
        ) : (
          <p>Nenhuma pendência do RH no momento.</p>
        )}
      </div>

      {messages.length === 0 ? (
        <div className="nl-privacy-pill" role="note">
          <i className="fas fa-circle-check" aria-hidden="true"></i>
          <span>Quando o RH solicitar atualização de dados, a mensagem aparecerá aqui.</span>
        </div>
      ) : (
        <div className="rh-message-list">
          {messages.map((message) => {
            const isRead = Boolean(message.lidaEmUtc)
            const isResolved = Boolean(message.resolvidaEmUtc)
            return (
              <article className="rh-message-card" key={message.id}>
                <div className="rh-message-card-head">
                  <div>
                    <strong>{message.titulo}</strong>
                    <small>
                      {message.vagaTitulo ? `Vaga: ${message.vagaTitulo} · ` : ''}
                      {formatDateTime(message.createdAtUtc)}
                    </small>
                  </div>
                  <span className={`rh-message-status ${isResolved ? 'is-resolved' : isRead ? 'is-read' : 'is-new'}`}>
                    {isResolved ? 'Resolvida' : isRead ? 'Lida' : 'Nova'}
                  </span>
                </div>
                <p>{message.mensagem}</p>
                {message.camposPendentes?.length ? (
                  <div className="rh-message-tags">
                    {message.camposPendentes.map((field) => (
                      <span key={field}>{field}</span>
                    ))}
                  </div>
                ) : null}
                <div className="rh-message-actions">
                  <button className="primary-btn" type="button" onClick={onOpenProfile}>Atualizar perfil</button>
                  {!isRead ? (
                    <button className="ghost-btn" type="button" onClick={() => onUpdate(message.id, 'read')}>Marcar como lida</button>
                  ) : null}
                  {!isResolved ? (
                    <button className="ghost-btn" type="button" onClick={() => onUpdate(message.id, 'resolve')}>Marcar como resolvida</button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function normalizePortalNotificationsForm(n: PortalNotifications | null) {
  const d = n ?? ({} as Partial<PortalNotifications>)
  return {
    canalEmail: Boolean(d.canalEmail),
    canalWhatsapp: Boolean(d.canalWhatsapp),
    canalSms: Boolean(d.canalSms),
    canalPush: Boolean(d.canalPush),
    frequencia: canonicalFrequenciaFromApi(asString(d.frequencia)),
    idioma: asString(d.idioma),
    email: asString(d.email),
    telefone: asString(d.telefone),
    permiteContato: Boolean(d.permiteContato),
    alertaNovasVagas: Boolean(d.alertaNovasVagas),
    alertaAtualizacoes: Boolean(d.alertaAtualizacoes),
    alertaEntrevistas: Boolean(d.alertaEntrevistas),
    alertaMensagens: Boolean(d.alertaMensagens),
    alertaDocumentos: Boolean(d.alertaDocumentos),
    alertaLembretes: Boolean(d.alertaLembretes),
    silencioAtivo: canonicalSilencioAtivoFromApi(asString(d.silencioAtivo)),
    silencioInicio: asString(d.silencioInicio),
    silencioFim: asString(d.silencioFim),
    silencioPrioridade: canonicalSilencioPrioridadeFromApi(asString(d.silencioPrioridade)),
    assinatura: asString(d.assinatura),
  }
}

function CandidateNotificationsWorkspaceForm({
  data,
  onSubmit,
}: {
  data: PortalNotifications | null
  onSubmit: (values: Record<string, string | boolean>) => void | Promise<void>
}) {
  const initial = useMemo(() => normalizePortalNotificationsForm(data), [data])
  const [values, setValues] = useState(initial)
  useEffect(() => {
    setValues(initial)
  }, [initial])

  function setField(name: string, v: string | boolean) {
    setValues((curr) => ({ ...curr, [name]: v }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload: Record<string, string | boolean> = {
      ...values,
      frequencia: String(values.frequencia).trim().slice(0, 40),
      silencioAtivo: String(values.silencioAtivo).trim().slice(0, 10),
      silencioInicio: String(values.silencioInicio).trim().slice(0, 10),
      silencioFim: String(values.silencioFim).trim().slice(0, 10),
      silencioPrioridade: String(values.silencioPrioridade).trim().slice(0, 20),
    }
    void onSubmit(payload)
  }

  const freqOptionsMerged = mergedLabeledOptions(NOTIFICATION_FREQUENCY_OPTIONS, String(values.frequencia), canonicalFrequenciaFromApi)
  const langOptions = mergeEducationSummarySelectOptions(NOTIFICATION_LANG_PRESETS, String(values.idioma))
  const silencioAtivoMerged = mergedLabeledOptions(SILENCIO_ATIVO_OPTIONS, String(values.silencioAtivo), canonicalSilencioAtivoFromApi)
  const silencioPrioridadeMerged = mergedLabeledOptions(SILENCIO_PRIORIDADE_OPTIONS, String(values.silencioPrioridade), canonicalSilencioPrioridadeFromApi)

  return (
    <form className="nl-form" onSubmit={handleSubmit}>
      <header className="nl-hero nl-hero-muted">
        <div>
          <span className="eyebrow">Preferências de comunicação</span>
          <h4>Controle quando e como quer ser avisado sobre o processo seletivo.</h4>
          <p>Você pode ajustar canais, frequência e períodos em que prefere não receber mensagens.</p>
        </div>
        <div className="nl-privacy-pill" role="note">
          <i className="fas fa-bell" aria-hidden="true"></i>
          <span>Preferências aplicadas às comunicações deste portal candidato.</span>
        </div>
      </header>

      <section className="nl-card" aria-labelledby="nl-channels-title">
        <div className="nl-card-head">
          <div>
            <span className="eyebrow">Canais permitidos</span>
            <strong id="nl-channels-title">Onde podemos falar com você?</strong>
          </div>
          <p>Não marque canais que você não usa ou não deseja para evitar ruído.</p>
        </div>
        <div className="nl-toggle-grid" role="group" aria-label="Canais permitidos">
          {[
            { key: 'canalEmail', title: 'E-mail', desc: 'Convites, retornos e resumos.', iconClass: 'fas fa-envelope' },
            { key: 'canalWhatsapp', title: 'WhatsApp', desc: 'Alertas rápidos e lembretes.', iconClass: 'fab fa-whatsapp' },
            { key: 'canalSms', title: 'SMS', desc: 'Avisos curtos quando necessário.', iconClass: 'fas fa-comment-dots' },
            { key: 'canalPush', title: 'Push / app', desc: 'Notificações no navegador ou aplicativo.', iconClass: 'fas fa-mobile-screen' },
          ].map((row) => (
            <button
              key={row.key}
              type="button"
              className={`nl-toggle${values[row.key as keyof typeof values] ? ' is-on' : ''}`}
              onClick={() => setField(row.key, !Boolean(values[row.key as keyof typeof values]))}
              aria-pressed={Boolean(values[row.key as keyof typeof values])}
            >
              <i className={row.iconClass} aria-hidden="true"></i>
              <span>{row.title}</span>
              <small>{row.desc}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="nl-card">
        <div className="nl-card-head">
          <div>
            <span className="eyebrow">Ritmo das mensagens</span>
            <strong>Tom e idioma</strong>
          </div>
        </div>
        <div className="nl-fields-grid nl-fields-grid--2">
          <label className="nl-field">
            <span>Frequência dos resumos</span>
            <select
              value={canonicalFrequenciaFromApi(String(values.frequencia))}
              onChange={(e) => setField('frequencia', e.target.value)}
            >
              <option value="">” Definir depois ”</option>
              {freqOptionsMerged.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <small className="nl-field-hint">Valores gravados pela API como códigos: immediate · daily · weekly · urgent (até 40 caracteres).</small>
          </label>
          <label className="nl-field">
            <span>Idioma dos avisos</span>
            <select value={String(values.idioma)} onChange={(e) => setField('idioma', e.target.value)}>
              <option value="">”</option>
              {langOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <label className="nl-field nl-field-span-2">
            <span>E-mail principal para alertas</span>
            <input type="email" autoComplete="email" value={String(values.email)} onChange={(e) => setField('email', e.target.value)} placeholder="voce@exemplo.com" />
          </label>
          <label className="nl-field nl-field-span-2">
            <span>Telefone ou WhatsApp prioritário</span>
            <input type="tel" autoComplete="tel" value={String(values.telefone)} onChange={(e) => setField('telefone', e.target.value)} placeholder="DDI + DDD + número" />
          </label>
        </div>
      </section>

      <section className="nl-card">
        <div className="nl-card-head">
          <div>
            <span className="eyebrow">Quiet hours</span>
            <strong>Horários de silêncio</strong>
          </div>
          <p>Evite disparos nos intervalos que não quer ser incomodado (quando configurado).</p>
        </div>
        <div className="nl-fields-grid nl-fields-grid--2">
          <label className="nl-field nl-field-span-2">
            <span>Janela de silêncio ativa (SilencioAtivo)</span>
            <select
              value={canonicalSilencioAtivoFromApi(String(values.silencioAtivo))}
              onChange={(e) => setField('silencioAtivo', e.target.value)}
            >
              {silencioAtivoMerged.map((opt) => (
                <option key={`${opt.label}-${opt.value}`} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <small className="nl-field-hint">Servidor aceita até 10 caracteres. Quando aplicável, valores reconhecidos como “ligado” são true, 1 ou on.</small>
          </label>
          <label className="nl-field">
            <span>Início (HH:mm)</span>
            <input
              value={String(values.silencioInicio)}
              onChange={(e) => setField('silencioInicio', e.target.value)}
              placeholder="22:00"
              maxLength={10}
              inputMode="numeric"
            />
          </label>
          <label className="nl-field">
            <span>Fim (HH:mm)</span>
            <input
              value={String(values.silencioFim)}
              onChange={(e) => setField('silencioFim', e.target.value)}
              placeholder="07:00"
              maxLength={10}
              inputMode="numeric"
            />
          </label>
          <label className="nl-field nl-field-span-2">
            <span>Prioridade durante o silêncio (SilencioPrioridade)</span>
            <select
              value={canonicalSilencioPrioridadeFromApi(String(values.silencioPrioridade))}
              onChange={(e) => setField('silencioPrioridade', e.target.value)}
            >
              {silencioPrioridadeMerged.map((opt) => (
                <option key={`${opt.label}-${opt.value}`} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <small className="nl-field-hint">Texto livre até 20 caracteres; sugerimos normal · urgent · all.</small>
          </label>
        </div>
      </section>

      <section className="nl-card">
        <div className="nl-card-head">
          <div>
            <span className="eyebrow">Contato e tipo de alerta</span>
            <strong>O que quer acompanhar?</strong>
          </div>
        </div>
        <label className="nl-consent-line">
          <input type="checkbox" checked={Boolean(values.permiteContato)} onChange={(e) => setField('permiteContato', e.target.checked)} />
          <span>Autorizo o RH a iniciar conversas relacionadas ao meu processo mesmo fora das candidaturas ativas.</span>
        </label>
        <div className="nl-alert-grid">
          {[
            { key: 'alertaNovasVagas', label: 'Novas vagas alinhadas', hint: 'Sugestões com base em perfil.', icon: 'fa-briefcase' },
            { key: 'alertaAtualizacoes', label: 'Atualizações do processo', hint: 'Mudanças de etapa e status.', icon: 'fa-arrows-rotate' },
            { key: 'alertaEntrevistas', label: 'Entrevistas e dinâmicas', hint: 'Convites com data e formato.', icon: 'fa-video' },
            { key: 'alertaMensagens', label: 'Mensagens diretas', hint: 'Comunicações pessoais do recrutador.', icon: 'fa-comments' },
            { key: 'alertaDocumentos', label: 'Documentos e formulários', hint: 'Novos formulários solicitados.', icon: 'fa-file-lines' },
            { key: 'alertaLembretes', label: 'Lembretes e prazos', hint: 'SLA ou entregas pendentes.', icon: 'fa-clock' },
          ].map((row) => (
            <label key={row.key} className="nl-chip-check">
              <input
                type="checkbox"
                checked={Boolean(values[row.key as keyof typeof values])}
                onChange={(e) => setField(row.key, e.target.checked)}
              />
              <div>
                <i className={`fas ${row.icon}`} aria-hidden="true"></i>
                <strong>{row.label}</strong>
                <small>{row.hint}</small>
              </div>
            </label>
          ))}
        </div>
        <label className="nl-field nl-assinatura">
          <span>Observações para o rodapé dos e-mails (opcional)</span>
          <textarea rows={4} value={String(values.assinatura)} onChange={(e) => setField('assinatura', e.target.value)} placeholder="Informações adicionais que podem aparecer na assinatura dos avisos." />
        </label>
      </section>

      <button className="primary-btn nl-submit" type="submit">Salvar notificações</button>
    </form>
  )
}

function normalizePortalLgpdForm(lg: PortalLgpd | null) {
  const x = lg ?? ({} as Partial<PortalLgpd>)
  return {
    processarCandidatura: Boolean(x.processarCandidatura),
    permitirContato: Boolean(x.permitirContato),
    bancoTalentos: Boolean(x.bancoTalentos),
    dadosSensiveis: Boolean(x.dadosSensiveis),
    comunicacoes: Boolean(x.comunicacoes),
    retencaoMeses: x.retencaoMeses != null ? String(x.retencaoMeses) : '',
    compartilhamento: asString(x.compartilhamento),
  }
}

function CandidateLgpdWorkspaceForm({
  data,
  onSubmit,
  onOpenReceipt,
}: {
  data: PortalLgpd | null
  onSubmit: (payload: {
    processarCandidatura: boolean
    permitirContato: boolean
    bancoTalentos: boolean
    dadosSensiveis: boolean
    comunicacoes: boolean
    retencaoMeses: number | null
    compartilhamento: string | null
  }) => void | Promise<void>
  onOpenReceipt: () => void
}) {
  const initial = useMemo(() => normalizePortalLgpdForm(data), [data])
  const [values, setValues] = useState(initial)
  useEffect(() => setValues(initial), [initial])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const months = values.retencaoMeses.trim()
    void onSubmit({
      processarCandidatura: values.processarCandidatura,
      permitirContato: values.permitirContato,
      bancoTalentos: values.bancoTalentos,
      dadosSensiveis: values.dadosSensiveis,
      comunicacoes: values.comunicacoes,
      retencaoMeses: months ? Number(months) : null,
      compartilhamento: values.compartilhamento.trim() ? values.compartilhamento.trim() : null,
    })
  }

  const scopeOptions = mergeEducationSummarySelectOptions(LGPD_SHARING_SCOPE_PRESETS, String(values.compartilhamento))

  return (
    <form className="nl-form nl-form-lgpd" onSubmit={handleSubmit}>
      <header className="nl-hero nl-hero-accent">
        <div>
          <span className="eyebrow">Privacidade e consentimento</span>
          <h4>Você define como seus dados aparecem no processo.</h4>
          <p>Informações tratadas conforme LGPD para recrutamento, triagem de talentos e comunicações relacionadas ao portal.</p>
        </div>
        <div className="nl-privacy-pill" role="note">
          <i className="fas fa-shield-alt" aria-hidden="true"></i>
          <span>Revogue ou atualize suas escolhas a qualquer momento.</span>
        </div>
      </header>

      <section className="nl-card" aria-labelledby="nl-lgpd-consents-title">
        <div className="nl-card-head">
          <div>
            <span className="eyebrow">Preferências tratadas pela equipe</span>
            <strong id="nl-lgpd-consents-title">Uso principal dos dados</strong>
          </div>
          <p>Marque apenas o que estiver confortável. Recomendamos ler cada item antes de salvar.</p>
        </div>
        <div className="nl-lgpd-grid">
          {[
            {
              key: 'processarCandidatura',
              title: 'Processar dados da candidatura',
              desc: 'Permite curadoria do RH nas informações para esta vaga.',
            },
            {
              key: 'permitirContato',
              title: 'Permitir convites externos',
              desc: 'Possibilita iniciativas relacionadas quando houver vagas próximas.',
            },
            {
              key: 'bancoTalentos',
              title: 'Incluir no banco interno',
              desc: 'Dados ficam disponíveis para vagas futuras similares.',
            },
            {
              key: 'dadosSensiveis',
              title: 'Declarar dados sensíveis opcionais',
              desc: 'Quando marcado, usamos apenas para adequações obrigatórias ou informadas por você.',
            },
            {
              key: 'comunicacoes',
              title: 'Comunicações institucionais',
              desc: 'Newsletter de carreira, convites pesquisados e convites relacionados ao portal.',
            },
          ].map((row) => (
            <label key={row.key} className="nl-consent-panel">
              <input
                type="checkbox"
                checked={Boolean(values[row.key as keyof typeof values])}
                onChange={(e) => setValues((curr) => ({ ...curr, [row.key]: e.target.checked }))}
              />
              <div>
                <strong>{row.title}</strong>
                <p>{row.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      <section className="nl-card">
        <div className="nl-card-head">
          <div>
            <span className="eyebrow">Governança de dados</span>
            <strong>Retenção e compartilhamento</strong>
          </div>
        </div>
        <div className="nl-fields-grid nl-fields-grid--2">
          <label className="nl-field">
            <span>Prazo de retenção (meses)</span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              value={values.retencaoMeses}
              onChange={(e) => setValues((v) => ({ ...v, retencaoMeses: e.target.value }))}
              placeholder="Ex.: 12"
            />
          </label>
          <label className="nl-field">
            <span>Escopo de compartilhamento interno</span>
            <select value={String(values.compartilhamento)} onChange={(e) => setValues((v) => ({ ...v, compartilhamento: e.target.value }))}>
              <option value="">” Informar quando necessário ”</option>
              {scopeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <div className="nl-meta-lines nl-field-span-2">
            {data?.consentidoEmUtc ? (
              <p><strong>Consentimento registrado:</strong>{' '} {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data.consentidoEmUtc))}</p>
            ) : (
              <p className="nl-muted-copy">Consentimento será registrado após primeira confirmação nesta tela.</p>
            )}
            {data?.revogadoEmUtc ? (
              <p><strong>Revogações anteriores:</strong>{' '} {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data.revogadoEmUtc))}</p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="nl-actions-row">
        <button className="primary-btn nl-submit" type="submit">Salvar preferências LGPD</button>
        <button type="button" className="secondary-btn nl-receipt-btn" onClick={() => onOpenReceipt()}>
          <i className="fas fa-file-invoice" aria-hidden="true"></i>
          <span>Ver comprovante LGPD</span>
        </button>
      </div>
    </form>
  )
}


const SKILL_TIPO_PRESETS = ['Tecnologia', 'Idioma', 'Metodologia', 'Soft skill', 'Ferramenta', 'Domínio', 'Outro'] as const
const SKILL_NIVEL_PRESETS = ['Iniciante', 'Intermediário', 'Avançado', 'Especialista', 'Expert', 'Nativo / bilíngue'] as const
const PORTFOLIO_SHIFT_PRESETS = [...WORKDAY_OPTIONS]

function spOpenExternalUrl(raw: string, onEmpty?: () => void) {
  const v = raw.trim()
  if (!v) {
    onEmpty?.()
    return
  }
  const href = /^https?:\/\//i.test(v) ? v : `https://${v}`
  window.open(href, '_blank', 'noopener,noreferrer')
}

function CandidateSkillsPortfolioWorkspace({
  portfolio,
  candidateId,
  saveJson,
  setMessage,
}: {
  portfolio: PortalPortfolio | null
  candidateId: string
  saveJson: (path: string, payload: unknown, successText: string, method?: 'PUT' | 'POST') => void | Promise<void>
  setMessage: (message: string | null) => void
}) {
  const initialPrefs = useMemo(
    () => ({
      workModel: portfolio?.preferences.workModel ?? '',
      availability: portfolio?.preferences.availability ?? '',
      salary: portfolio?.preferences.salary ?? '',
      shift: portfolio?.preferences.shift ?? '',
      note: portfolio?.preferences.note ?? '',
      linkedin: portfolio?.links.linkedin ?? '',
      github: portfolio?.links.github ?? '',
      portfolioUrl: portfolio?.links.portfolio ?? '',
      drive: portfolio?.links.drive ?? '',
      tags: portfolio?.tags ?? '',
    }),
    [portfolio],
  )
  const [prefs, setPrefs] = useState(initialPrefs)
  useEffect(() => {
    setPrefs(initialPrefs)
  }, [initialPrefs])

  function patchPrefs<K extends keyof typeof initialPrefs>(key: K, value: string) {
    setPrefs((p) => ({ ...p, [key]: value }))
  }

  function handleSavePortfolio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = {
      workModel: prefs.workModel.trim().slice(0, 40) || null,
      availability: prefs.availability.trim().slice(0, 40) || null,
      salary: prefs.salary.trim().slice(0, 40) || null,
      shift: prefs.shift.trim().slice(0, 40) || null,
      note: prefs.note.trim().slice(0, 200) || null,
      linkedin: prefs.linkedin.trim().slice(0, 260) || null,
      github: prefs.github.trim().slice(0, 260) || null,
      portfolio: prefs.portfolioUrl.trim().slice(0, 260) || null,
      drive: prefs.drive.trim().slice(0, 260) || null,
      tags: prefs.tags.trim().slice(0, 400) || null,
    }
    void saveJson(`/api/public/portal-candidates/${candidateId}/skills-portfolio`, payload, 'Preferências e links salvos.')
  }

  return (
    <div className="sp-workspace nl-form">
      <header className="sp-hero nl-hero nl-hero-accent">
        <div>
          <span className="eyebrow">Destaque-se em poucos campos</span>
          <h4>Portfólio, links e mensagem rápida para recrutadores</h4>
          <p>
            Defina modelo de trabalho preferido, onde o RH pode te encontrar na web e palavras-chave do seu perfil.
            As competências e credenciais detalhadas ficam nos menus próprios à esquerda.
          </p>
        </div>
        <div className="nl-privacy-pill" role="note">
          <i className="fas fa-circle-info" aria-hidden="true"></i>
          <span>Links públicos devem iniciar com <code className="sp-code-inline">https://</code> quando possível.</span>
        </div>
      </header>

      <form className="sp-panel nl-card" onSubmit={handleSavePortfolio}>
        <div className="nl-card-head">
          <div>
            <span className="eyebrow">Visão rápida</span>
            <strong>Preferências e links do portfólio</strong>
          </div>
          <p>Modelo de trabalho, links públicos e tags passam no mesmo salvamento ” preencha o que fizer sentido para o seu momento de carreira.</p>
        </div>
        <div className="nl-fields-grid nl-fields-grid--2">
          <label className="nl-field">
            <span>Modelo de trabalho</span>
            <select value={prefs.workModel} onChange={(e) => patchPrefs('workModel', e.target.value)}>
              <option value="">”</option>
              {mergeEducationSummarySelectOptions(WORK_MODEL_OPTIONS, prefs.workModel).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <label className="nl-field">
            <span>Disponibilidade</span>
            <select value={prefs.availability} onChange={(e) => patchPrefs('availability', e.target.value)}>
              <option value="">”</option>
              {mergeEducationSummarySelectOptions(AVAILABILITY_OPTIONS, prefs.availability).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <label className="nl-field">
            <span>Pretensão / faixa breve</span>
            <input value={prefs.salary} onChange={(e) => patchPrefs('salary', e.target.value)} placeholder="Ex.: R$ 8“10k PJ" maxLength={40} />
          </label>
          <label className="nl-field">
            <span>Jornada / turno preferido</span>
            <select value={prefs.shift} onChange={(e) => patchPrefs('shift', e.target.value)}>
              <option value="">”</option>
              {mergeEducationSummarySelectOptions(PORTFOLIO_SHIFT_PRESETS, prefs.shift).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <label className="nl-field nl-field-span-2">
            <span>Notas para o RH (opcional)</span>
            <textarea rows={3} value={prefs.note} onChange={(e) => patchPrefs('note', e.target.value)} placeholder="Ex.: aberto a remoto nacional, disponível para mudança..." maxLength={200} />
          </label>
        </div>

        <div className="sp-links-head">
          <strong>URLs públicos</strong>
          <p className="nl-muted-copy">Opcionalmente abrimos cada endereço em nova aba para você conferir antes de gravar.</p>
        </div>
        <div className="sp-links-grid">
          <label className="nl-field">
            <span><i className="fab fa-linkedin" aria-hidden="true"></i> LinkedIn</span>
            <div className="sp-link-inline-row">
              <input type="url" inputMode="url" value={prefs.linkedin} onChange={(e) => patchPrefs('linkedin', e.target.value)} placeholder="https://linkedin.com/in/..." />
              <button type="button" className="ghost-btn sp-mini-link-btn" onClick={() => spOpenExternalUrl(prefs.linkedin, () => setMessage('Informe o link do LinkedIn.'))}>Abrir</button>
            </div>
          </label>
          <label className="nl-field">
            <span><i className="fab fa-github" aria-hidden="true"></i> GitHub</span>
            <div className="sp-link-inline-row">
              <input type="url" value={prefs.github} onChange={(e) => patchPrefs('github', e.target.value)} placeholder="https://github.com/..." />
              <button type="button" className="ghost-btn sp-mini-link-btn" onClick={() => spOpenExternalUrl(prefs.github, () => setMessage('Informe o link do GitHub.'))}>Abrir</button>
            </div>
          </label>
          <label className="nl-field">
            <span><i className="fas fa-briefcase" aria-hidden="true"></i> Portfólio / site</span>
            <div className="sp-link-inline-row">
              <input type="url" value={prefs.portfolioUrl} onChange={(e) => patchPrefs('portfolioUrl', e.target.value)} placeholder="https://..." />
              <button type="button" className="ghost-btn sp-mini-link-btn" onClick={() => spOpenExternalUrl(prefs.portfolioUrl, () => setMessage('Informe o URL do portfólio.'))}>Abrir</button>
            </div>
          </label>
          <label className="nl-field">
            <span><i className="fab fa-google-drive" aria-hidden="true"></i> Drive / pasta</span>
            <div className="sp-link-inline-row">
              <input type="url" value={prefs.drive} onChange={(e) => patchPrefs('drive', e.target.value)} placeholder="https://drive.google.com/..." />
              <button type="button" className="ghost-btn sp-mini-link-btn" onClick={() => spOpenExternalUrl(prefs.drive, () => setMessage('Informe o link do Drive.'))}>Abrir</button>
            </div>
          </label>
          <label className="nl-field nl-field-span-2">
            <span>Palavras-chave (tags)</span>
            <textarea rows={2} value={prefs.tags} onChange={(e) => patchPrefs('tags', e.target.value)} placeholder="Ex.: React · Node · Scrum · inglês técnico" maxLength={400} />
          </label>
        </div>
        <button className="primary-btn sp-save-prefs-btn" type="submit">Salvar preferências e links</button>
      </form>
    </div>
  )
}

function SkillsPortfolioRepeater({
  candidateId,
  items,
  saveJson,
  removeItem,
  setMessage,
}: {
  candidateId: string
  items: PortalSkill[]
  saveJson: (path: string, payload: unknown, successText: string, method?: 'PUT' | 'POST') => void | Promise<void>
  removeItem: (path: string, successText: string) => void | Promise<void>
  setMessage: (message: string | null) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PortalSkill | null>(null)
  const [draft, setDraft] = useState({ tipo: '', nome: '', nivel: '', evidencia: '' })

  const tipoOptions = useMemo(() => mergeEducationSummarySelectOptions(SKILL_TIPO_PRESETS as unknown as readonly string[], draft.tipo), [draft.tipo])
  const nivelOptions = useMemo(() => mergeEducationSummarySelectOptions(SKILL_NIVEL_PRESETS as unknown as readonly string[], draft.nivel), [draft.nivel])

  function openCreate() {
    setEditing(null)
    setDraft({ tipo: SKILL_TIPO_PRESETS[0] ?? '', nome: '', nivel: SKILL_NIVEL_PRESETS[1] ?? 'Intermediário', evidencia: '' })
    setModalOpen(true)
  }

  function openEdit(item: PortalSkill) {
    setEditing(item)
    setDraft({
      tipo: item.tipo,
      nome: item.nome,
      nivel: item.nivel,
      evidencia: item.evidencia ?? '',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  return (
    <section className="sp-panel nl-card">
      <div className="nl-card-head">
        <div>
          <span className="eyebrow">Competências</span>
          <strong>Lista de skills</strong>
        </div>
        <p>Detalhe tipo, nível e uma evidência (certificação, projeto ou resultado).</p>
      </div>

      <div className="sp-item-list">
        {items.map((item) => (
          <article key={item.id} className="sp-item-card">
            <div className="sp-item-body">
              <div className="sp-item-heading">
                <strong>{item.nome}</strong>
                <span className="sp-badge">{item.tipo}</span>
                <span className="sp-badge sp-badge-soft">{item.nivel}</span>
              </div>
              {item.evidencia?.trim() ? <p className="sp-item-meta">{item.evidencia}</p> : <p className="sp-item-meta sp-muted">Sem evidência curta cadastrada.</p>}
            </div>
            <div className="sp-item-actions">
              <button type="button" className="ghost-btn" onClick={() => openEdit(item)}>Editar</button>
              <button type="button" className="ghost-btn danger" onClick={() => void removeItem(`/api/public/portal-candidates/${candidateId}/skills-portfolio/skills/${item.id}`, 'Skill removida.')}>Remover</button>
            </div>
          </article>
        ))}
        {items.length === 0 ? (
          <div className="sp-empty">
            <i className="fas fa-layer-group" aria-hidden="true"></i>
            <p>Nenhuma skill cadastrada. Comece pela principal tecnologia ou idioma do seu dia a dia.</p>
          </div>
        ) : null}
      </div>

      <button className="secondary-btn sp-add-btn" type="button" onClick={openCreate}>
        Adicionar competência
      </button>

      {modalOpen ? createPortal(
        <div className="workspace-form-modal-backdrop" onClick={closeModal} role="presentation">
          <div className="workspace-form-modal-card workspace-form-modal-card--skills" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="sp-skill-modal-title">
            <div className="workspace-form-modal-header">
              <h3 id="sp-skill-modal-title">{editing ? 'Editar competência' : 'Nova competência'}</h3>
              <button type="button" className="profile-modal-close" aria-label="Fechar" onClick={closeModal}>
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <form
              className="project-form-grid"
              onSubmit={(event) => {
                event.preventDefault()
                const nome = draft.nome.trim().slice(0, 120)
                const tipo = draft.tipo.trim().slice(0, 40)
                const nivel = draft.nivel.trim().slice(0, 40)
                if (!nome || !tipo || !nivel) {
                  setMessage('Informe nome, tipo e nível da competência.')
                  return
                }
                const evidencia = draft.evidencia.trim().slice(0, 300) || undefined
                const payload = { tipo, nome, nivel, evidencia: evidencia ?? null }
                const pathEditing = `/api/public/portal-candidates/${candidateId}/skills-portfolio/skills/${editing?.id ?? ''}`
                if (editing) {
                  void saveJson(pathEditing, payload, 'Competência atualizada.')
                } else {
                  void saveJson(`/api/public/portal-candidates/${candidateId}/skills-portfolio/skills`, payload, 'Competência adicionada.', 'POST')
                }
                closeModal()
              }}
            >
              <div className="workspace-form-modal-body">
                <label className="nl-field">
                  <span>Categoria</span>
                  <select value={draft.tipo} onChange={(e) => setDraft((d) => ({ ...d, tipo: e.target.value }))}>
                    {tipoOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </label>
                <label className="nl-field">
                  <span>Nome da competência</span>
                  <input value={draft.nome} onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))} placeholder="Ex.: TypeScript · Inglês C1 · Facilitação Agile" maxLength={120} />
                </label>
                <label className="nl-field">
                  <span>Nível</span>
                  <select value={draft.nivel} onChange={(e) => setDraft((d) => ({ ...d, nivel: e.target.value }))}>
                    {nivelOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </label>
                <label className="nl-field">
                  <span>Evidência (opcional)</span>
                  <textarea rows={3} value={draft.evidencia} onChange={(e) => setDraft((d) => ({ ...d, evidencia: e.target.value }))} placeholder="Ex.: certificado X, projeto no GitHub, avaliações internas" maxLength={300} />
                </label>
              </div>
              <div className="workspace-form-modal-actions">
                <button type="button" className="ghost-btn" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="secondary-btn">{editing ? 'Salvar alterações' : 'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      ) : null}
    </section>
  )
}

function CertificationsPortfolioRepeater({
  candidateId,
  items,
  saveJson,
  removeItem,
  setMessage,
}: {
  candidateId: string
  items: PortalCertification[]
  saveJson: (path: string, payload: unknown, successText: string, method?: 'PUT' | 'POST') => void | Promise<void>
  removeItem: (path: string, successText: string) => void | Promise<void>
  setMessage: (message: string | null) => void
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PortalCertification | null>(null)
  const [draft, setDraft] = useState({ nome: '', instituicao: '', ano: '', link: '' })

  function openCreate() {
    setEditing(null)
    setDraft({ nome: '', instituicao: '', ano: '', link: '' })
    setModalOpen(true)
  }

  function openEdit(item: PortalCertification) {
    setEditing(item)
    setDraft({
      nome: item.nome,
      instituicao: item.instituicao ?? '',
      ano: item.ano ?? '',
      link: item.link ?? '',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  return (
    <section className="sp-panel nl-card">
      <div className="nl-card-head">
        <div>
          <span className="eyebrow">Credenciais</span>
          <strong>Certificações e cursos</strong>
        </div>
        <p>Cursos rápidos, certificações oficiais ou treinamentos com link de validação.</p>
      </div>

      <div className="sp-item-list">
        {items.map((item) => (
          <article key={item.id} className="sp-item-card">
            <div className="sp-item-body">
              <div className="sp-item-heading">
                <strong>{item.nome}</strong>
                {item.ano?.trim() ? <span className="sp-badge sp-badge-soft">{item.ano}</span> : null}
              </div>
              <p className="sp-item-meta">{item.instituicao?.trim() || 'Instituição não informada'}</p>
              {item.link?.trim() ? (
                <button type="button" className="sp-text-link-btn" onClick={() => spOpenExternalUrl(item.link ?? '')}>
                  <i className="fas fa-arrow-up-right-from-square"></i>
                  {' '}Abrir comprovação / link público
                </button>
              ) : (
                <p className="sp-item-meta sp-muted">Sem link de verificação</p>
              )}
            </div>
            <div className="sp-item-actions">
              <button type="button" className="ghost-btn" onClick={() => openEdit(item)}>Editar</button>
              <button type="button" className="ghost-btn danger" onClick={() => void removeItem(`/api/public/portal-candidates/${candidateId}/skills-portfolio/certifications/${item.id}`, 'Certificação removida.')}>Remover</button>
            </div>
          </article>
        ))}
        {items.length === 0 ? (
          <div className="sp-empty">
            <i className="fas fa-certificate" aria-hidden="true"></i>
            <p>Nenhuma certificação cadastrada. Ótimo para destaque em cloud, idiomas ou certificações comportamentais.</p>
          </div>
        ) : null}
      </div>

      <button className="secondary-btn sp-add-btn" type="button" onClick={openCreate}>
        Adicionar certificação
      </button>

      {modalOpen ? createPortal(
        <div className="workspace-form-modal-backdrop" onClick={closeModal} role="presentation">
          <div className="workspace-form-modal-card workspace-form-modal-card--skills" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="workspace-form-modal-header">
              <h3>{editing ? 'Editar certificação' : 'Nova certificação'}</h3>
              <button type="button" className="profile-modal-close" aria-label="Fechar" onClick={closeModal}>
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>
            <form
              className="project-form-grid"
              onSubmit={(event) => {
                event.preventDefault()
                const nome = draft.nome.trim().slice(0, 160)
                if (!nome) {
                  setMessage('Informe o nome da certificação ou curso.')
                  return
                }
                const instituicao = draft.instituicao.trim().slice(0, 160) || undefined
                const ano = draft.ano.trim().slice(0, 10) || undefined
                const link = draft.link.trim().slice(0, 260) || undefined
                const payload = { nome, instituicao: instituicao ?? null, ano: ano ?? null, link: link ?? null }
                if (editing) {
                  void saveJson(
                    `/api/public/portal-candidates/${candidateId}/skills-portfolio/certifications/${editing.id}`,
                    payload,
                    'Certificação atualizada.',
                  )
                } else {
                  void saveJson(`/api/public/portal-candidates/${candidateId}/skills-portfolio/certifications`, payload, 'Certificação adicionada.', 'POST')
                }
                closeModal()
              }}
            >
              <div className="workspace-form-modal-body">
                <label className="nl-field">
                  <span>Nome da certificação ou curso</span>
                  <input value={draft.nome} onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))} maxLength={160} />
                </label>
                <label className="nl-field">
                  <span>Instituição (opcional)</span>
                  <input value={draft.instituicao} onChange={(e) => setDraft((d) => ({ ...d, instituicao: e.target.value }))} maxLength={160} />
                </label>
                <label className="nl-field">
                  <span>Ano ou validade breve</span>
                  <input value={draft.ano} onChange={(e) => setDraft((d) => ({ ...d, ano: e.target.value }))} placeholder="Ex.: 2024 ou 06/2025" maxLength={10} />
                </label>
                <label className="nl-field">
                  <span>Link público (opcional)</span>
                  <input type="url" value={draft.link} onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value }))} placeholder="https://..." maxLength={260} />
                </label>
              </div>
              <div className="workspace-form-modal-actions">
                <button type="button" className="ghost-btn" onClick={closeModal}>Cancelar</button>
                <button type="submit" className="secondary-btn">{editing ? 'Salvar alterações' : 'Adicionar'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      ) : null}
    </section>
  )
}

function RecordForm({
  fields,
  checks,
  onSubmit,
  submitLabel = 'Salvar seção',
  submitButtonClassName = 'primary-btn',
  formClassName,
}: {
  fields: { label: string; name: string; value?: string | null; kind?: 'input' | 'textarea' | 'select'; options?: readonly string[]; inputType?: 'text' | 'date' | 'url' | 'email' | 'number' }[]
  checks?: { name: string; checked?: boolean; label?: string; hint?: string }[]
  onSubmit: (values: Record<string, string | boolean>) => void
  submitLabel?: string
  submitButtonClassName?: string
  formClassName?: string
}) {
  const initial = useMemo(() => {
    const values: Record<string, string | boolean> = {}
    for (const fieldItem of fields) values[fieldItem.name] = fieldItem.value ?? ''
    for (const checkItem of checks ?? []) values[checkItem.name] = Boolean(checkItem.checked)
    return values
  }, [checks, fields])
  const [values, setValues] = useState(initial)

  useEffect(() => {
    setValues(initial)
  }, [initial])

  return (
    <form
      className={formClassName ?`stack-form ${formClassName}` : 'stack-form'}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(values)
      }}
    >
      {fields.map((fieldItem) => (
        <label key={fieldItem.name}>
          <span>{fieldItem.label}</span>
          {fieldItem.kind === 'textarea' ?(
            <textarea rows={4} value={String(values[fieldItem.name] ?? '')} onChange={(e) => setValues((v) => ({ ...v, [fieldItem.name]: e.target.value }))} />
          ) : fieldItem.kind === 'select' && fieldItem.options?.length ?(
            <select
              value={String(values[fieldItem.name] ?? '')}
              onChange={(e) => setValues((v) => ({ ...v, [fieldItem.name]: e.target.value }))}
            >
              <option value="">”</option>
              {mergeEducationSummarySelectOptions(fieldItem.options, String(values[fieldItem.name] ?? '')).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              type={fieldItem.inputType ?? 'text'}
              value={String(values[fieldItem.name] ?? '')}
              onChange={(e) => setValues((v) => ({ ...v, [fieldItem.name]: e.target.value }))}
            />
          )}
        </label>
      ))}
      {checks?.length ?(
        <div className="checks-grid">
          {checks.map((checkItem) => (
            <label key={checkItem.name} className={`check-row${checkItem.hint ? ' check-row-rich' : ''}`}>
              <input
                type="checkbox"
                checked={Boolean(values[checkItem.name])}
                onChange={(e) => setValues((v) => ({ ...v, [checkItem.name]: e.target.checked }))}
              />
              <span>
                {checkItem.label ?? checkItem.name}
                {checkItem.hint ? <small className="check-hint">{checkItem.hint}</small> : null}
              </span>
            </label>
          ))}
        </div>
      ) : null}
      <button className={submitButtonClassName} type="submit">{submitLabel}</button>
    </form>
  )
}

function RepeaterSection<TItem extends { id: string }>({
  title,
  items,
  describe,
  fields,
  onAdd,
  onDelete,
}: {
  title: string
  items: TItem[]
  describe: (item: TItem) => string
  fields: { name: string; label: string }[]
  onAdd: (values: Record<string, string>) => void
  onDelete: (item: TItem) => void
}) {
  const [draft, setDraft] = useState<Record<string, string>>({})

  return (
    <div className="subsection-card">
      <div className="subsection-head">
        <strong>{title}</strong>
        <span>{items.length} item(ns)</span>
      </div>
      <div className="list-shell">
        {items.map((item) => (
          <article key={item.id} className="list-item">
            <div>
              <strong>{getRepeaterTitle(item)}</strong>
              <p>{describe(item)}</p>
            </div>
            <button className="ghost-btn" type="button" onClick={() => onDelete(item)}>Remover</button>
          </article>
        ))}
        {items.length === 0 ?<div className="empty-inline">Nenhum item registrado ainda.</div> : null}
      </div>
      <form
        className="grid-form"
        onSubmit={(event) => {
          event.preventDefault()
          onAdd(draft)
          setDraft({})
        }}
      >
        {fields.map((fieldItem) => (
          <label key={fieldItem.name}>
            <span>{fieldItem.label}</span>
            <input value={draft[fieldItem.name] ?? ''} onChange={(e) => setDraft((v) => ({ ...v, [fieldItem.name]: e.target.value }))} />
          </label>
        ))}
        <button className="secondary-btn" type="submit">Adicionar</button>
      </form>
    </div>
  )
}

function PageLoading({ label }: { label: string }) {
  return (
    <main className="page-shell">
      <section className="state-card loading">
        <div className="loader" />
        <p>{label}</p>
      </section>
    </main>
  )
}

const EDUCATION_SUMMARY_NIVEL_PRESETS = [
  'Ensino fundamental',
  'Ensino médio',
  'Técnico',
  'Tecnólogo',
  'Superior (graduação)',
  'Pós-graduação',
  'Mestrado',
  'Doutorado',
] as const

const EDUCATION_SUMMARY_SITUACAO_PRESETS = [
  'Cursando',
  'Concluído',
  'Incompleto',
  'Interrompido',
  'Trancado',
] as const

function mergeEducationSummarySelectOptions(presets: readonly string[], current: string) {
  const merged = [...presets]
  const t = current.trim()
  if (t && !merged.includes(t)) merged.push(t)
  return merged
}

function field(
  name: string,
  value?: string | null,
  kind: 'input' | 'textarea' = 'input',
  displayLabel?: string,
) {
  return { label: displayLabel ?? name, name, value, kind }
}

function fieldSelect(
  name: string,
  value: string | null | undefined,
  presets: readonly string[],
  displayLabel: string,
) {
  return { label: displayLabel, name, value, kind: 'select' as const, options: presets }
}

function fieldDate(name: string, value: string | null | undefined, displayLabel: string) {
  return { label: displayLabel, name, value, kind: 'input' as const, inputType: 'date' as const }
}

function check(name: string, checked?: boolean, label?: string, hint?: string) {
  return { name, checked, label, hint }
}

function formatJobDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data não informada'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date)
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Data não informada'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data não informada'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function isRecentJob(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  return date.getTime() > Date.now() - 3 * 24 * 60 * 60 * 1000
}

function formatDocumentDate(value?: string | null) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return formatJobDate(value)
  return value
}

function getDocumentIcon(documentItem: PortalDocument) {
  const text = normalizeSearchText(`${documentItem.tipo} ${documentItem.nome} ${documentItem.fileName ?? ''}`)
  if (text.includes('pdf')) return 'fa-file-pdf'
  if (text.includes('curriculo') || text.includes('curriculum')) return 'fa-file-lines'
  if (text.includes('certificado') || text.includes('diploma')) return 'fa-certificate'
  if (text.includes('portfolio')) return 'fa-briefcase'
  if (text.includes('link')) return 'fa-link'
  return 'fa-file-alt'
}

function listUniqueJobValues(jobs: PortalJob[], pick: (job: PortalJob) => string | null | undefined) {
  return Array.from(
    new Set(
      jobs
        .map((job) => (pick(job) || '').trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

function filterJobsBySearch(jobs: PortalJob[], query: string) {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return jobs

  return jobs.filter((job) => {
    const searchable = normalizeSearchText([
      job.titulo,
      job.tenantName,
      job.area,
      job.cidade,
      job.uf,
      job.modalidade,
      job.tipoContratacao,
      job.senioridade,
      job.descricaoPublica,
      job.tagsKeywordsRaw,
      job.tagsStackRaw,
      job.tagsResponsabilidadesRaw,
    ].filter(Boolean).join(' '))

    return terms.every((term) => searchable.includes(term))
  })
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseJobTags(raw: string | null | undefined) {
  if (!raw) return []
  return raw
    .split(/[,;|]/g)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function buildJobTags(job: PortalJob) {
  return Array.from(
    new Set([
      ...parseJobTags(job.tagsKeywordsRaw),
      ...parseJobTags(job.tagsStackRaw),
      ...parseJobTags(job.tagsResponsabilidadesRaw),
    ]),
  )
}

function buildJobBadgeValues(job: PortalJob) {
  return [job.modalidade, job.tipoContratacao, job.senioridade].filter(Boolean) as string[]
}

function formatJobLocation(job: PortalJob) {
  const city = (job.cidade || '').trim()
  const uf = (job.uf || '').trim()
  if (city && uf) return `${city}, ${uf}`
  if (city) return city
  if (uf) return uf
  return job.modalidade || 'Local a definir'
}

function formatCandidateCityUf(city?: string | null, uf?: string | null) {
  const normalizedCity = (city || '').trim()
  const normalizedUf = (uf || '').trim().toUpperCase()
  if (normalizedCity && normalizedUf) return `${normalizedCity} / ${normalizedUf}`
  if (normalizedCity) return normalizedCity
  return normalizedUf
}

function normalizeCityUfForSubmit(value: string) {
  const cleaned = value.trim()
  const slashParts = cleaned.split('/').map((part) => part.trim()).filter(Boolean)
  if (slashParts.length >= 2) return `${slashParts[0]}, ${slashParts[1].toUpperCase()}`
  return cleaned
}

function formatBrazilianPhone(value?: string | null) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function getInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  return (parts[0]?.slice(0, 1) || 'U').toUpperCase()
}

function getRepeaterTitle(item: Record<string, unknown>) {
  const keys = ['nome', 'curso', 'empresa', 'titulo', 'title']
  for (const key of keys) {
    const value = item[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }

  return 'Item'
}

function withTenant(path: string, tenantId: string) {
  const separator = path.includes('?') ?'&' : '?'
  return `${path}${separator}${TENANT_QUERY_KEY}=${encodeURIComponent(tenantId)}`
}

function loadStoredSession(storageKey: string, tenantId: string) {
  try {
    const raw = localStorage.getItem(storageKey)
    return raw ?normalizeAuthSession(JSON.parse(raw) as AuthResponse, tenantId) : null
  } catch {
    return null
  }
}

function normalizeAuthSession(response: AuthResponse, tenantId: string): AuthSession {
  if (isAuthSession(response)) {
    return {
      ...response,
      candidate: {
        ...response.candidate,
        tenantId: response.candidate.tenantId || tenantId,
      },
    }
  }

  return {
    accessToken: '',
    accessTokenExpiresAtUtc: '',
    accessTokenExpiresInSeconds: 0,
    refreshToken: '',
    refreshTokenExpiresAtUtc: '',
    candidate: {
      id: response.id,
      nome: response.nome,
      email: response.email,
      tenantId: response.tenantId || tenantId,
    },
  }
}

function isAuthSession(response: AuthResponse): response is AuthSession {
  return 'candidate' in response
}

function persistSession(storageKey: string, session: AuthSession) {
  localStorage.setItem(storageKey, JSON.stringify(session))
}

function clearSession(storageKey: string) {
  localStorage.removeItem(storageKey)
}

async function signOutPortalSession(ctx: AuthContext) {
  if (ctx.session) {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'X-Tenant-Id': ctx.tenantId,
        ...(ctx.session.accessToken ?{ Authorization: `Bearer ${ctx.session.accessToken}` } : {}),
      }

      await fetch(await buildApiUrl('/api/public/portal-auth/logout', ctx.tenantId), {
        method: 'POST',
        headers,
        body: JSON.stringify({ refreshToken: ctx.session.refreshToken }),
      })
    } catch {
      // best effort
    }
  }

  ctx.setSession(null)
}

async function buildApiUrl(path: string, tenantId?: string) {
  const baseUrl = await resolveApiBaseUrl()
  const normalized = path.startsWith('/') ?path : `/${path}`
  const url = new URL(baseUrl ?`${baseUrl}${normalized}` : normalized, window.location.origin)
  if (tenantId) {
    url.searchParams.set(TENANT_QUERY_KEY, tenantId)
  }
  return url.toString()
}

async function resolveApiBaseUrl() {
  if (resolvedApiBaseUrl) return resolvedApiBaseUrl

  if (import.meta.env.DEV) {
    resolvedApiBaseUrl = DEV_PROXY_BASE_URL
    return resolvedApiBaseUrl
  }

  resolvedApiBaseUrl = API_BASE_URL
  return resolvedApiBaseUrl
}

async function readApiMessage(response: Response) {
  try {
    const data = (await response.json()) as { message?: string }
    return data.message || `Falha HTTP ${response.status}`
  } catch {
    return `Falha HTTP ${response.status}`
  }
}

function readError(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Ocorreu uma falha inesperada.'
}

const COMPLETION_SECTION_LABELS: Record<string, string> = {
  perfil: 'Perfil básico',
  testes: 'Testes',
  comp: 'Competências',
  competencias: 'Competências',
  certs: 'Credenciais',
  credenciais: 'Credenciais',
  certificacoes: 'Credenciais',
  formacao: 'Formação',
  educacao: 'Educação',
  exp: 'Experiências',
  experiencias: 'Experiências',
  projetos: 'Projetos',
  lgpd: 'Privacidade e LGPD',
  pref: 'Preferências',
  preferencias: 'Preferências',
  acess: 'Acessibilidade',
  acessibilidade: 'Acessibilidade',
  agenda: 'Agenda',
  hist: 'Histórico',
  historico: 'Histórico',
  notif: 'Notificações',
  notificacoes: 'Notificações',
  docs: 'Documentos',
  documentos: 'Documentos',
  refs: 'Referências',
  referencias: 'Referências',
}

function clampCompletionPercent(value?: number | null) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
}

function formatCompletionSectionLabel(key: string) {
  const normalized = normalizeSearchText(key).replace(/[^a-z0-9]/g, '')
  return COMPLETION_SECTION_LABELS[normalized] ?? key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/^./, (letter) => letter.toLocaleUpperCase('pt-BR'))
}

function getCompletionTargetSection(key: string): WorkspaceSectionId | null {
  const normalized = normalizeSearchText(key).replace(/[^a-z0-9]/g, '')
  const targets: Partial<Record<string, WorkspaceSectionId>> = {
    perfil: 'perfil-curriculo',
    formacao: 'cursos-formacoes',
    formacoes: 'cursos-formacoes',
    cursos: 'cursos-formacoes',
    cursosformacoes: 'cursos-formacoes',
    educacao: 'educacao',
    exp: 'experiencias',
    experiencias: 'experiencias',
    projetos: 'projetos',
    pref: 'preferencias',
    preferencias: 'preferencias',
    comp: 'competencias',
    competencias: 'competencias',
    certs: 'credenciais',
    certificacoes: 'credenciais',
    credenciais: 'credenciais',
    docs: 'documentos',
    documentos: 'documentos',
    refs: 'referencias',
    referencias: 'referencias',
    acess: 'acessibilidade',
    acessibilidade: 'acessibilidade',
    lgpd: 'lgpd',
    notif: 'notificacoes',
    notificacoes: 'notificacoes',
  }
  return targets[normalized] ?? null
}

function getCompletionTone(value: number) {
  if (value >= 100) return { label: 'Completo', className: 'is-complete' }
  if (value >= 70) return { label: 'Bom avanço', className: 'is-good' }
  if (value >= 40) return { label: 'Em progresso', className: 'is-medium' }
  return { label: 'Priorizar', className: 'is-low' }
}

function formatSuggestionImpact(value?: string | null) {
  const normalized = normalizeSearchText(value ?? '')
  if (normalized.includes('alto')) return { label: 'Alto impacto', className: 'is-high' }
  if (normalized.includes('baixo')) return { label: 'Baixo impacto', className: 'is-low' }
  return { label: 'Médio impacto', className: 'is-medium' }
}

function formatMatchLocation(match: PortalMatchItem) {
  const location = [match.city, match.uf].filter(Boolean).join(', ')
  return [match.area, location].filter(Boolean).join(' - ') || 'Local e área não informados'
}

function normalizeAccessibility(accessibility: PortalAccessibility | null): PortalAccessibility {
  return {
    idioma: asString(accessibility?.idioma),
    canal: asString(accessibility?.canal),
    melhorHorario: asString(accessibility?.melhorHorario),
    observacoesComunicacao: asString(accessibility?.observacoesComunicacao),
    precisaLegendas: Boolean(accessibility?.precisaLegendas),
    precisaInterprete: Boolean(accessibility?.precisaInterprete),
    precisaLeitorTela: Boolean(accessibility?.precisaLeitorTela),
    precisaBaixaEstimulo: Boolean(accessibility?.precisaBaixaEstimulo),
    precisaMobilidade: Boolean(accessibility?.precisaMobilidade),
    precisaTempoExtra: Boolean(accessibility?.precisaTempoExtra),
    detalhesNecessidades: asString(accessibility?.detalhesNecessidades),
    consentimentoPcd: Boolean(accessibility?.consentimentoPcd),
    pcdIdentificacao: asString(accessibility?.pcdIdentificacao),
    pcdTipo: asString(accessibility?.pcdTipo),
    pcdComprovacao: asString(accessibility?.pcdComprovacao),
    pcdObservacoes: asString(accessibility?.pcdObservacoes),
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function asString(value: string | null | undefined) {
  return value ?? ''
}

function splitPreferenceList(value?: string | null) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function joinPreferenceList(values: string[]) {
  return values.map((item) => item.trim()).filter(Boolean).join(', ')
}

function mergePreferenceOptions(base: string[], selected: string[]) {
  return Array.from(new Set([...base, ...selected].map((item) => item.trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

function parsePreferredLocation(value?: string | null) {
  const raw = (value ?? '').trim()
  if (!raw) return { cidade: '', uf: '' }
  const slashMatch = raw.match(/^(.+?)\s*\/\s*([A-Z]{2})$/i)
  if (slashMatch) return { cidade: slashMatch[1].trim(), uf: slashMatch[2].trim().toUpperCase() }
  const commaMatch = raw.match(/^(.+?),\s*([A-Z]{2})$/i)
  if (commaMatch) return { cidade: commaMatch[1].trim(), uf: commaMatch[2].trim().toUpperCase() }
  const dashMatch = raw.match(/^(.+?)\s*-\s*([A-Z]{2})$/i)
  if (dashMatch) return { cidade: dashMatch[1].trim(), uf: dashMatch[2].trim().toUpperCase() }
  return { cidade: raw, uf: '' }
}

function formatCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  const cents = Number(digits) / 100
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents)
}

async function openResumeHtml(authFetch: ReturnType<typeof createAuthorizedClient>, candidateId: string) {
  const data = await authFetch<{ fileName: string; html: string }>(`/api/public/portal-candidates/${candidateId}/resume-html`)
  const win = window.open('', '_blank', 'noopener,noreferrer')
  if (!win) return
  win.document.write(data.html)
  win.document.title = data.fileName
}

async function downloadResumePdf(authFetch: ReturnType<typeof createAuthorizedClient>, candidateId: string) {
  const data = await authFetch<{ fileName: string; contentType: string; base64: string }>(`/api/public/portal-candidates/${candidateId}/resume-pdf`)
  const bytes = Uint8Array.from(atob(data.base64), (char) => char.charCodeAt(0))
  const blob = new Blob([bytes], { type: data.contentType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = data.fileName
  link.click()
  URL.revokeObjectURL(url)
}

async function openLgpdReceipt(authFetch: ReturnType<typeof createAuthorizedClient>, candidateId: string) {
  const data = await authFetch<{ html: string }>(`/api/public/portal-candidates/${candidateId}/lgpd/receipt`)
  const win = window.open('', '_blank', 'noopener,noreferrer')
  if (!win) return
  win.document.write(data.html)
}

export default App
