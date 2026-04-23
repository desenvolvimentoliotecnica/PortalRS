"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getTenantId } from "@/lib/session";
import {
  clearPortalCandidateSession,
  getPortalCandidateSession,
  portalAuthFetch,
  portalCandidateFetch,
  savePortalCandidateSession,
} from "@/features/portalvagas/publicApi";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PortalVagasAgendaScreen from "@/features/portalvagas/agenda/PortalVagasAgendaScreen";
import MinhasCandidaturasSection from "@/features/portalvagas/MinhasCandidaturasSection";
import { addAppToHistory } from "@/features/portalvagas/appsStorage";
import {
  PortalVagasSkillsSection,
  PortalVagasEducationSection,
  PortalVagasPreferencesSection,
  PortalVagasLgpdSection,
  PortalVagasNotificationsSection,
  PortalVagasDocumentsSection,
  PortalVagasExperienceSection,
  PortalVagasReferencesSection,
  PortalVagasAccessibilitySection,
  PortalVagasAppsSection,
  PortalVagasTestsSection,
} from "@/features/portalvagas/sections";
import JobCard from "@/features/portalvagas/JobCard";
import { parseTagsResponsabilidades, buildSummary } from "@/features/portalvagas/jobsUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

type JobItem = {
  id: string;
  titulo: string;
  area?: string | null;
  modalidade?: string | null;
  tipoContratacao?: string | null;
  senioridade?: string | null;
  cidade?: string | null;
  uf?: string | null;
  tagsKeywordsRaw?: string | null;
  tagsStackRaw?: string | null;
  tagsResponsabilidadesRaw?: string | null;
  salarioMinimo?: number | null;
  salarioMaximo?: number | null;
  createdAtUtc?: string | null;
  empresaNome?: string | null;
  tenantName?: string | null;
  etapas?: string[] | null;
  descricaoPublica?: string | null;
  urgente?: boolean | null;
  aceitaPcd?: boolean | null;
  quantidadeVagas?: number | null;
};

type PagedJobs = { items: JobItem[]; totalItems: number; totalPages: number; page: number };
type JobsApiResponse = { items?: JobItem[]; totalItems?: number; total?: number; totalPages?: number; page?: number };

type Profile = {
  nome?: string;
  email?: string;
  fone?: string;
  cidade?: string;
  uf?: string;
  linkedinUrl?: string;
  resumoProfissional?: string;
  avatarUrl?: string;
  trabalhandoAtualmente?: boolean | null;
};

type Tab = "vagas" | "candidaturas";
type ProfileSection =
  | "perfil" | "skills" | "education" | "preferences" | "lgpd"
  | "notifications" | "documents" | "experience" | "references"
  | "accessibility" | "apps" | "tests" | "agenda";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 24;
const APPLY_MAX_FILE_BYTES = 5 * 1024 * 1024;
const APPLY_ALLOWED_EXT = [".pdf", ".doc", ".docx"];
const UF_LIST = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const MODO_OPTIONS = [["Remoto","Remoto"],["Hibrido","Híbrido"],["Presencial","Presencial"]] as const;
const TIPO_OPTIONS = [["CLT","CLT"],["PJ","PJ"],["Estagio","Estágio"]] as const;
const LEVEL_OPTIONS = [["Junior","Júnior"],["Pleno","Pleno"],["Senior","Sênior"],["Lideranca","Liderança"]] as const;
const AREA_OPTIONS = [["Engenharia","Engenharia"],["Dados","Dados"],["Produto","Produto"],["Design","Design"],["Comercial","Comercial"],["Operacoes","Operações"]] as const;
const LOCATION_OPTIONS = [["Remoto","Remoto"],["São Paulo, SP","São Paulo"],["Rio de Janeiro, RJ","Rio de Janeiro"],["Belo Horizonte, MG","Belo Horizonte"],["Curitiba, PR","Curitiba"]] as const;

