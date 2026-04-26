import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
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
type PortalEducation = { summary: { nivel?: string | null; areaPrincipal?: string | null; situacao?: string | null; destaques?: string | null }; items: PortalEducationItem[] }
type PortalExperience = { id: string; empresa: string; cargo: string; inicio?: string | null; fim?: string | null; local?: string | null; atividades?: string | null }
type PortalProject = { id: string; nome: string; periodo?: string | null; descricao?: string | null; link?: string | null; stack?: string | null; destaques?: string | null }
type PortalExperienceProject = { experiences: PortalExperience[]; projects: PortalProject[] }
type PortalPreferences = Record<string, string | null | undefined> & { updatedAtUtc?: string | null }
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
type PortalAgendaBlock = { id: string; tipo?: string | null; titulo?: string | null; data?: string | null; horario?: string | null; observacoes?: string | null; updatedAtUtc: string }
type PortalAgenda = {
  preferences: {
    formatoEntrevista?: string | null
    inicioDisponivel?: string | null
    avisoPrevio?: string | null
    observacoes?: string | null
    diaSeg: boolean
    diaTer: boolean
    diaQua: boolean
    diaQui: boolean
    diaSex: boolean
    diaSab: boolean
    diaDom: boolean
    periodoManha: boolean
    periodoTarde: boolean
    periodoNoite: boolean
    horarioPreferido?: string | null
    fusoHorario?: string | null
  }
  blocks: PortalAgendaBlock[]
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
  salarioMinimo?: number | null
  salarioMaximo?: number | null
  createdAtUtc: string
  tenantName?: string | null
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
  agenda: PortalAgenda | null
  notifications: PortalNotifications | null
  documents: PortalDocument[]
  references: PortalReference[]
  lgpd: PortalLgpd | null
}

type AccessLanguage = 'pt-BR' | 'en-US' | 'es-ES'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'https://localhost:7073'
const DEFAULT_TENANT = (import.meta.env.VITE_DEFAULT_TENANT as string | undefined) ?? 'liotecnica'
const TENANT_QUERY_KEY = 'tenantId'
const ACCESS_LANGUAGE_STORAGE_KEY = 'portal-vagas-lang'
const DEV_PROXY_BASE_URL = ''
let resolvedApiBaseUrl: string | null = null