function filterLabel(value: string, options: readonly (readonly [string, string])[], placeholder: string) {
  if (!value) return placeholder;
  return options.find(([v]) => v === value)?.[1] ?? placeholder;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(min?: number | null, max?: number | null) {
  if (!max && !min) return "A combinar";
  const f = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  if (min && max) return `${f(min)} – ${f(max)}`;
  if (max) return `Até ${f(max)}`;
  return `A partir de ${f(min!)}`;
}

function hasAllowedExt(name: string) {
  return APPLY_ALLOWED_EXT.some(e => name.toLowerCase().endsWith(e));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PortalVagasScreen() {
  const searchParams = useSearchParams();
  // Resolve tenantId: URL param > sessão interna (localStorage)
  const tenantId = (
    searchParams.get("tenantId") ||
    searchParams.get("tenant") ||
    getTenantId() ||
    ""
  ).trim();
  const vagaId = (searchParams.get("vagaId") || "").trim();

  // ── UI state
  const [tab, setTab] = useState<Tab>("vagas");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Jobs
  const [jobs, setJobs] = useState<PagedJobs>({ items: [], totalItems: 0, totalPages: 1, page: 1 });
  const [loading, setLoading] = useState(false);
  const [tenantName, setTenantName] = useState<string | null>(null);

  // ── Filters
  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [mode, setMode] = useState("");
  const [type, setType] = useState("");
  const [level, setLevel] = useState("");
  const [area, setArea] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const hasFilters = !!(q || location || mode || type || level || area);


  // ── Job detail / apply
  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [sendingApply, setSendingApply] = useState(false);
  const [applyForm, setApplyForm] = useState({
    fullName: "", email: "", phone: "", uf: "", city: "",
    linkedin: "", portfolio: "", currentRole: "", experienceYears: "",
    salaryExpectation: "", availability: "", highlights: "", recruiterNotes: "", consent: false,
  });
  const [applyFile, setApplyFile] = useState<File | null>(null);
  const [camposPersonalizados, setCamposPersonalizados] = useState<{
    id: string; label: string; tipo: number; obrigatorio: boolean;
    isReadOnly: boolean; valorPadrao: string | null; opcoes: string | null;
  }[]>([]);
  const [camposValues, setCamposValues] = useState<Record<string, string>>({});

  // ── Profile
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSection, setProfileSection] = useState<ProfileSection>("perfil");
  const [profile, setProfile] = useState<Profile>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);

  // ── Access modal
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessMode, setAccessMode] = useState<"login" | "register">("login");
  const [accessLoading, setAccessLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ nome: "", email: "", fone: "", uf: "", cidade: "", password: "", passwordConfirm: "" });

  const candidateSession = useMemo(() => getPortalCandidateSession(tenantId), [tenantId]);
  const lastVagaIdRef = useRef<string | null>(null);

  // ── Query string
  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (location.trim()) p.set("location", location.trim());
    if (mode.trim()) p.set("mode", mode.trim());
    if (type.trim()) p.set("type", type.trim());
    if (level.trim()) p.set("level", level.trim());
    if (area.trim()) p.set("area", area.trim());
    p.set("sort", sort);
    p.set("page", String(page));
    p.set("pageSize", String(PAGE_SIZE));
    return p.toString();
  }, [area, level, location, mode, page, q, sort, type]);

  // ── Load jobs
  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiFetch(`/api/public/vagas?tenantId=${encodeURIComponent(tenantId)}&${query}`, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as JobsApiResponse | null;
        if (!alive) return;
        if (!res.ok || !data) { toast.error("Falha ao carregar vagas."); return; }
        const items = Array.isArray(data.items) ? data.items : [];
        setJobs({ items, totalItems: Number(data.totalItems || data.total || 0), totalPages: Number(data.totalPages || 1), page: Number(data.page || 1) });
        // Captura tenantName do primeiro resultado
        if (items.length > 0 && (items[0].tenantName || items[0].empresaNome)) {
          setTenantName(items[0].tenantName || items[0].empresaNome || null);
        }
      })
      .catch(() => { if (alive) toast.error("Falha ao carregar vagas."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [query, tenantId, refreshKey]);


  // ── Auto-load profile when candidate session exists
  useEffect(() => {
    if (!tenantId || !candidateSession?.id) return;
    portalCandidateFetch(tenantId, "", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as Profile | null;
        if (!data) return;
        setProfile({
          nome: data.nome || "", email: data.email || "", fone: data.fone || "",
          cidade: data.cidade || "", uf: data.uf || "", linkedinUrl: data.linkedinUrl || "",
          resumoProfissional: data.resumoProfissional || "", avatarUrl: data.avatarUrl || "",
          trabalhandoAtualmente: data.trabalhandoAtualmente,
        });
      })
      .catch(() => {});
  }, [tenantId, candidateSession?.id]);

  // ── Deeplink: open apply from URL vagaId
  useEffect(() => {
    if (!vagaId || lastVagaIdRef.current === vagaId) return;
    lastVagaIdRef.current = vagaId;
    let alive = true;
    (async () => {
      try {
        const res = await apiFetch(`/api/public/vagas/${encodeURIComponent(vagaId)}?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" });
        if (!res.ok) { toast.error("Vaga não encontrada."); return; }
        const job = await res.json() as JobItem;
        if (alive) openApply(job);
      } catch { if (alive) toast.error("Falha ao abrir vaga."); }
    })();
    return () => { alive = false; };
  }, [tenantId, vagaId]);

  // ── Handlers

  function openApply(job: JobItem) {
    setSelectedJob(job);
    setApplyForm(f => ({
      ...f,
      fullName: profile.nome || "",
      email: profile.email || "",
      phone: profile.fone || "",
      city: profile.cidade || "",
      uf: profile.uf || "",
      linkedin: profile.linkedinUrl || "",
    }));
    setApplyFile(null);
    setCamposPersonalizados([]);
    setCamposValues({});
    setApplyOpen(true);
    if (job.id && tenantId) {
      apiFetch(`/api/public/vagas/${encodeURIComponent(job.id)}/campos-personalizados?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" })
        .then(async res => {
          if (!res.ok) return;
          const data = await res.json();
          if (!Array.isArray(data)) return;
          setCamposPersonalizados(data);
          const defaults: Record<string, string> = {};
          for (const c of data) {
            if (c.valorPadrao) defaults[c.id] = c.valorPadrao;
            else if (c.tipo === 2) defaults[c.id] = "false";
            else defaults[c.id] = "";
          }
          setCamposValues(defaults);
        })
        .catch(() => {});
    }
  }

  async function submitApply() {
    if (!selectedJob?.id || !tenantId) return;
    if (!applyForm.consent) { toast.error("Aceite o uso dos dados para continuar."); return; }
    if (!applyForm.fullName || !applyForm.email || !applyForm.phone) {
      toast.error("Preencha nome, e-mail e celular."); return;
    }
    for (const campo of camposPersonalizados) {
      if (campo.obrigatorio) {
        const val = (camposValues[campo.id] ?? "").trim();
        if (!val || (campo.tipo === 2 && val === "false")) { toast.error(`Campo "${campo.label}" é obrigatório.`); return; }
      }
    }
    if (applyFile) {
      if (applyFile.size > APPLY_MAX_FILE_BYTES) { toast.error("Arquivo excede 5 MB."); return; }
      if (!hasAllowedExt(applyFile.name)) { toast.error("Use PDF, DOC ou DOCX."); return; }
    }
    const fd = new FormData();
    fd.append("vagaId", selectedJob.id);
    fd.append("nome", applyForm.fullName.trim());
    fd.append("email", applyForm.email.trim());
    fd.append("fone", applyForm.phone.trim());
    fd.append("cidadeUf", [applyForm.city, applyForm.uf].filter(Boolean).join(", "));
    fd.append("linkedin", applyForm.linkedin.trim());
    fd.append("portfolio", applyForm.portfolio.trim());
    fd.append("cargoAtual", applyForm.currentRole.trim());
    fd.append("anosExperiencia", applyForm.experienceYears.trim());
    const obs = [
      applyForm.highlights ? `Resumo: ${applyForm.highlights}` : "",
      applyForm.recruiterNotes ? `Info: ${applyForm.recruiterNotes}` : "",
      applyForm.salaryExpectation ? `Pretensão: ${applyForm.salaryExpectation}` : "",
      applyForm.availability ? `Disponibilidade: ${applyForm.availability}` : "",
    ].filter(Boolean).join(" | ");
    fd.append("observacoes", obs);
    if (applyFile) fd.append("arquivo", applyFile);
    if (camposPersonalizados.length > 0) {
      fd.append("camposPersonalizadosJson", JSON.stringify(camposPersonalizados.map(c => ({ campoId: c.id, valor: (camposValues[c.id] ?? "").trim() }))));
    }
    setSendingApply(true);
    try {
      const res = await apiFetch(`/api/public/candidaturas?tenantId=${encodeURIComponent(tenantId)}`, { method: "POST", headers: { "X-Tenant-Id": tenantId }, body: fd });
      if (!res.ok) { const e = await res.text().catch(() => ""); throw new Error(e || `HTTP ${res.status}`); }
      toast.success("Candidatura enviada! Complete seu perfil para aumentar suas chances.", { duration: 6000 });
      addAppToHistory({ title: selectedJob.titulo, company: selectedJob.tenantName ?? "", location: [selectedJob.cidade, selectedJob.uf].filter(Boolean).join(", "), date: new Date().toLocaleDateString("pt-BR"), status: "Aplicado" });
      setApplyOpen(false);
    } catch { toast.error("Falha ao enviar candidatura."); }
    finally { setSendingApply(false); }
  }

  async function openProfile() {
    setProfileOpen(true);
    if (!tenantId || !candidateSession?.id) { setAuthRequired(true); return; }
    try {
      const res = await portalCandidateFetch(tenantId, "", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as Profile | null;
      if (!res.ok || !data) { if (res.status === 401 || res.status === 403) { setAuthRequired(true); return; } throw new Error(); }
      setAuthRequired(false);
      setProfile({ nome: data.nome || "", email: data.email || "", fone: data.fone || "", cidade: data.cidade || "", uf: data.uf || "", linkedinUrl: data.linkedinUrl || "", resumoProfissional: data.resumoProfissional || "", avatarUrl: data.avatarUrl || "", trabalhandoAtualmente: data.trabalhandoAtualmente });
    } catch { toast.error("Falha ao carregar perfil."); }
  }

  async function saveProfile() {
    if (!tenantId) return;
    setSavingProfile(true);
    try {
      const res = await portalCandidateFetch(tenantId, "", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: profile.nome || "", fone: profile.fone || "", cidade: profile.cidade || "", uf: (profile.uf || "").toUpperCase(), linkedinUrl: profile.linkedinUrl || "", resumoProfissional: profile.resumoProfissional || "", trabalhandoAtualmente: profile.trabalhandoAtualmente ?? null }) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error();
      toast.success("Perfil salvo.");
      setProfile(p => ({ ...p, ...data }));
    } catch { toast.error("Falha ao salvar perfil."); }
    finally { setSavingProfile(false); }
  }

  async function upload(kind: "avatar" | "curriculo", file: File) {
    if (!tenantId) return;
    const suffix = kind === "avatar" ? "/avatar" : "/curriculos";
    const fd = new FormData();
    fd.append("arquivo", file);
    try {
      const res = await portalCandidateFetch(tenantId, suffix, { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      toast.success(kind === "avatar" ? "Foto atualizada." : "Currículo atualizado.");
    } catch { toast.error("Falha no upload."); }
  }

  async function doLogin() {
    if (!EMAIL_REGEX.test(loginForm.email)) { toast.error("E-mail inválido."); return; }
    if (!loginForm.password) { toast.error("Informe a senha."); return; }
    setAccessLoading(true);
    try {
      const res = await portalAuthFetch(tenantId, "/api/public/portal-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginForm.email.trim(), password: loginForm.password }),
      });
      const data = await res.json().catch(() => null) as { id?: string; nome?: string; email?: string; message?: string } | null;
      if (!res.ok) { clearPortalCandidateSession(tenantId); toast.error(data?.message || "Falha ao entrar."); return; }
      if (!data?.id) { toast.error("Resposta inválida."); return; }
      savePortalCandidateSession({ tenantId, id: String(data.id), nome: data.nome, email: data.email });
      setAccessOpen(false);
      void openProfile();
    } catch { toast.error("Falha ao entrar."); }
    finally { setAccessLoading(false); }
  }

  async function doRegister() {
    if (!registerForm.nome.trim()) { toast.error("Informe o nome completo."); return; }
    if (!EMAIL_REGEX.test(registerForm.email)) { toast.error("E-mail inválido."); return; }
    if (!registerForm.uf || !registerForm.cidade) { toast.error("Selecione UF e cidade."); return; }
    if (!PASSWORD_REGEX.test(registerForm.password)) { toast.error("Senha fora do padrão (mín. 8, 1 maiúscula, 1 número e 1 especial)."); return; }
    if (registerForm.password !== registerForm.passwordConfirm) { toast.error("As senhas não conferem."); return; }
    setAccessLoading(true);
    try {
      const res = await portalAuthFetch(tenantId, "/api/public/portal-auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: registerForm.nome.trim(), email: registerForm.email.trim(), fone: registerForm.fone.trim(), cidade: registerForm.cidade, uf: registerForm.uf, password: registerForm.password }),
      });
      const data = await res.json().catch(() => null) as { id?: string; nome?: string; email?: string; message?: string } | null;
      if (!res.ok) { toast.error(data?.message || "Falha ao criar acesso."); return; }
      if (!data?.id) { toast.error("Resposta inválida."); return; }
      savePortalCandidateSession({ tenantId, id: String(data.id), nome: data.nome, email: data.email });
      setAccessOpen(false);
      void openProfile();
    } catch { toast.error("Falha ao criar acesso."); }
    finally { setAccessLoading(false); }
  }

  function resetFilters() { setQ(""); setLocation(""); setMode(""); setType(""); setLevel(""); setArea(""); setPage(1); }

  // ── CSS helpers
  const inp = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";
  const sel = "w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";
  const lbl = "block text-xs font-medium text-muted-foreground mb-1";

  // ─── Bloqueio: sem tenant ────────────────────────────────────────────────
  if (!tenantId) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-red-100 mb-4">
          <svg className="size-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-foreground">Acesso inválido</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Este portal só pode ser acessado pelo link fornecido pela empresa. Entre em contato com o RH para obter o link correto.
        </p>
      </div>
    );
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ══════════════════════ HEADER ══════════════════════ */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          {/* Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#105290] text-white">
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-bold text-sm text-foreground leading-none">Portal de Vagas</span>
            {tenantName && (
              <span className="hidden sm:inline-flex rounded-full bg-[#105290]/10 px-2 py-0.5 text-xs font-medium text-[#105290]">
                {tenantName}
              </span>
            )}
          </div>

          {/* Tabs nav */}
          <nav className="flex items-center gap-1 ml-4">
            {(["vagas", "candidaturas"] as Tab[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${tab === t ? "bg-[#105290] text-white" : "text-muted-foreground hover:bg-muted/60"}`}
              >
                {t === "vagas" ? "Vagas" : "Candidaturas"}
              </button>
            ))}
          </nav>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => void openProfile()}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              {candidateSession?.nome ? candidateSession.nome.split(" ")[0] : "Meu Perfil"}
            </button>
          </div>
        </div>
      </header>

      {/* ══════════════════════ HERO ══════════════════════ */}
      <div className="bg-gradient-to-br from-[#0a2f5c] via-[#105290] to-[#1a6bbf] px-4 pb-10 pt-10 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Encontre sua próxima vaga
          </h1>
          <p className="mt-2 text-white/70 text-sm">
            Candidate-se em segundos — sem precisar criar uma conta.
          </p>

          {/* Search */}
          <div className="mx-auto mt-6 flex max-w-2xl items-center gap-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-2.5 shadow-lg focus-within:bg-white/15 transition-colors">
            <svg className="size-4 shrink-0 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/50 focus:outline-none"
              placeholder="Cargo, área, tecnologia, cidade..."
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1); }}
            />
            {q && (
              <button type="button" className="text-white/60 hover:text-white" onClick={() => { setQ(""); setPage(1); }}>
                <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-white/60">
            <span>{loading ? "Carregando..." : `${jobs.totalItems} vaga${jobs.totalItems !== 1 ? "s" : ""} disponíveis`}</span>
            {tenantName && <><span>·</span><span>{tenantName}</span></>}
          </div>
        </div>
      </div>

      {/* ══════════════════════ MAIN CONTENT ══════════════════════ */}
      <div className="mx-auto max-w-7xl px-4 py-6">

        {tab === "candidaturas" ? (
          <MinhasCandidaturasSection />
        ) : (
          <>
            {/* ── Filter bar */}
            <div className="mb-5 rounded-xl border border-border/40 bg-white shadow-sm">
              <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                {/* Formato */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs transition-colors text-muted-foreground hover:text-foreground">
                      {filterLabel(mode, MODO_OPTIONS, "Formato")}
                      <ChevronDown className="size-3 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[160px]">
                    <DropdownMenuCheckboxItem checked={!mode} onCheckedChange={() => { setMode(""); setPage(1); }}>Todos</DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    {MODO_OPTIONS.map(([v, l]) => (
                      <DropdownMenuCheckboxItem key={v} checked={mode === v} onCheckedChange={c => { setMode(c ? v : ""); setPage(1); }}>{l}</DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Contratação */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs transition-colors text-muted-foreground hover:text-foreground">
                      {filterLabel(type, TIPO_OPTIONS, "Contratação")}
                      <ChevronDown className="size-3 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[160px]">
                    <DropdownMenuCheckboxItem checked={!type} onCheckedChange={() => { setType(""); setPage(1); }}>Todos</DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    {TIPO_OPTIONS.map(([v, l]) => (
                      <DropdownMenuCheckboxItem key={v} checked={type === v} onCheckedChange={c => { setType(c ? v : ""); setPage(1); }}>{l}</DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Senioridade */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs transition-colors text-muted-foreground hover:text-foreground">
                      {filterLabel(level, LEVEL_OPTIONS, "Senioridade")}
                      <ChevronDown className="size-3 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[160px]">
                    <DropdownMenuCheckboxItem checked={!level} onCheckedChange={() => { setLevel(""); setPage(1); }}>Todos</DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    {LEVEL_OPTIONS.map(([v, l]) => (
                      <DropdownMenuCheckboxItem key={v} checked={level === v} onCheckedChange={c => { setLevel(c ? v : ""); setPage(1); }}>{l}</DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Área */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs transition-colors text-muted-foreground hover:text-foreground">
                      {filterLabel(area, AREA_OPTIONS, "Área")}
                      <ChevronDown className="size-3 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[160px]">
                    <DropdownMenuCheckboxItem checked={!area} onCheckedChange={() => { setArea(""); setPage(1); }}>Todos</DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    {AREA_OPTIONS.map(([v, l]) => (
                      <DropdownMenuCheckboxItem key={v} checked={area === v} onCheckedChange={c => { setArea(c ? v : ""); setPage(1); }}>{l}</DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Localização */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs transition-colors text-muted-foreground hover:text-foreground">
                      {filterLabel(location, LOCATION_OPTIONS, "Localização")}
                      <ChevronDown className="size-3 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[180px]">
                    <DropdownMenuCheckboxItem checked={!location} onCheckedChange={() => { setLocation(""); setPage(1); }}>Todos</DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    {LOCATION_OPTIONS.map(([v, l]) => (
                      <DropdownMenuCheckboxItem key={v} checked={location === v} onCheckedChange={c => { setLocation(c ? v : ""); setPage(1); }}>{l}</DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="ml-auto flex items-center gap-2">
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    value={sort}
                    onChange={e => setSort(e.target.value)}
                  >
                    <option value="recent">Mais recentes</option>
                    <option value="salaryDesc">Maior salário</option>
                    <option value="companyAsc">Empresa A-Z</option>
                  </select>
                  {hasFilters && (
                    <button type="button" onClick={resetFilters} className="inline-flex h-8 items-center rounded-md border border-input bg-background px-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Limpar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Job grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-52 rounded-xl border border-border/40 bg-white animate-pulse" />
                ))}
              </div>
            ) : jobs.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <svg className="size-12 text-muted-foreground/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                <p className="font-semibold text-muted-foreground">Nenhuma vaga encontrada</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Tente remover filtros ou buscar por outras palavras.</p>
                {hasFilters && (
                  <button type="button" onClick={resetFilters} className="mt-4 rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted/50 transition-colors">
                    Limpar filtros
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {jobs.items.map((job, idx) => (
                    <JobCard key={job.id} job={job} index={idx} onDetails={() => setSelectedJob(job)} onApply={() => openApply(job)} />
                  ))}
                </div>
                {jobs.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-8">
                    <button className="rounded-lg border border-border bg-white px-4 py-2 text-sm hover:bg-muted/50 transition-colors disabled:opacity-40" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                      ← Anterior
                    </button>
                    <span className="text-sm text-muted-foreground">Página {jobs.page} de {jobs.totalPages}</span>
                    <button className="rounded-lg border border-border bg-white px-4 py-2 text-sm hover:bg-muted/50 transition-colors disabled:opacity-40" disabled={page >= jobs.totalPages} onClick={() => setPage(p => p + 1)}>
                      Próxima →
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* ══════════════════════ JOB DETAIL MODAL ══════════════════════ */}
      {selectedJob && !applyOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-2xl border border-border/40 bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-border/40 bg-white px-6 py-4">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  {selectedJob.urgente && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Urgente</span>}
                  {selectedJob.aceitaPcd && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">PCD</span>}
                </div>
                <h2 className="text-lg font-bold leading-tight">{selectedJob.titulo}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{selectedJob.tenantName || selectedJob.empresaNome || "Empresa"}</p>
              </div>
              <button type="button" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors" onClick={() => setSelectedJob(null)}>
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">
              {/* Meta chips */}
              <div className="flex flex-wrap gap-2">
                {selectedJob.modalidade && <span className="rounded-full border border-border/60 bg-slate-50 px-3 py-1 text-xs font-medium">{selectedJob.modalidade}</span>}
                {selectedJob.tipoContratacao && <span className="rounded-full border border-border/60 bg-slate-50 px-3 py-1 text-xs font-medium">{selectedJob.tipoContratacao}</span>}
                {selectedJob.senioridade && <span className="rounded-full border border-border/60 bg-slate-50 px-3 py-1 text-xs font-medium">{selectedJob.senioridade}</span>}
                {(selectedJob.cidade || selectedJob.uf) && <span className="rounded-full border border-border/60 bg-slate-50 px-3 py-1 text-xs font-medium">{[selectedJob.cidade, selectedJob.uf].filter(Boolean).join(", ")}</span>}
                {(selectedJob.salarioMinimo || selectedJob.salarioMaximo) && <span className="rounded-full border border-[#105290]/30 bg-[#105290]/5 px-3 py-1 text-xs font-medium text-[#105290]">{money(selectedJob.salarioMinimo, selectedJob.salarioMaximo)}</span>}
                {selectedJob.quantidadeVagas != null && selectedJob.quantidadeVagas > 1 && <span className="rounded-full border border-border/60 bg-slate-50 px-3 py-1 text-xs font-medium">{selectedJob.quantidadeVagas} vagas</span>}
              </div>

              {/* Description */}
              {(selectedJob.descricaoPublica || buildSummary(selectedJob)) && (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {selectedJob.descricaoPublica || buildSummary(selectedJob)}
                </p>
              )}

              {/* Responsibilities */}
              {parseTagsResponsabilidades(selectedJob.tagsResponsabilidadesRaw).length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Responsabilidades</p>
                  <ul className="space-y-1.5">
                    {parseTagsResponsabilidades(selectedJob.tagsResponsabilidadesRaw).map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#105290]/60" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Stack tags */}
              {selectedJob.tagsStackRaw && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedJob.tagsStackRaw.split(/[,;|]/g).map(t => t.trim()).filter(Boolean).map((t, i) => (
                    <span key={i} className="rounded-full border border-border/50 bg-slate-50 px-2.5 py-0.5 text-xs text-muted-foreground">{t}</span>
                  ))}
                </div>
              )}

              {/* Etapas */}
              {selectedJob.etapas && selectedJob.etapas.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Processo seletivo ({selectedJob.etapas.length} etapas)</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedJob.etapas.map((nome, i, arr) => (
                      <span key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="flex size-5 items-center justify-center rounded-full bg-[#105290]/10 text-[#105290] text-[10px] font-bold">{i + 1}</span>
                        <span>{nome}</span>
                        {i < arr.length - 1 && <span className="text-border">→</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border/40 bg-white px-6 py-4">
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors" onClick={() => { const url = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}?tenantId=${tenantId}&vagaId=${selectedJob.id}` : ""; void navigator.clipboard.writeText(url); toast.success("Link copiado!"); }}>
                <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                Copiar link
              </button>
              <button type="button" onClick={() => { setSelectedJob(null); openApply(selectedJob); }} className="rounded-lg bg-[#105290] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0d3f72] transition-colors">
                Candidatar-se
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ APPLY MODAL ══════════════════════ */}
      {applyOpen && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-2xl border border-border/40 bg-white shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-border/40 px-6 py-4 shrink-0">
              <div>
                <h2 className="text-base font-bold">Candidatura</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{selectedJob.titulo} · {selectedJob.tenantName || selectedJob.empresaNome || "Empresa"}</p>
              </div>
              <button type="button" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors" onClick={() => setApplyOpen(false)}>
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Dados básicos */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Seus dados</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={lbl}>Nome completo *</label><input className={inp} placeholder="Seu nome completo" value={applyForm.fullName} onChange={e => setApplyForm(f => ({ ...f, fullName: e.target.value }))} /></div>
                  <div><label className={lbl}>E-mail *</label><input className={inp} type="email" placeholder="seu@email.com" value={applyForm.email} onChange={e => setApplyForm(f => ({ ...f, email: e.target.value }))} /></div>
                  <div><label className={lbl}>Celular *</label><input className={inp} placeholder="(11) 99999-9999" value={applyForm.phone} onChange={e => setApplyForm(f => ({ ...f, phone: e.target.value }))} /></div>
                  <div><label className={lbl}>Currículo (PDF/DOC/DOCX · máx 5 MB)</label><input className={inp} type="file" accept=".pdf,.doc,.docx" onChange={e => { const f = e.target.files?.[0] || null; if (f && f.size > APPLY_MAX_FILE_BYTES) { toast.error("Arquivo excede 5 MB."); return; } if (f && !hasAllowedExt(f.name)) { toast.error("Use PDF, DOC ou DOCX."); return; } setApplyFile(f); }} /></div>
                </div>
              </div>

              {/* Dados opcionais */}
              <details className="group rounded-xl border border-border/40 bg-slate-50/60">
                <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                  <svg className="size-3.5 shrink-0 transition-transform group-open:rotate-90" viewBox="0 0 16 16" fill="currentColor"><path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"/></svg>
                  Complementar perfil (opcional — aumenta suas chances)
                </summary>
                <div className="px-4 pb-4 pt-3 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className={lbl}>Cidade</label><input className={inp} placeholder="São Paulo" value={applyForm.city} onChange={e => setApplyForm(f => ({ ...f, city: e.target.value }))} /></div>
                    <div><label className={lbl}>Estado</label><select className={sel} value={applyForm.uf} onChange={e => setApplyForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))}><option value="">Selecione</option>{UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}</select></div>
                    <div><label className={lbl}>LinkedIn</label><input className={inp} placeholder="linkedin.com/in/seuperfil" value={applyForm.linkedin} onChange={e => setApplyForm(f => ({ ...f, linkedin: e.target.value }))} /></div>
                    <div><label className={lbl}>Portfolio / GitHub</label><input className={inp} placeholder="github.com/seuperfil" value={applyForm.portfolio} onChange={e => setApplyForm(f => ({ ...f, portfolio: e.target.value }))} /></div>
                    <div><label className={lbl}>Cargo atual</label><input className={inp} placeholder="Desenvolvedor Pleno" value={applyForm.currentRole} onChange={e => setApplyForm(f => ({ ...f, currentRole: e.target.value }))} /></div>
                    <div><label className={lbl}>Anos de experiência</label><input className={inp} type="number" min={0} placeholder="3" value={applyForm.experienceYears} onChange={e => setApplyForm(f => ({ ...f, experienceYears: e.target.value }))} /></div>
                    <div><label className={lbl}>Pretensão salarial</label><input className={inp} placeholder="R$ 8.000" value={applyForm.salaryExpectation} onChange={e => setApplyForm(f => ({ ...f, salaryExpectation: e.target.value }))} /></div>
                    <div><label className={lbl}>Disponibilidade</label><select className={sel} value={applyForm.availability} onChange={e => setApplyForm(f => ({ ...f, availability: e.target.value }))}><option value="">Selecione</option><option>Imediata</option><option>Até 15 dias</option><option>Até 30 dias</option><option>Mais de 30 dias</option></select></div>
                    <div className="sm:col-span-2"><label className={lbl}>Resumo profissional</label><textarea className={`${inp} resize-none`} rows={3} placeholder="Conte um pouco sobre você..." value={applyForm.highlights} onChange={e => setApplyForm(f => ({ ...f, highlights: e.target.value }))} /></div>
                  </div>
                </div>
              </details>

              {/* Campos personalizados */}
              {camposPersonalizados.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Informações da vaga</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {camposPersonalizados.map(campo => {
                      const val = camposValues[campo.id] ?? "";
                      if (campo.tipo === 2) return (
                        <label key={campo.id} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" className="rounded" disabled={campo.isReadOnly} checked={val === "true"} onChange={e => setCamposValues(v => ({ ...v, [campo.id]: e.target.checked ? "true" : "false" }))} />
                          <span className="text-sm">{campo.label}{campo.obrigatorio && " *"}</span>
                        </label>
                      );
                      if (campo.tipo === 1 && campo.opcoes) return (
                        <div key={campo.id}><label className={lbl}>{campo.label}{campo.obrigatorio && " *"}</label><select className={sel} disabled={campo.isReadOnly} value={val} onChange={e => setCamposValues(v => ({ ...v, [campo.id]: e.target.value }))}><option value="">Selecione</option>{campo.opcoes.split(";").map(o => o.trim()).filter(Boolean).map(o => <option key={o}>{o}</option>)}</select></div>
                      );
                      return (
                        <div key={campo.id}><label className={lbl}>{campo.label}{campo.obrigatorio && " *"}</label><input className={inp} type={campo.tipo === 3 ? "number" : "text"} readOnly={campo.isReadOnly} value={val} onChange={e => setCamposValues(v => ({ ...v, [campo.id]: e.target.value }))} /></div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Consentimento */}
              <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-border/40 bg-slate-50/60 p-3">
                <input type="checkbox" className="mt-0.5 rounded shrink-0" checked={applyForm.consent} onChange={e => setApplyForm(f => ({ ...f, consent: e.target.checked }))} />
                <span className="text-xs text-muted-foreground leading-relaxed">Concordo com o uso dos meus dados para fins de recrutamento e seleção, conforme a LGPD *</span>
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border/40 px-6 py-4 shrink-0">
              <button type="button" onClick={() => setApplyOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors">Cancelar</button>
              <button type="button" disabled={sendingApply} onClick={() => void submitApply()} className="rounded-lg bg-[#105290] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0d3f72] disabled:opacity-60 transition-colors">
                {sendingApply ? "Enviando..." : "Enviar candidatura"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ PROFILE MODAL ══════════════════════ */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-4xl rounded-2xl border border-border/40 bg-white shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-border/40 px-6 py-4 shrink-0">
              <div>
                <h2 className="text-base font-bold">Meu Perfil</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Atualize seus dados de candidato.</p>
              </div>
              <button type="button" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors" onClick={() => setProfileOpen(false)}>
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {authRequired ? (
              <div className="px-6 py-12 text-center">
                <p className="text-muted-foreground text-sm mb-4">Você precisa autenticar para editar o perfil.</p>
                <button
                  type="button"
                  onClick={() => { setProfileOpen(false); setAccessMode("login"); setAccessOpen(true); }}
                  className="inline-flex items-center rounded-lg bg-[#105290] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d3f72] transition-colors"
                >
                  Entrar / Criar conta
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1 border-b border-border/40 px-6 py-2.5 shrink-0 overflow-x-auto">
                  {([["perfil","Perfil"],["skills","Competências"],["education","Formação"],["experience","Experiência"],["preferences","Preferências"],["documents","Documentos"],["references","Referências"],["lgpd","LGPD"],["notifications","Notificações"],["accessibility","Acessibilidade"],["agenda","Agenda"],["apps","Candidaturas"],["tests","Testes RH"]] as const).map(([key, label]) => (
                    <button key={key} type="button" onClick={() => setProfileSection(key)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${profileSection === key ? "bg-[#105290] text-white" : "text-muted-foreground hover:bg-muted/50"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="overflow-y-auto flex-1 px-6 py-5">
                  {profileSection === "perfil" && (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div><label className={lbl}>Nome</label><input className={inp} value={profile.nome || ""} onChange={e => setProfile(p => ({ ...p, nome: e.target.value }))} /></div>
                        <div><label className={lbl}>E-mail</label><input className={inp} value={profile.email || ""} readOnly /></div>
                        <div><label className={lbl}>Telefone</label><input className={inp} value={profile.fone || ""} onChange={e => setProfile(p => ({ ...p, fone: e.target.value }))} /></div>
                        <div><label className={lbl}>Estado</label><select className={sel} value={profile.uf || ""} onChange={e => setProfile(p => ({ ...p, uf: e.target.value.toUpperCase() }))}><option value="">Selecione</option>{UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}</select></div>
                        <div><label className={lbl}>Cidade</label><input className={inp} value={profile.cidade || ""} onChange={e => setProfile(p => ({ ...p, cidade: e.target.value }))} /></div>
                        <div><label className={lbl}>LinkedIn</label><input className={inp} value={profile.linkedinUrl || ""} onChange={e => setProfile(p => ({ ...p, linkedinUrl: e.target.value }))} /></div>
                        <div className="sm:col-span-2"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="rounded" checked={profile.trabalhandoAtualmente === true} onChange={e => setProfile(p => ({ ...p, trabalhandoAtualmente: e.target.checked }))} /><span className="text-sm text-muted-foreground">Está trabalhando atualmente</span></label></div>
                        <div className="sm:col-span-2"><label className={lbl}>Resumo profissional</label><textarea className={`${inp} resize-none`} rows={4} value={profile.resumoProfissional || ""} onChange={e => setProfile(p => ({ ...p, resumoProfissional: e.target.value }))} /></div>
                        <div><label className={lbl}>Foto</label><input className={inp} type="file" accept="image/*" onChange={e => e.target.files?.[0] && void upload("avatar", e.target.files[0])} /></div>
                        <div><label className={lbl}>Currículo (PDF/DOC)</label><input className={inp} type="file" accept=".pdf,.doc,.docx" onChange={e => e.target.files?.[0] && void upload("curriculo", e.target.files[0])} /></div>
                      </div>
                      <div className="mt-5 flex justify-end">
                        <button type="button" disabled={savingProfile} onClick={() => void saveProfile()} className="rounded-lg bg-[#105290] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0d3f72] disabled:opacity-60 transition-colors">
                          {savingProfile ? "Salvando..." : "Salvar perfil"}
                        </button>
                      </div>
                    </>
                  )}
                  {profileSection === "skills" && <PortalVagasSkillsSection />}
                  {profileSection === "education" && <PortalVagasEducationSection />}
                  {profileSection === "experience" && <PortalVagasExperienceSection />}
                  {profileSection === "preferences" && <PortalVagasPreferencesSection />}
                  {profileSection === "lgpd" && <PortalVagasLgpdSection />}
                  {profileSection === "notifications" && <PortalVagasNotificationsSection />}
                  {profileSection === "documents" && <PortalVagasDocumentsSection />}
                  {profileSection === "references" && <PortalVagasReferencesSection />}
                  {profileSection === "accessibility" && <PortalVagasAccessibilitySection />}
                  {profileSection === "agenda" && <PortalVagasAgendaScreen />}
                  {profileSection === "apps" && <PortalVagasAppsSection />}
                  {profileSection === "tests" && <PortalVagasTestsSection />}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ ACCESS MODAL ══════════════════════ */}
      {accessOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-border/40 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border/40 px-6 py-4">
              <div>
                <h2 className="text-base font-bold">Acesso ao Portal</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Entre ou crie sua conta para acompanhar candidaturas.</p>
              </div>
              <button type="button" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors" onClick={() => setAccessOpen(false)}>
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 px-6 pt-4">
              <button type="button" onClick={() => setAccessMode("login")} className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${accessMode === "login" ? "bg-[#105290] text-white" : "border border-border text-muted-foreground hover:bg-muted/50"}`}>Entrar</button>
              <button type="button" onClick={() => setAccessMode("register")} className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${accessMode === "register" ? "bg-[#105290] text-white" : "border border-border text-muted-foreground hover:bg-muted/50"}`}>Criar conta</button>
            </div>

            <div className="px-6 py-5">
              {accessMode === "login" ? (
                <div className="space-y-3">
                  <div><label className={lbl}>E-mail</label><input className={inp} type="email" placeholder="seu@email.com" value={loginForm.email} onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))} /></div>
                  <div><label className={lbl}>Senha</label><input className={inp} type="password" placeholder="••••••••" value={loginForm.password} onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))} /></div>
                  <button type="button" disabled={accessLoading} onClick={() => void doLogin()} className="w-full rounded-lg bg-[#105290] py-2 text-sm font-semibold text-white hover:bg-[#0d3f72] disabled:opacity-60 transition-colors">
                    {accessLoading ? "Entrando..." : "Entrar no portal"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div><label className={lbl}>Nome completo</label><input className={inp} placeholder="Seu nome" value={registerForm.nome} onChange={e => setRegisterForm(f => ({ ...f, nome: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>E-mail</label><input className={inp} type="email" placeholder="seu@email.com" value={registerForm.email} onChange={e => setRegisterForm(f => ({ ...f, email: e.target.value }))} /></div>
                    <div><label className={lbl}>Telefone</label><input className={inp} placeholder="(11) 99999-9999" value={registerForm.fone} onChange={e => setRegisterForm(f => ({ ...f, fone: e.target.value }))} /></div>
                    <div><label className={lbl}>UF</label><select className={sel} value={registerForm.uf} onChange={e => setRegisterForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))}><option value="">Selecione</option>{UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}</select></div>
                    <div><label className={lbl}>Cidade</label><input className={inp} placeholder="São Paulo" value={registerForm.cidade} onChange={e => setRegisterForm(f => ({ ...f, cidade: e.target.value }))} /></div>
                    <div><label className={lbl}>Senha</label><input className={inp} type="password" placeholder="••••••••" value={registerForm.password} onChange={e => setRegisterForm(f => ({ ...f, password: e.target.value }))} /></div>
                    <div><label className={lbl}>Confirmar senha</label><input className={inp} type="password" placeholder="••••••••" value={registerForm.passwordConfirm} onChange={e => setRegisterForm(f => ({ ...f, passwordConfirm: e.target.value }))} /></div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Mínimo 8 caracteres, 1 maiúscula, 1 número e 1 especial.</p>
                  <button type="button" disabled={accessLoading} onClick={() => void doRegister()} className="w-full rounded-lg bg-[#105290] py-2 text-sm font-semibold text-white hover:bg-[#0d3f72] disabled:opacity-60 transition-colors">
                    {accessLoading ? "Criando..." : "Criar acesso"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