const ACCESS_TRANSLATIONS: Record<AccessLanguage, Record<string, string>> = {
  'pt-BR': {
    helpLink: 'Precisa de ajuda?',
    title: 'Acesse sua conta',
    subtitle: 'Faça o seu login ou crie a sua conta. É simples e rápido.',
    tenant: 'Tenant',
    email: 'E-mail',
    password: 'Senha',
    loginButton: 'Entrar no portal',
    processing: 'Processando...',
    createHint: 'Ainda não possui acesso?',
    createAccess: 'Criar acesso',
    languageLabel: 'Idioma do perfil',
    helpTitle: 'Como funciona o processo',
    helpSubtitle: 'Etapas para acompanhar sua candidatura.',
    helpStep1: 'Cadastro rápido e perfil único.',
    helpStep2: 'Triagem e retorno em até 5 dias.',
    helpStep3: 'Entrevista com gestor.',
    helpStep4: 'Proposta e onboarding.',
    close: 'Fechar',
    registerTitle: 'Criar acesso',
    registerSubtitle: 'Preencha os dados básicos para entrar no portal.',
    fullName: 'Nome completo',
    phone: 'Telefone',
    city: 'Cidade',
    uf: 'UF',
    confirmPassword: 'Confirmar senha',
    cancel: 'Cancelar',
  },
  'en-US': {
    helpLink: 'Need help?',
    title: 'Access your account',
    subtitle: 'Log in or create your account. It is simple and fast.',
    tenant: 'Tenant',
    email: 'Email',
    password: 'Password',
    loginButton: 'Enter the portal',
    processing: 'Processing...',
    createHint: 'Do not have access yet?',
    createAccess: 'Create access',
    languageLabel: 'Profile language',
    helpTitle: 'How the process works',
    helpSubtitle: 'Steps to follow your application.',
    helpStep1: 'Quick signup and a single profile.',
    helpStep2: 'Screening and response within 5 days.',
    helpStep3: 'Interview with the manager.',
    helpStep4: 'Offer and onboarding.',
    close: 'Close',
    registerTitle: 'Create access',
    registerSubtitle: 'Fill in the basic data to enter the portal.',
    fullName: 'Full name',
    phone: 'Phone',
    city: 'City',
    uf: 'State',
    confirmPassword: 'Confirm password',
    cancel: 'Cancel',
  },
  'es-ES': {
    helpLink: '¿Necesitas ayuda?',
    title: 'Accede a tu cuenta',
    subtitle: 'Inicia sesión o crea tu cuenta. Es simple y rápido.',
    tenant: 'Tenant',
    email: 'Correo',
    password: 'Contraseña',
    loginButton: 'Entrar al portal',
    processing: 'Procesando...',
    createHint: '¿Aún no tienes acceso?',
    createAccess: 'Crear acceso',
    languageLabel: 'Idioma del perfil',
    helpTitle: 'Cómo funciona el proceso',
    helpSubtitle: 'Pasos para seguir tu candidatura.',
    helpStep1: 'Registro rápido y perfil único.',
    helpStep2: 'Filtrado y respuesta en hasta 5 días.',
    helpStep3: 'Entrevista con el responsable.',
    helpStep4: 'Oferta e incorporación.',
    close: 'Cerrar',
    registerTitle: 'Crear acceso',
    registerSubtitle: 'Completa los datos básicos para entrar al portal.',
    fullName: 'Nombre completo',
    phone: 'Teléfono',
    city: 'Ciudad',
    uf: 'Estado',
    confirmPassword: 'Confirmar contraseña',
    cancel: 'Cancelar',
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
                <i className="fas fa-flask" aria-hidden="true"></i>
                <span>LT Portal de Vagas</span>
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
                        <button
                          className="portal-user-dropdown-item"
                          type="button"
                          onClick={() => {
                            setProfileModalOpen(true)
                            setUserMenuOpen(false)
                          }}
                        >
                          Ver perfil
                        </button>
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
        <Route path="/" element={<JobsPage ctx={authContext} />} />
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
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [language, setLanguage] = useState<AccessLanguage>(() => {
    if (typeof window === 'undefined') return 'pt-BR'
    const stored = window.localStorage.getItem(ACCESS_LANGUAGE_STORAGE_KEY)
    return stored === 'en-US' || stored === 'es-ES' || stored === 'pt-BR' ?stored : 'pt-BR'
  })
  const [login, setLogin] = useState({ email: '', password: '' })
  const [register, setRegister] = useState({
    nome: '',
    email: '',
    fone: '',
    cidade: '',
    uf: '',
    password: '',
    confirmPassword: '',
  })
  const text = ACCESS_TRANSLATIONS[language]

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(ACCESS_LANGUAGE_STORAGE_KEY, language)
  }, [language])

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
        throw new Error('As senhas não conferem.')
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
      setShowRegisterModal(false)
      navigate(withTenant('/', ctx.tenantId))
    } catch (err) {
      setRegisterError(readError(err))
    } finally {
      setRegisterPending(false)
    }
  }

  return (
    <main className="auth-page-shell">
      <header className="auth-page-header">
        <div className="auth-page-container auth-page-header-inner">
          <div className="auth-page-brand-spacer" aria-hidden="true"></div>
          <button className="auth-page-help" type="button" onClick={() => setShowHelpModal(true)}>
            {text.helpLink}
          </button>
        </div>
      </header>

      <section className="auth-page-body">
        <div className="auth-page-container auth-page-grid">
          <form className="auth-card auth-card-main" onSubmit={onSubmit}>
            <div className="auth-title">
              <img className="auth-logo-img" src="/images/logo-liotecnica.png" alt="Liotecnica" />
              <h1>{text.title}</h1>
              <h2>{text.subtitle}</h2>
            </div>

            <label className="auth-field">
              <span>{text.tenant}</span>
              <input value={ctx.tenantId} readOnly />
            </label>

            <label className="auth-field">
              <span>{text.email}</span>
              <input type="email" value={login.email} onChange={(e) => setLogin((v) => ({ ...v, email: e.target.value }))} required />
            </label>
            <label className="auth-field">
              <span>{text.password}</span>
              <input type="password" value={login.password} onChange={(e) => setLogin((v) => ({ ...v, password: e.target.value }))} required />
            </label>

            {error ?<div className="inline-alert error auth-inline-alert">{error}</div> : null}

            <button className="auth-submit" type="submit" disabled={pending}>
              {pending ?text.processing : text.loginButton}
            </button>

            <div className="auth-links">
              <span className="auth-note">{text.createHint}</span>
              <button className="auth-secondary-btn" type="button" onClick={() => setShowRegisterModal(true)}>
                {text.createAccess}
              </button>
            </div>
          </form>
        </div>
      </section>

      <footer className="auth-language-footer">
        <div className="auth-page-container auth-language-inner">
          <span className="auth-language-label">{text.languageLabel}</span>
          <div className="language-flags auth-language-flags">
            <button type="button" className={`auth-flag-btn${language === 'pt-BR' ?' is-active' : ''}`} onClick={() => setLanguage('pt-BR')} title="Português">
              <img src="/images/flags/flag-br.svg" alt="Português" />
            </button>
            <button type="button" className={`auth-flag-btn${language === 'en-US' ?' is-active' : ''}`} onClick={() => setLanguage('en-US')} title="English">
              <img src="/images/flags/flag-us.svg" alt="English" />
            </button>
            <button type="button" className={`auth-flag-btn${language === 'es-ES' ?' is-active' : ''}`} onClick={() => setLanguage('es-ES')} title="Español">
              <img src="/images/flags/flag-es.svg" alt="Español" />
            </button>
          </div>
        </div>
      </footer>

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

      {showRegisterModal ?(
        <div className="auth-modal-backdrop">
          <div className="auth-help-modal auth-register-modal" onClick={(e) => e.stopPropagation()}>
            <div className="auth-help-modal-header">
              <div>
                <h2>{text.registerTitle}</h2>
                <div className="auth-help-modal-subtitle">{text.registerSubtitle}</div>
              </div>
              <button type="button" className="auth-modal-close" onClick={() => setShowRegisterModal(false)} aria-label="Fechar">
                <i className="fas fa-times" aria-hidden="true"></i>
              </button>
            </div>

            <form className="auth-register-form" onSubmit={onRegisterSubmit}>
              <label className="auth-field">
                <span>{text.fullName}</span>
                <input value={register.nome} onChange={(e) => setRegister((v) => ({ ...v, nome: e.target.value }))} required />
              </label>
              <label className="auth-field">
                <span>{text.email}</span>
                <input type="email" value={register.email} onChange={(e) => setRegister((v) => ({ ...v, email: e.target.value }))} required />
              </label>
              <div className="grid two">
                <label className="auth-field">
                  <span>{text.phone}</span>
                  <input value={register.fone} onChange={(e) => setRegister((v) => ({ ...v, fone: e.target.value }))} required />
                </label>
                <label className="auth-field">
                  <span>{text.uf}</span>
                  <input maxLength={2} value={register.uf} onChange={(e) => setRegister((v) => ({ ...v, uf: e.target.value }))} required />
                </label>
              </div>
              <label className="auth-field">
                <span>{text.city}</span>
                <input value={register.cidade} onChange={(e) => setRegister((v) => ({ ...v, cidade: e.target.value }))} required />
              </label>
              <div className="grid two">
                <label className="auth-field">
                  <span>{text.password}</span>
                  <input type="password" value={register.password} onChange={(e) => setRegister((v) => ({ ...v, password: e.target.value }))} required />
                </label>
                <label className="auth-field">
                  <span>{text.confirmPassword}</span>
                  <input type="password" value={register.confirmPassword} onChange={(e) => setRegister((v) => ({ ...v, confirmPassword: e.target.value }))} required />
                </label>
              </div>

              {registerError ?<div className="inline-alert error auth-inline-alert">{registerError}</div> : null}

              <div className="auth-help-modal-footer auth-register-footer">
                <button className="auth-secondary-btn auth-modal-cancel" type="button" onClick={() => setShowRegisterModal(false)}>
                  {text.cancel}
                </button>
                <button className="auth-submit auth-modal-primary auth-submit-inline" type="submit" disabled={registerPending}>
                  {registerPending ?text.processing : text.createAccess}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function JobsPage({ ctx }: { ctx: AuthContext }) {
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('Carregando vagas...')
  const [error, setError] = useState<string | null>(null)
  const [jobs, setJobs] = useState<PortalJob[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({ q: '', location: '', mode: '', type: '', level: '', area: '', sort: 'recent' })
  const [selectedJob, setSelectedJob] = useState<PortalJob | null>(null)
  const [applyPending, setApplyPending] = useState(false)
  const [applyResult, setApplyResult] = useState<string | null>(null)
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
          if (value && key !== 'sort') params.set(key, value)
        }
        const result = await fetchJson<{ items: PortalJob[] }>(`/api/public/vagas?${params.toString()}`)
        setJobs(result.items)
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
  const groupedJobs = useMemo(() => groupJobsByArea(jobs), [jobs])
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
      form.append('cidadeUf', applyData.cidadeUf)
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
      setApplyResult('Candidatura enviada com sucesso.')
      setSelectedJob(null)
    } catch (err) {
      setApplyResult(readError(err))
    } finally {
      setApplyPending(false)
    }
  }
  return (
    <>
      <section className="main-header">
        <div className="portal-container">
          <h1 className="display-hero">Transforme o Futuro da Alimentação</h1>
          <p className="lead-copy">Ambiente inovador, tecnologia de ponta e paixão por qualidade.</p>
        </div>
      </section>
      <div className="portal-container search-wrapper">
        <div className="search-box">
          <i className="fas fa-search" aria-hidden="true"></i>
          <input
            name="q"
            type="search"
            placeholder="Buscar por cargo, empresa, tecnologia..."
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
          <button className="btn-search" type="button" onClick={() => void loadJobs()}>Buscar</button>
          <button className="btn-clear" type="button" onClick={clearFilters}>Limpar</button>
        </div>
      </div>
      <button className="back-to-top" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <i className="fas fa-arrow-up" aria-hidden="true"></i>
        <span>Topo</span>
      </button>
      <button className="filters-fab" type="button" onClick={() => setShowFilters((v) => !v)}>
        <i className="fas fa-sliders-h" aria-hidden="true"></i>
        <span>Filtros</span>
      </button>
      <main className="portal-container portal-main">
        <div className="results-toolbar">
          <div className="results-count">
            <span>{jobs.length}</span> vagas encontradas
          </div>
          <div className="results-actions">
            <button className="toolbar-btn toolbar-btn-primary" type="button" onClick={() => setShowFilters((v) => !v)}>
              Ajustar filtros
            </button>
            <select className="toolbar-select" value={filters.sort} onChange={(e) => setFilters((v) => ({ ...v, sort: e.target.value }))}>
              <option value="recent">Mais recentes</option>
              <option value="salaryDesc">Faixa salarial (maior primeiro)</option>
              <option value="companyAsc">Empresa (A-Z)</option>
            </select>
          </div>
        </div>
        {showFilters ?(
          <section className="react-filters-panel">
            <div className="react-filters-grid">
              <input placeholder="Cidade ou UF" value={filters.location} onChange={(e) => setFilters((v) => ({ ...v, location: e.target.value }))} />
              <input placeholder="Modalidade" value={filters.mode} onChange={(e) => setFilters((v) => ({ ...v, mode: e.target.value }))} />
              <input placeholder="Contrato" value={filters.type} onChange={(e) => setFilters((v) => ({ ...v, type: e.target.value }))} />
              <input placeholder="Senioridade" value={filters.level} onChange={(e) => setFilters((v) => ({ ...v, level: e.target.value }))} />
              <input placeholder="Área" value={filters.area} onChange={(e) => setFilters((v) => ({ ...v, area: e.target.value }))} />
            </div>
            <div className="react-filters-actions">
              <button className="toolbar-btn toolbar-btn-primary" type="button" onClick={() => void loadJobs()}>Aplicar filtros</button>
              <button className="toolbar-btn" type="button" onClick={clearFilters}>Limpar filtros</button>
            </div>
          </section>
        ) : null}
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
          <section className="empty-state">
            <h3>Nenhuma vaga encontrada</h3>
            <p>Tente remover alguns filtros ou refinar o texto de busca.</p>
            <button className="toolbar-btn" type="button" onClick={clearFilters}>Limpar filtros</button>
          </section>
        ) : null}
        {!loading && !error ?(
          <section className="jobs-sections">
            {groupedJobs.map((group, groupIndex) => (
              <section className="job-section" key={group.title}>
                <div className="job-section-hero" style={{ backgroundImage: `url('${group.image}')` }}>
                  <div className="job-section-title">
                    <span>{group.title}</span>
                  </div>
                  <span className="job-section-count">{group.jobs.length} vagas</span>
                </div>
                <div className="job-grid">
                  {group.jobs.map((job, jobIndex) => {
                    const tags = buildJobTags(job)
                    const badges = buildJobBadgeValues(job)
                    return (
                      <article
                        className="job-card-react"
                        key={job.id}
                        onClick={() => setSelectedJob(job)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedJob(job)
                          }
                        }}
                      >
                        <div className="job-hero" style={{ backgroundImage: getJobHeroBackground(groupIndex + jobIndex) }}>
                          <h3 className="job-title-on-hero">{job.titulo}</h3>
                          <div className="job-badge-row">
                            {badges.map((badge) => (
                              <span className="job-pill-badge" key={badge}>{badge}</span>
                            ))}
                          </div>
                        </div>
                        <div className="job-card-body">
                          <div className="job-company">{job.tenantName || 'Liotecnica'}</div>
                          <div className="job-meta">
                            <span>{formatJobLocation(job)}</span>
                            <span className="dot" aria-hidden="true"></span>
                            <span>{job.area || 'Área em definição'}</span>
                          </div>
                          <div className="job-tags-row">
                            {(tags.length ?tags : ['Perfil geral']).slice(0, 6).map((tag) => (
                              <span className="job-tag" key={tag}>{tag}</span>
                            ))}
                          </div>
                          <div className="job-salary-line">{formatSalary(job.salarioMinimo, job.salarioMaximo)}</div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </section>
        ) : null}
        {selectedJob ?(
          <div className="modal-backdrop" onClick={() => setSelectedJob(null)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <div className="eyebrow">Candidatura rápida</div>
                  <h3>{selectedJob.titulo}</h3>
                </div>
                <button className="ghost-btn" type="button" onClick={() => setSelectedJob(null)}>Fechar</button>
              </div>
              <form className="stack-form" onSubmit={submitApplication}>
                <div className="grid two">
                  <label><span>Nome</span><input value={applyData.nome} onChange={(e) => setApplyData((v) => ({ ...v, nome: e.target.value }))} required /></label>
                  <label><span>E-mail</span><input type="email" value={applyData.email} onChange={(e) => setApplyData((v) => ({ ...v, email: e.target.value }))} required /></label>
                </div>
                <div className="grid two">
                  <label><span>Telefone</span><input value={applyData.fone} onChange={(e) => setApplyData((v) => ({ ...v, fone: e.target.value }))} /></label>
                  <label><span>Cidade / UF</span><input value={applyData.cidadeUf} onChange={(e) => setApplyData((v) => ({ ...v, cidadeUf: e.target.value }))} /></label>
                </div>
                <div className="grid two">
                  <label><span>LinkedIn</span><input value={applyData.linkedin} onChange={(e) => setApplyData((v) => ({ ...v, linkedin: e.target.value }))} /></label>
                  <label><span>Portfólio</span><input value={applyData.portfolio} onChange={(e) => setApplyData((v) => ({ ...v, portfolio: e.target.value }))} /></label>
                </div>
                <div className="grid two">
                  <label><span>Cargo atual</span><input value={applyData.cargoAtual} onChange={(e) => setApplyData((v) => ({ ...v, cargoAtual: e.target.value }))} /></label>
                  <label><span>Anos de experiência</span><input value={applyData.anosExperiencia} onChange={(e) => setApplyData((v) => ({ ...v, anosExperiencia: e.target.value }))} /></label>
                </div>
                <label><span>Observações</span><textarea rows={4} value={applyData.observacoes} onChange={(e) => setApplyData((v) => ({ ...v, observacoes: e.target.value }))} /></label>
                <label>
                  <span>Currículo (PDF, DOC ou DOCX)</span>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setApplyData((v) => ({ ...v, arquivo: e.target.files?.[0] ?? null }))} />
                </label>
                {applyResult ?<div className={`inline-alert ${applyResult.includes('sucesso') ?'success' : 'error'}`}>{applyResult}</div> : null}
                <button className="primary-btn" type="submit" disabled={applyPending}>{applyPending ?'Enviando...' : 'Enviar candidatura'}</button>
              </form>
            </div>
          </div>
        ) : null}
      </main>
    </>
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
  const [saving, setSaving] = useState(false)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [profile, setProfile] = useState<PortalProfile | null>(null)
  const [completion, setCompletion] = useState<PortalCompletion | null>(null)
  const [matches, setMatches] = useState<PortalMatchItem[]>([])
  const [portfolio, setPortfolio] = useState<PortalPortfolio | null>(null)
  const [education, setEducation] = useState<PortalEducation | null>(null)
  const [experience, setExperience] = useState<PortalExperienceProject | null>(null)
  const [preferences, setPreferences] = useState<PortalPreferences | null>(null)
  const [accessibility, setAccessibility] = useState<PortalAccessibility | null>(null)
  const [agenda, setAgenda] = useState<PortalAgenda | null>(null)
  const [notifications, setNotifications] = useState<PortalNotifications | null>(null)
  const [lgpd, setLgpd] = useState<PortalLgpd | null>(null)
  const [documents, setDocuments] = useState<PortalDocument[]>([])
  const [references, setReferences] = useState<PortalReference[]>([])
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    nome: '',
    email: '',
    fone: '',
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
      agendaData,
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
      authFetch<PortalAgenda>(`/api/public/portal-candidates/${candidateId}/agenda`),
      authFetch<PortalNotifications>(`/api/public/portal-candidates/${candidateId}/notifications`),
      authFetch<{ items: PortalDocument[] }>(`/api/public/portal-candidates/${candidateId}/documents`),
      authFetch<{ items: PortalReference[] }>(`/api/public/portal-candidates/${candidateId}/references`),
      authFetch<PortalLgpd>(`/api/public/portal-candidates/${candidateId}/lgpd`),
    ])

    let avatarUrl: string | null = null
    try {
      avatarUrl = await fetchAuthorizedBlobUrl(ctx, `/api/public/portal-candidates/${candidateId}/avatar`)
    } catch {
      avatarUrl = null
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
      agendaData,
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
    setAgenda(snapshot.agendaData)
    setNotifications(snapshot.notificationsData)
    setDocuments(snapshot.documents)
    setReferences(snapshot.references)
    setLgpd(snapshot.lgpdData)
    setAvatarPreview(snapshot.avatarUrl)
    setForm({
      nome: snapshot.profileData.nome ?? '',
      email: snapshot.profileData.email ?? '',
      fone: snapshot.profileData.fone ?? '',
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

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const result = await authFetch<PortalProfile>(`/api/public/portal-candidates/${candidateId}`, {
        method: 'PUT',
        body: JSON.stringify({
          nome: form.nome.trim(),
          fone: form.fone.trim(),
          cidade: form.cidade.trim(),
          uf: form.uf.trim().toUpperCase(),
          linkedinUrl: profile?.linkedinUrl ?? null,
          resumoProfissional: profile?.resumoProfissional ?? null,
        }),
      })
      setProfile(result)
      setForm((current) => ({
        ...current,
        nome: result.nome ?? current.nome,
        email: result.email ?? current.email,
        fone: result.fone ?? '',
        cidade: result.cidade ?? '',
        uf: result.uf ?? '',
      }))
      setMessage('Perfil atualizado com sucesso.')
      await refreshProfileModal({ keepMessage: true })
    } catch (err) {
      setMessage(readError(err))
    } finally {
      setSaving(false)
    }
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

  const sectionTiles = [
    { key: 'perfil', label: 'Perfil', icon: 'fa-user', value: completion?.sections?.perfil ?? completion?.overall ?? 0, kind: 'percent' as const },
    { key: 'testes', label: 'Testes', icon: 'fa-clipboard-check', value: completion?.sections?.testes ?? 0, kind: 'percent' as const },
    { key: 'comp', label: 'Competências & Portfólio', icon: 'fa-bolt', value: completion?.sections?.comp ?? 0, kind: 'percent' as const },
    { key: 'formacao', label: 'Formação & Educação', icon: 'fa-graduation-cap', value: completion?.sections?.formacao ?? 0, kind: 'percent' as const },
    { key: 'exp', label: 'Experiência & Projetos', icon: 'fa-briefcase', value: completion?.sections?.exp ?? 0, kind: 'percent' as const },
    { key: 'lgpd', label: 'Privacidade (LGPD)', icon: 'fa-shield-alt', value: completion?.sections?.lgpd ?? 0, kind: 'percent' as const },
    { key: 'pref', label: 'Preferências / Objetivos', icon: 'fa-bullseye', value: completion?.sections?.pref ?? 0, kind: 'percent' as const },
    { key: 'docs', label: 'Documentos & Anexos', icon: 'fa-paperclip', value: documents.length, kind: 'count' as const },
    { key: 'refs', label: 'Referências', icon: 'fa-users', value: referencesCount, kind: 'count' as const },
    { key: 'acess', label: 'Acessibilidade & Inclusão', icon: 'fa-universal-access', value: completion?.sections?.acess ?? 0, kind: 'percent' as const },
    { key: 'agenda', label: 'Disponibilidade & Agenda', icon: 'fa-calendar-alt', value: completion?.sections?.agenda ?? 0, kind: 'percent' as const },
    { key: 'hist', label: 'Histórico de Candidaturas', icon: 'fa-history', value: completion?.sections?.hist ?? 0, kind: 'percent' as const },
    { key: 'notif', label: 'Notificações & Comunicação', icon: 'fa-bell', value: completion?.sections?.notif ?? 0, kind: 'percent' as const },
    { key: 'matches', label: 'Vagas sugeridas', icon: 'fa-star', value: matchesCount, kind: 'count' as const },
    { key: 'clear', label: 'Limpar perfil', icon: 'fa-eraser', value: 0, kind: 'action' as const },
  ]

  const selectedTile = selectedSection ? sectionTiles.find((tile) => tile.key === selectedSection) ?? null : null

  return (
    <div className="modal-backdrop profile-modal-backdrop">
      <div className="profile-modal-card" onClick={(event) => event.stopPropagation()}>
        <div>
          <div className="profile-modal-header">
            <div>
              <h2 className="profile-modal-title">Meu perfil</h2>
              <div className="profile-modal-subtitle">Atualize seus dados básicos e acompanhe o preenchimento das seções.</div>
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
                <section className="profile-left-panel">
                  <div className="profile-panel-title">Dados do candidato</div>

                  <div className="profile-avatar-panel">
                    <div className="profile-avatar-circle">
                      {avatarPreview ?(
                        <img src={avatarPreview} alt={profile?.nome || 'Avatar do candidato'} />
                      ) : (
                        <span>{getInitials(form.nome || ctx.session?.candidate.nome || 'Candidato')}</span>
                      )}
                    </div>
                    <div className="profile-avatar-meta">
                      <strong>{form.nome || 'Candidato'}</strong>
                      <span>{completion?.overall ?? 0}% preenchido</span>
                    </div>
                  </div>

                  <label className="auth-field">
                    <span>Nome completo</span>
                    <input value={form.nome} onChange={(e) => setForm((current) => ({ ...current, nome: e.target.value }))} required />
                  </label>

                  <label className="auth-field">
                    <span>E-mail</span>
                    <input value={form.email} readOnly />
                  </label>

                  <div className="profile-modal-two-columns">
                    <label className="auth-field">
                      <span>Telefone</span>
                      <input value={form.fone} onChange={(e) => setForm((current) => ({ ...current, fone: e.target.value }))} required />
                    </label>
                    <label className="auth-field">
                      <span>UF</span>
                      <input value={form.uf} onChange={(e) => setForm((current) => ({ ...current, uf: e.target.value }))} maxLength={2} required />
                    </label>
                  </div>

                  <label className="auth-field">
                    <span>Cidade</span>
                    <input value={form.cidade} onChange={(e) => setForm((current) => ({ ...current, cidade: e.target.value }))} required />
                  </label>

                  <div className="profile-panel-note">
                    <i className="fas fa-shield-alt" aria-hidden="true"></i>
                    <span>Seus dados são tratados de acordo com a LGPD.</span>
                  </div>
                </section>
                ) : null}

                <section className={`profile-right-panel${selectedSection ?' is-detail' : ''}`}>
                  {!selectedSection ?(
                    <div className="profile-sections-grid">
                      {sectionTiles.map((tile) => (
                        <article
                          className="profile-section-tile"
                          key={tile.key}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedSection(tile.key)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setSelectedSection(tile.key)
                            }
                          }}
                        >
                          {tile.kind !== 'action' ?(
                            <div className="profile-section-badge">
                              {tile.kind === 'percent' ?`${tile.value}%` : tile.value}
                            </div>
                          ) : null}
                          <div className="profile-section-icon">
                            <i className={`fas ${tile.icon}`} aria-hidden="true"></i>
                          </div>
                          <div className="profile-section-label">{tile.label}</div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="profile-section-detail">
                      {selectedSection !== 'comp' ?(
                        <div className="profile-section-detail-head">
                          <div>
                            <div className="profile-section-detail-title">{selectedTile?.label}</div>
                            <div className="profile-section-detail-subtitle">Detalhes da seção selecionada.</div>
                          </div>
                          <button className="profile-back-button" type="button" onClick={() => setSelectedSection(null)}>
                            <i className="fas fa-arrow-left" aria-hidden="true"></i>
                            <span>Voltar às seções</span>
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
                              field('Cidade', profile?.cidade),
                              field('UF', profile?.uf),
                              field('LinkedIn', profile?.linkedinUrl),
                              field('Resumo', profile?.resumoProfissional, 'textarea'),
                            ]}
                            onSubmit={(values) => void saveJson(`/api/public/portal-candidates/${candidateId}`, {
                              nome: values.Nome,
                              fone: values.Telefone,
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
                          <RecordForm
                            fields={[
                              field('nivel', education?.summary.nivel),
                              field('areaPrincipal', education?.summary.areaPrincipal),
                              field('situacao', education?.summary.situacao),
                              field('destaques', education?.summary.destaques),
                            ]}
                            onSubmit={(values) => void saveJson(`/api/public/portal-candidates/${candidateId}/education`, values, 'Resumo educacional salvo.')}
                          />

                          <RepeaterSection
                            title="Cursos e formações"
                            items={education?.items ?? []}
                            describe={(item) => `${item.instituicao || 'Instituição livre'} • ${item.status || 'Status aberto'}`}
                            fields={[
                              { name: 'curso', label: 'Curso' },
                              { name: 'instituicao', label: 'Instituição' },
                              { name: 'tipo', label: 'Tipo' },
                              { name: 'status', label: 'Status' },
                              { name: 'inicio', label: 'Inicio' },
                              { name: 'fim', label: 'Fim' },
                              { name: 'observacoes', label: 'Observações' },
                              { name: 'link', label: 'Link' },
                            ]}
                            onAdd={(values) => void saveJson(`/api/public/portal-candidates/${candidateId}/education/items`, values, 'Formacao adicionada.', 'POST')}
                            onDelete={(item) => void removeItem(`/api/public/portal-candidates/${candidateId}/education/items/${item.id}`, 'Formacao removida.')}
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
                          <RecordForm
                            fields={[
                              field('retencaoMeses', lgpd?.retencaoMeses?.toString() ?? ''),
                              field('compartilhamento', lgpd?.compartilhamento),
                            ]}
                            checks={[
                              check('processarCandidatura', lgpd?.processarCandidatura),
                              check('permitirContato', lgpd?.permitirContato),
                              check('bancoTalentos', lgpd?.bancoTalentos),
                              check('dadosSensiveis', lgpd?.dadosSensiveis),
                              check('comunicacoes', lgpd?.comunicacoes),
                            ]}
                            onSubmit={(values) => void saveJson(`/api/public/portal-candidates/${candidateId}/lgpd`, {
                              ...values,
                              retencaoMeses: values.retencaoMeses ?Number(values.retencaoMeses) : null,
                            }, 'Preferências LGPD atualizadas.')}
                          />
                          <button className="secondary-btn" type="button" onClick={() => void openLgpdReceipt(authFetch, candidateId)}>Abrir comprovante LGPD</button>
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

                      {selectedSection === 'agenda' ?(
                        <div className="profile-section-detail-body">
                          <RecordForm
                            fields={[
                              field('formatoEntrevista', agenda?.preferences.formatoEntrevista),
                              field('inicioDisponivel', agenda?.preferences.inicioDisponivel),
                              field('avisoPrevio', agenda?.preferences.avisoPrevio),
                              field('observacoes', agenda?.preferences.observacoes, 'textarea'),
                              field('horarioPreferido', agenda?.preferences.horarioPreferido),
                              field('fusoHorario', agenda?.preferences.fusoHorario),
                            ]}
                            checks={[
                              check('diaSeg', agenda?.preferences.diaSeg),
                              check('diaTer', agenda?.preferences.diaTer),
                              check('diaQua', agenda?.preferences.diaQua),
                              check('diaQui', agenda?.preferences.diaQui),
                              check('diaSex', agenda?.preferences.diaSex),
                              check('diaSab', agenda?.preferences.diaSab),
                              check('diaDom', agenda?.preferences.diaDom),
                              check('periodoManha', agenda?.preferences.periodoManha),
                              check('periodoTarde', agenda?.preferences.periodoTarde),
                              check('periodoNoite', agenda?.preferences.periodoNoite),
                            ]}
                            onSubmit={(values) => void saveJson(`/api/public/portal-candidates/${candidateId}/agenda`, values, 'Preferências de agenda salvas.')}
                          />

                          <RepeaterSection
                            title="Bloqueios"
                            items={agenda?.blocks ?? []}
                            describe={(item) => `${item.data || 'Data'} • ${item.horario || 'Horário'} • ${item.observacoes || 'Sem observações'}`}
                            fields={[
                              { name: 'tipo', label: 'Tipo' },
                              { name: 'titulo', label: 'Titulo' },
                              { name: 'data', label: 'Data' },
                              { name: 'horario', label: 'Horário' },
                              { name: 'observacoes', label: 'Observações' },
                            ]}
                            onAdd={(values) => void saveJson(`/api/public/portal-candidates/${candidateId}/agenda/blocks`, values, 'Bloqueio adicionado.', 'POST')}
                            onDelete={(item) => void removeItem(`/api/public/portal-candidates/${candidateId}/agenda/blocks/${item.id}`, 'Bloqueio removido.')}
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
                          <RecordForm
                            fields={[
                              field('frequencia', notifications?.frequencia),
                              field('idioma', notifications?.idioma),
                              field('email', notifications?.email),
                              field('telefone', notifications?.telefone),
                              field('silencioAtivo', notifications?.silencioAtivo),
                              field('silencioInicio', notifications?.silencioInicio),
                              field('silencioFim', notifications?.silencioFim),
                              field('silencioPrioridade', notifications?.silencioPrioridade),
                              field('assinatura', notifications?.assinatura),
                            ]}
                            checks={[
                              check('canalEmail', notifications?.canalEmail),
                              check('canalWhatsapp', notifications?.canalWhatsapp),
                              check('canalSms', notifications?.canalSms),
                              check('canalPush', notifications?.canalPush),
                              check('permiteContato', notifications?.permiteContato),
                              check('alertaNovasVagas', notifications?.alertaNovasVagas),
                              check('alertaAtualizacoes', notifications?.alertaAtualizacoes),
                              check('alertaEntrevistas', notifications?.alertaEntrevistas),
                              check('alertaMensagens', notifications?.alertaMensagens),
                              check('alertaDocumentos', notifications?.alertaDocumentos),
                              check('alertaLembretes', notifications?.alertaLembretes),
                            ]}
                            onSubmit={(values) => void saveJson(`/api/public/portal-candidates/${candidateId}/notifications`, values, 'Notificacoes atualizadas.')}
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
                              Use esta a??o para limpar os dados auxiliares do perfil, como no portal .NET.
                            </p>
                            <button className="profile-danger-button" type="button" onClick={() => void handleResetProfile()}>
                              <i className="fas fa-eraser" aria-hidden="true"></i>
                              <span>Limpar perfil</span>
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </section>
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
            <button className="profile-modal-footer-btn secondary" type="button" onClick={onClose}>Cancelar</button>
            <button className="profile-modal-footer-btn primary" type="button" onClick={() => void handleSave()} disabled={saving || loading}>
              {saving ?'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CandidateWorkspace({ ctx }: { ctx: AuthContext }) {
  const navigate = useNavigate()
  const candidateId = ctx.session?.candidate.id ?? ''
  const [state, setState] = useState<WorkspaceState>({
    profile: null,
    completion: null,
    matches: [],
    portfolio: null,
    education: null,
    experience: null,
    preferences: null,
    accessibility: null,
    agenda: null,
    notifications: null,
    documents: [],
    references: [],
    lgpd: null,
  })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [resumeParsePreview, setResumeParsePreview] = useState<string>('')
  const authFetch = useMemo(() => createAuthorizedClient(ctx), [ctx])

  async function refreshWorkspace() {
    if (!candidateId) return

    setLoading(true)
    setMessage(null)

    try {
      const [profile, completion, matches, portfolio, education, experience, preferences, accessibility, agenda, notifications, documents, references, lgpd] = await Promise.all([
        authFetch<PortalProfile>(`/api/public/portal-candidates/${candidateId}`),
        authFetch<PortalCompletion>(`/api/public/portal-candidates/${candidateId}/profile-completion`),
        authFetch<{ matches: PortalMatchItem[] }>(`/api/public/portal-candidates/${candidateId}/job-matches`),
        authFetch<PortalPortfolio>(`/api/public/portal-candidates/${candidateId}/skills-portfolio`),
        authFetch<PortalEducation>(`/api/public/portal-candidates/${candidateId}/education`),
        authFetch<PortalExperienceProject>(`/api/public/portal-candidates/${candidateId}/experience-projects`),
        authFetch<PortalPreferences>(`/api/public/portal-candidates/${candidateId}/preferences`),
        authFetch<PortalAccessibility>(`/api/public/portal-candidates/${candidateId}/accessibility`),
        authFetch<PortalAgenda>(`/api/public/portal-candidates/${candidateId}/agenda`),
        authFetch<PortalNotifications>(`/api/public/portal-candidates/${candidateId}/notifications`),
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
        agenda,
        notifications,
        documents: documents.items ?? [],
        references: references.items ?? [],
        lgpd,
      })

      try {
        const url = await fetchAuthorizedBlobUrl(ctx, `/api/public/portal-candidates/${candidateId}/avatar`)
        setAvatarPreview(url)
      } catch {
        setAvatarPreview(null)
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

  async function removeItem(path: string, successText: string) {
    try {
      await authFetch(path, { method: 'DELETE' })
      setMessage(successText)
      await refreshWorkspace()
    } catch (err) {
      setMessage(readError(err))
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
    } catch (err) {
      setMessage(readError(err))
    }
  }

  async function handleLogout() {
    await signOutPortalSession(ctx)
    navigate(withTenant('/acesso', ctx.tenantId))
  }

  if (loading) {
    return <PageLoading label="Sincronizando seu perfil e suas prefer?ncias..." />
  }

  if (message && !state.profile) {
    return (
      <main className="page-shell">
        <section className="state-card unavailable">
          <h3>N?o foi poss?vel carregar seu espa?o</h3>
          <p>{message}</p>
          <button className="primary-btn" type="button" onClick={() => void refreshWorkspace()}>Tentar novamente</button>
        </section>
      </main>
    )
  }

  return (
    <main className="workspace-shell">
      <section className="workspace-hero">
        <div>
          <div className="eyebrow">Workspace do candidato</div>
          <h2>{state.profile?.nome || ctx.session?.candidate.nome}</h2>
          <p>{ctx.session?.candidate.email}  tenant {ctx.tenantId}</p>
        </div>
        <div className="workspace-actions">
          <button className="secondary-btn" type="button" onClick={() => void refreshWorkspace()}>Atualizar tudo</button>
          <button className="ghost-btn" type="button" onClick={handleLogout}>Sair</button>
        </div>
      </section>

      {message ?<div className="toast-banner">{message}</div> : null}

      <section className="summary-grid">
        <SummaryCard title="Conclus?o do perfil" value={`${state.completion?.overall ?? 0}%`} detail="Score consolidado pelo servi?o de completion" />
        <SummaryCard title="Job matches" value={String(state.matches.length)} detail="Oportunidades mais aderentes ao seu perfil" />
        <SummaryCard title="Documentos" value={String(state.documents.length)} detail="Arquivos auxiliares al?m do curr?culo" />
        <SummaryCard title="Refer?ncias" value={String(state.references.length)} detail="Pessoas que podem endossar sua trajet?ria" />
      </section>

      <div className="content-grid">
        <section className="content-column">
          <WorkspaceSection title="Perfil e curr?culo" description="Dados pessoais, foto, resumo e documentos principais.">
            <div className="profile-shell">
              <div className="avatar-plate">
                {avatarPreview ?<img src={avatarPreview} alt={state.profile?.nome || 'Avatar do candidato'} /> : <span>{getInitials(state.profile?.nome || ctx.session?.candidate.nome || 'Candidato')}</span>}
              </div>
              <label className="upload-label">
                Alterar avatar
                <input type="file" accept="image/*" onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadFile(`/api/public/portal-candidates/${candidateId}/avatar`, 'arquivo', file, 'Avatar atualizado.')
                }} />
              </label>
            </div>

            <RecordForm
              fields={[
                field('Nome', state.profile?.nome),
                field('Telefone', state.profile?.fone),
                field('Cidade', state.profile?.cidade),
                field('UF', state.profile?.uf),
                field('LinkedIn', state.profile?.linkedinUrl),
                field('Resumo', state.profile?.resumoProfissional, 'textarea'),
              ]}
              onSubmit={(values) => saveJson(`/api/public/portal-candidates/${candidateId}`, {
                nome: values.Nome,
                fone: values.Telefone,
                cidade: values.Cidade,
                uf: values.UF,
                linkedinUrl: values.LinkedIn,
                resumoProfissional: values.Resumo,
              }, 'Perfil atualizado.')}
            />

            <div className="toolbar-row">
              <label className="upload-label">
                Enviar curr?culo
                <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void uploadFile(`/api/public/portal-candidates/${candidateId}/curriculos`, 'arquivo', file, 'Curr?culo enviado.')
                }} />
              </label>
              <label className="upload-label">
                Parsear curr?culo
                <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const form = new FormData()
                  form.append('arquivo', file)
                  void authFetch<Record<string, unknown>>(`/api/public/portal-candidates/${candidateId}/parse-resume`, { method: 'POST', body: form }, false)
                    .then((result) => setResumeParsePreview(JSON.stringify(result, null, 2)))
                    .catch((err) => setMessage(readError(err)))
                }} />
              </label>
              <button className="secondary-btn" type="button" onClick={() => void openResumeHtml(authFetch, candidateId)}>Abrir curr?culo HTML</button>
              <button className="secondary-btn" type="button" onClick={() => void downloadResumePdf(authFetch, candidateId)}>Baixar PDF gerado</button>
            </div>

            {resumeParsePreview ?<pre className="json-preview">{resumeParsePreview}</pre> : null}
          </WorkspaceSection>

          <WorkspaceSection title="Conclus?o e ader?ncia" description="Diagn?stico autom?tico do perfil e vagas com maior match.">
            <div className="completion-shell">
              {Object.entries(state.completion?.sections ?? {}).map(([key, value]) => (
                <div key={key} className="metric-row">
                  <span>{key}</span>
                  <strong>{value}%</strong>
                </div>
              ))}
            </div>
            {(state.completion?.suggestions ?? []).map((suggestion) => (
              <article key={`${suggestion.section}-${suggestion.text}`} className="inline-card">
                <strong>{suggestion.section}</strong>
                <p>{suggestion.text}</p>
                <span>{suggestion.impact}</span>
              </article>
            ))}
            <div className="matches-grid">
              {state.matches.map((match) => (
                <article key={match.vagaId} className="inline-card">
                  <strong>{match.title || 'Vaga sem t?tulo'}</strong>
                  <p>{match.area || '?rea n?o informada'} ? {match.city || 'Cidade'} {match.uf || ''}</p>
                  <span>Score {match.score}% ? {match.mode || 'Formato flex?vel'}</span>
                  {match.reason ?<small>{match.reason}</small> : null}
                </article>
              ))}
            </div>
          </WorkspaceSection>

          <WorkspaceSection title="Skills, links e certifica??es" description="Compet?ncias, prefer?ncias r?pidas e links do portf?lio.">
            <RecordForm
              fields={[
                field('WorkModel', state.portfolio?.preferences.workModel),
                field('Availability', state.portfolio?.preferences.availability),
                field('Salary', state.portfolio?.preferences.salary),
                field('Shift', state.portfolio?.preferences.shift),
                field('Note', state.portfolio?.preferences.note),
                field('Linkedin', state.portfolio?.links.linkedin),
                field('Github', state.portfolio?.links.github),
                field('Portfolio', state.portfolio?.links.portfolio),
                field('Drive', state.portfolio?.links.drive),
                field('Tags', state.portfolio?.tags),
              ]}
              onSubmit={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/skills-portfolio`, values, 'Prefer?ncias e links salvos.')}
            />

            <RepeaterSection
              title="Skills"
              items={state.portfolio?.skills ?? []}
              describe={(item) => `${item.tipo}  ${item.nivel}${item.evidencia ?`  ${item.evidencia}` : ''}`}
              onAdd={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/skills-portfolio/skills`, values, 'Skill adicionada.', 'POST')}
              onDelete={(item) => removeItem(`/api/public/portal-candidates/${candidateId}/skills-portfolio/skills/${item.id}`, 'Skill removida.')}
              fields={[
                { name: 'tipo', label: 'Tipo' },
                { name: 'nome', label: 'Nome' },
                { name: 'nivel', label: 'N?vel' },
                { name: 'evidencia', label: 'Evid?ncia' },
              ]}
            />

            <RepeaterSection
              title="Certifica??es"
              items={state.portfolio?.certifications ?? []}
              describe={(item) => `${item.instituicao || 'Institui??o livre'} ${item.ano ?`? ${item.ano}` : ''}`}
              onAdd={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/skills-portfolio/certifications`, values, 'Certifica??o adicionada.', 'POST')}
              onDelete={(item) => removeItem(`/api/public/portal-candidates/${candidateId}/skills-portfolio/certifications/${item.id}`, 'Certifica??o removida.')}
              fields={[
                { name: 'nome', label: 'Nome' },
                { name: 'instituicao', label: 'Institui??o' },
                { name: 'ano', label: 'Ano' },
                { name: 'link', label: 'Link' },
              ]}
            />
          </WorkspaceSection>

          <WorkspaceSection title="Educa??o" description="Resumo da forma??o e hist?rico acad?mico detalhado.">
            <RecordForm
              fields={[
                field('nivel', state.education?.summary.nivel),
                field('areaPrincipal', state.education?.summary.areaPrincipal),
                field('situacao', state.education?.summary.situacao),
                field('destaques', state.education?.summary.destaques),
              ]}
              onSubmit={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/education`, values, 'Resumo educacional salvo.')}
            />
            <RepeaterSection
              title="Cursos e forma??es"
              items={state.education?.items ?? []}
              describe={(item) => `${item.instituicao || 'Institui??o livre'} ? ${item.status || 'Status aberto'}`}
              onAdd={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/education/items`, values, 'Forma??o adicionada.', 'POST')}
              onDelete={(item) => removeItem(`/api/public/portal-candidates/${candidateId}/education/items/${item.id}`, 'Forma??o removida.')}
              fields={[
                { name: 'curso', label: 'Curso' },
                { name: 'instituicao', label: 'Institui??o' },
                { name: 'tipo', label: 'Tipo' },
                { name: 'status', label: 'Status' },
                { name: 'inicio', label: 'In?cio' },
                { name: 'fim', label: 'Fim' },
                { name: 'observacoes', label: 'Observa??es' },
                { name: 'link', label: 'Link' },
              ]}
            />
          </WorkspaceSection>
        </section>

        <section className="content-column">
          <WorkspaceSection title="Experi?ncias e projetos" description="Linha do tempo profissional e cases de entrega.">
            <RepeaterSection
              title="Experi?ncias"
              items={state.experience?.experiences ?? []}
              describe={(item) => `${item.cargo}  ${item.inicio || '?'} a ${item.fim || 'atual'}`}
              onAdd={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/experiences`, values, 'Experi?ncia adicionada.', 'POST')}
              onDelete={(item) => removeItem(`/api/public/portal-candidates/${candidateId}/experiences/${item.id}`, 'Experi?ncia removida.')}
              fields={[
                { name: 'empresa', label: 'Empresa' },
                { name: 'cargo', label: 'Cargo' },
                { name: 'inicio', label: 'In?cio' },
                { name: 'fim', label: 'Fim' },
                { name: 'local', label: 'Local / modelo' },
                { name: 'atividades', label: 'Atividades' },
              ]}
            />
            <RepeaterSection
              title="Projetos"
              items={state.experience?.projects ?? []}
              describe={(item) => `${item.periodo || 'Per?odo livre'} ? ${item.stack || 'Stack aberta'}`}
              onAdd={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/projects`, values, 'Projeto adicionado.', 'POST')}
              onDelete={(item) => removeItem(`/api/public/portal-candidates/${candidateId}/projects/${item.id}`, 'Projeto removido.')}
              fields={[
                { name: 'nome', label: 'Nome' },
                { name: 'periodo', label: 'Per?odo' },
                { name: 'descricao', label: 'Descri??o' },
                { name: 'link', label: 'Link' },
                { name: 'stack', label: 'Stack' },
                { name: 'destaques', label: 'Destaques' },
              ]}
            />
          </WorkspaceSection>

          <WorkspaceSection title="Prefer?ncias de vaga" description="Objetivo profissional, deslocamento, jornada e remunera??o.">
            <RecordForm
              fields={[
                field('CargoAlvo', asString(state.preferences?.CargoAlvo)),
                field('Senioridade', asString(state.preferences?.Senioridade)),
                field('InicioDisponivel', asString(state.preferences?.InicioDisponivel)),
                field('Resumo', asString(state.preferences?.Resumo), 'textarea'),
                field('AreasInteresse', asString(state.preferences?.AreasInteresse)),
                field('ModeloTrabalho', asString(state.preferences?.ModeloTrabalho)),
                field('Jornada', asString(state.preferences?.Jornada)),
                field('TipoContrato', asString(state.preferences?.TipoContrato)),
                field('Viagens', asString(state.preferences?.Viagens)),
                field('Mudanca', asString(state.preferences?.Mudanca)),
                field('CidadePreferida', asString(state.preferences?.CidadePreferida)),
                field('DistanciaMaxKm', asString(state.preferences?.DistanciaMaxKm)),
                field('ObsDeslocamento', asString(state.preferences?.ObsDeslocamento)),
                field('PretensaoSalarial', asString(state.preferences?.PretensaoSalarial)),
                field('PretensaoNegociavel', asString(state.preferences?.PretensaoNegociavel)),
                field('BeneficiosDesejados', asString(state.preferences?.BeneficiosDesejados)),
                field('NaoAbreMaoDe', asString(state.preferences?.NaoAbreMaoDe)),
              ]}
              onSubmit={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/preferences`, values, 'Prefer?ncias salvas.')}
            />
          </WorkspaceSection>

          <WorkspaceSection title="Agenda e disponibilidade" description="Formato de entrevista, janelas preferidas e bloqueios.">
            <RecordForm
              fields={[
                field('formatoEntrevista', state.agenda?.preferences.formatoEntrevista),
                field('inicioDisponivel', state.agenda?.preferences.inicioDisponivel),
                field('avisoPrevio', state.agenda?.preferences.avisoPrevio),
                field('observacoes', state.agenda?.preferences.observacoes, 'textarea'),
                field('horarioPreferido', state.agenda?.preferences.horarioPreferido),
                field('fusoHorario', state.agenda?.preferences.fusoHorario),
              ]}
              checks={[
                check('diaSeg', state.agenda?.preferences.diaSeg),
                check('diaTer', state.agenda?.preferences.diaTer),
                check('diaQua', state.agenda?.preferences.diaQua),
                check('diaQui', state.agenda?.preferences.diaQui),
                check('diaSex', state.agenda?.preferences.diaSex),
                check('diaSab', state.agenda?.preferences.diaSab),
                check('diaDom', state.agenda?.preferences.diaDom),
                check('periodoManha', state.agenda?.preferences.periodoManha),
                check('periodoTarde', state.agenda?.preferences.periodoTarde),
                check('periodoNoite', state.agenda?.preferences.periodoNoite),
              ]}
              onSubmit={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/agenda`, values, 'Prefer?ncias de agenda salvas.')}
            />
            <RepeaterSection
              title="Bloqueios"
              items={state.agenda?.blocks ?? []}
              describe={(item) => `${item.data || 'Data'} ? ${item.horario || 'Hor?rio'} ? ${item.observacoes || 'Sem observa??es'}`}
              onAdd={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/agenda/blocks`, values, 'Bloqueio adicionado.', 'POST')}
              onDelete={(item) => removeItem(`/api/public/portal-candidates/${candidateId}/agenda/blocks/${item.id}`, 'Bloqueio removido.')}
              fields={[
                { name: 'tipo', label: 'Tipo' },
                { name: 'titulo', label: 'T?tulo' },
                { name: 'data', label: 'Data' },
                { name: 'horario', label: 'Hor?rio' },
                { name: 'observacoes', label: 'Observa??es' },
              ]}
            />
          </WorkspaceSection>

          <WorkspaceSection title="Notifica??es e LGPD" description="Consentimentos, canais e prioridades de contato.">
            <RecordForm
              fields={[
                field('frequencia', state.notifications?.frequencia),
                field('idioma', state.notifications?.idioma),
                field('email', state.notifications?.email),
                field('telefone', state.notifications?.telefone),
                field('silencioAtivo', state.notifications?.silencioAtivo),
                field('silencioInicio', state.notifications?.silencioInicio),
                field('silencioFim', state.notifications?.silencioFim),
                field('silencioPrioridade', state.notifications?.silencioPrioridade),
                field('assinatura', state.notifications?.assinatura),
              ]}
              checks={[
                check('canalEmail', state.notifications?.canalEmail),
                check('canalWhatsapp', state.notifications?.canalWhatsapp),
                check('canalSms', state.notifications?.canalSms),
                check('canalPush', state.notifications?.canalPush),
                check('permiteContato', state.notifications?.permiteContato),
                check('alertaNovasVagas', state.notifications?.alertaNovasVagas),
                check('alertaAtualizacoes', state.notifications?.alertaAtualizacoes),
                check('alertaEntrevistas', state.notifications?.alertaEntrevistas),
                check('alertaMensagens', state.notifications?.alertaMensagens),
                check('alertaDocumentos', state.notifications?.alertaDocumentos),
                check('alertaLembretes', state.notifications?.alertaLembretes),
              ]}
              onSubmit={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/notifications`, values, 'Notifica??es atualizadas.')}
            />

            <RecordForm
              fields={[
                field('retencaoMeses', state.lgpd?.retencaoMeses?.toString() ?? ''),
                field('compartilhamento', state.lgpd?.compartilhamento),
              ]}
              checks={[
                check('processarCandidatura', state.lgpd?.processarCandidatura),
                check('permitirContato', state.lgpd?.permitirContato),
                check('bancoTalentos', state.lgpd?.bancoTalentos),
                check('dadosSensiveis', state.lgpd?.dadosSensiveis),
                check('comunicacoes', state.lgpd?.comunicacoes),
              ]}
              onSubmit={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/lgpd`, {
                ...values,
                retencaoMeses: values.retencaoMeses ?Number(values.retencaoMeses) : null,
              }, 'Prefer?ncias LGPD atualizadas.')}
            />
            <button className="secondary-btn" type="button" onClick={() => void openLgpdReceipt(authFetch, candidateId)}>Abrir comprovante LGPD</button>
          </WorkspaceSection>

          <WorkspaceSection title="Documentos, refer?ncias e acessibilidade" description="Toda a camada complementar do perfil do candidato.">
            <RepeaterSection
              title="Documentos"
              items={state.documents}
              describe={(item) => `${item.tipo}  ${item.data || 'Sem data'} ${item.fileName ?` ${item.fileName}` : ''}`}
              onAdd={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/documents`, values, 'Documento salvo.', 'POST')}
              onDelete={(item) => removeItem(`/api/public/portal-candidates/${candidateId}/documents/${item.id}`, 'Documento removido.')}
              fields={[
                { name: 'tipo', label: 'Tipo' },
                { name: 'nome', label: 'Nome' },
                { name: 'link', label: 'Link' },
                { name: 'data', label: 'Data' },
                { name: 'observacoes', label: 'Observa??es' },
                { name: 'fileName', label: 'Nome do arquivo' },
              ]}
            />

            <RepeaterSection
              title="Refer?ncias"
              items={state.references}
              describe={(item) => `${item.relacao || 'Rela??o livre'} ? ${item.contato || 'Contato n?o informado'}`}
              onAdd={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/references`, {
                ...values,
                podeContatar: Boolean(values.podeContatar),
              }, 'Refer?ncia salva.', 'POST')}
              onDelete={(item) => removeItem(`/api/public/portal-candidates/${candidateId}/references/${item.id}`, 'Refer?ncia removida.')}
              fields={[
                { name: 'nome', label: 'Nome' },
                { name: 'relacao', label: 'Rela??o' },
                { name: 'empresa', label: 'Empresa' },
                { name: 'cargo', label: 'Cargo' },
                { name: 'contato', label: 'Contato' },
                { name: 'periodo', label: 'Per?odo' },
                { name: 'linkedin', label: 'LinkedIn' },
                { name: 'observacoes', label: 'Observa??es' },
                { name: 'podeContatar', label: 'Pode contatar?(true/false)' },
              ]}
            />

            <RecordForm
              fields={[
                field('idioma', state.accessibility?.idioma),
                field('canal', state.accessibility?.canal),
                field('melhorHorario', state.accessibility?.melhorHorario),
                field('observacoesComunicacao', state.accessibility?.observacoesComunicacao, 'textarea'),
                field('detalhesNecessidades', state.accessibility?.detalhesNecessidades, 'textarea'),
                field('pcdIdentificacao', state.accessibility?.pcdIdentificacao),
                field('pcdTipo', state.accessibility?.pcdTipo),
                field('pcdComprovacao', state.accessibility?.pcdComprovacao),
                field('pcdObservacoes', state.accessibility?.pcdObservacoes, 'textarea'),
              ]}
              checks={[
                check('precisaLegendas', state.accessibility?.precisaLegendas),
                check('precisaInterprete', state.accessibility?.precisaInterprete),
                check('precisaLeitorTela', state.accessibility?.precisaLeitorTela),
                check('precisaBaixaEstimulo', state.accessibility?.precisaBaixaEstimulo),
                check('precisaMobilidade', state.accessibility?.precisaMobilidade),
                check('precisaTempoExtra', state.accessibility?.precisaTempoExtra),
                check('consentimentoPcd', state.accessibility?.consentimentoPcd),
              ]}
              onSubmit={(values) => saveJson(`/api/public/portal-candidates/${candidateId}/accessibility`, values, 'Acessibilidade atualizada.')}
            />
          </WorkspaceSection>
        </section>
      </div>
    </main>
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
    if (!ctx.session) throw new Error('Sess?o n?o encontrada.')

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
  if (!ctx.session) throw new Error('Sess?o n?o encontrada.')
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

function SummaryCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <article className="summary-card">
      <div className="eyebrow">{title}</div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  )
}

function WorkspaceSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="workspace-card">
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

function RecordForm({
  fields,
  checks,
  onSubmit,
}: {
  fields: { label: string; name: string; value?: string | null; kind?: 'input' | 'textarea' }[]
  checks?: { name: string; checked?: boolean }[]
  onSubmit: (values: Record<string, string | boolean>) => void
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
      className="stack-form"
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
          ) : (
            <input value={String(values[fieldItem.name] ?? '')} onChange={(e) => setValues((v) => ({ ...v, [fieldItem.name]: e.target.value }))} />
          )}
        </label>
      ))}
      {checks?.length ?(
        <div className="checks-grid">
          {checks.map((checkItem) => (
            <label key={checkItem.name} className="check-row">
              <input
                type="checkbox"
                checked={Boolean(values[checkItem.name])}
                onChange={(e) => setValues((v) => ({ ...v, [checkItem.name]: e.target.checked }))}
              />
              <span>{checkItem.name}</span>
            </label>
          ))}
        </div>
      ) : null}
      <button className="primary-btn" type="submit">Salvar seção</button>
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

function field(label: string, value?: string | null, kind: 'input' | 'textarea' = 'input') {
  return { label, name: label, value, kind }
}

function check(name: string, checked?: boolean) {
  return { name, checked }
}

function formatSalary(min?: number | null, max?: number | null) {
  if (!min && !max) return 'Faixa a combinar'
  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
  if (min && max) return `${fmt.format(min)} - ${fmt.format(max)}`
  return fmt.format(min || max || 0)
}

const JOB_HERO_GRADIENTS = [
  'linear-gradient(135deg, #1e3a8a, #0ea5e9)',
  'linear-gradient(135deg, #0f766e, #22c55e)',
  'linear-gradient(135deg, #7c3aed, #ec4899)',
  'linear-gradient(135deg, #d97706, #f97316)',
  'linear-gradient(135deg, #1d4ed8, #38bdf8)',
  'linear-gradient(135deg, #4f46e5, #6366f1)',
]

const JOB_SECTION_IMAGES = [
  { match: 'industrial', title: 'Opera??es Industriais', image: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&q=80&w=1600' },
  { match: 'qualidade', title: 'Qualidade & P&D', image: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&q=80&w=1600' },
  { match: 'logistica', title: 'Log?stica & Supply', image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=1600' },
  { match: 'rh', title: 'Administrativo & RH', image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=1600' },
  { match: 'administrativo', title: 'Administrativo & RH', image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=1600' },
  { match: 'comercial', title: 'Vendas & Marketing', image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=1600' },
  { match: 'marketing', title: 'Vendas & Marketing', image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&q=80&w=1600' },
]

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
  return job.modalidade || 'N?o informado'
}

function normalizeAreaKey(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getJobSectionInfo(area: string | null | undefined) {
  const key = normalizeAreaKey(area)
  const match = JOB_SECTION_IMAGES.find((item) => key.includes(item.match))
  if (match) return match
  return {
    title: area || 'Vagas em destaque',
    image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&q=80&w=1600',
  }
}

function groupJobsByArea(jobs: PortalJob[]) {
  const groups = new Map<string, PortalJob[]>()
  for (const job of jobs) {
    const info = getJobSectionInfo(job.area)
    const key = `${info.title}|||${info.image}`
    const bucket = groups.get(key) ?? []
    bucket.push(job)
    groups.set(key, bucket)
  }

  return Array.from(groups.entries()).map(([key, items]) => {
    const [title, image] = key.split('|||')
    return { title, image, jobs: items }
  })
}

function getJobHeroBackground(index: number) {
  return JOB_HERO_GRADIENTS[index % JOB_HERO_GRADIENTS.length]
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

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function asString(value: string | null | undefined) {
  return value ?? ''
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














