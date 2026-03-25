"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { getPortalCandidateSession, portalCandidateFetch } from "@/features/portalvagas/publicApi";
import PortalVagasAgendaScreen from "@/features/portalvagas/agenda/PortalVagasAgendaScreen";
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
import NewJobModal from "@/features/portalvagas/NewJobModal";
import JobCard from "@/features/portalvagas/JobCard";
import { Button } from "@/components/ui/button";
import { parseTagsResponsabilidades, buildSummary } from "@/features/portalvagas/jobsUtils";

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
};

type PagedJobs = {
  items: JobItem[];
  totalItems: number;
  totalPages: number;
  page: number;
};

type JobsApiResponse = {
  items?: JobItem[];
  totalItems?: number;
  total?: number;
  totalPages?: number;
  page?: number;
};

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

type Tab = "vagas" | "agenda";
type ProfileSection =
  | "perfil"
  | "skills"
  | "education"
  | "preferences"
  | "lgpd"
  | "notifications"
  | "documents"
  | "experience"
  | "references"
  | "accessibility"
  | "apps"
  | "tests";
type ApplyFieldKey =
  | "fullName"
  | "email"
  | "phone"
  | "uf"
  | "city"
  | "linkedin"
  | "portfolio"
  | "currentRole"
  | "experienceYears"
  | "salaryExpectation"
  | "availability";

const PAGE_SIZE = 24;
const APPLY_ALLOWED_FILE_EXT = [".pdf", ".doc", ".docx"];
const APPLY_MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const UF_LIST = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

function money(min?: number | null, max?: number | null) {
  if (!max) return "A combinar";
  const f = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  return `${f(min || 0)} - ${f(max)}`;
}

function tags(job: JobItem) {
  return `${job.tagsKeywordsRaw || ""},${job.tagsStackRaw || ""},${job.tagsResponsabilidadesRaw || ""}`
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function hasAllowedApplyExtension(fileName: string) {
  const lower = fileName.toLowerCase();
  return APPLY_ALLOWED_FILE_EXT.some((ext) => lower.endsWith(ext));
}

export default function PortalVagasScreen() {
  const searchParams = useSearchParams();
  const tenantId = (searchParams.get("tenantId") || searchParams.get("tenant") || "").trim();
  const vagaId = (searchParams.get("vagaId") || "").trim();

  const [tab, setTab] = useState<Tab>("vagas");
  const [jobs, setJobs] = useState<PagedJobs>({ items: [], totalItems: 0, totalPages: 1, page: 1 });
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [mode, setMode] = useState("");
  const [type, setType] = useState("");
  const [level, setLevel] = useState("");
  const [area, setArea] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);

  const [isAdmin, setIsAdmin] = useState(false);
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedJob, setSelectedJob] = useState<JobItem | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [sendingApply, setSendingApply] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSection, setProfileSection] = useState<ProfileSection>("perfil");
  const [profile, setProfile] = useState<Profile>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);

  const [applyForm, setApplyForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    uf: "",
    city: "",
    linkedin: "",
    portfolio: "",
    currentRole: "",
    experienceYears: "",
    salaryExpectation: "",
    availability: "",
    highlights: "",
    recruiterNotes: "",
    consent: false,
  });
  const [applyFile, setApplyFile] = useState<File | null>(null);
  const [camposPersonalizados, setCamposPersonalizados] = useState<{ id: string; label: string; tipo: number; obrigatorio: boolean; isReadOnly: boolean; valorPadrao: string | null; opcoes: string | null }[]>([]);
  const [camposValues, setCamposValues] = useState<Record<string, string>>({});

  const canQuery = tenantId.length > 0;
  const candidateSession = useMemo(() => (tenantId ? getPortalCandidateSession(tenantId) : null), [tenantId]);
  const lastAppliedVagaIdRef = useRef<string | null>(null);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (location.trim()) p.set("location", location.trim());
    if (mode.trim()) p.set("mode", mode.trim());
    if (type.trim()) p.set("type", type.trim());
    if (level.trim()) p.set("level", level.trim());
    if (area.trim()) p.set("area", area.trim());
    const minSal = minSalary.trim() ? parseFloat(minSalary.replace(/\D/g, "")) : null;
    if (minSal != null && Number.isFinite(minSal)) p.set("minSalary", String(minSal));
    p.set("sort", sort);
    p.set("page", String(page));
    p.set("pageSize", String(PAGE_SIZE));
    return p.toString();
  }, [area, level, location, minSalary, mode, page, q, sort, type]);

  useEffect(() => {
    if (!canQuery) {
      setJobs({ items: [], totalItems: 0, totalPages: 1, page: 1 });
      return;
    }
    let alive = true;
    setLoading(true);
    apiFetch(`/api/public/vagas?tenantId=${encodeURIComponent(tenantId)}&${query}`, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as JobsApiResponse | null;
        if (!alive) return;
        if (!res.ok || !data) {
          toast.error("Falha ao carregar vagas.");
          return;
        }
        setJobs({
          items: Array.isArray(data.items) ? data.items : [],
          totalItems: Number(data.totalItems || data.total || 0),
          totalPages: Number(data.totalPages || 1),
          page: Number(data.page || 1),
        });
      })
      .catch(() => {
        if (alive) toast.error("Falha ao carregar vagas.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [canQuery, query, tenantId, refreshKey]);

  useEffect(() => {
    if (!tenantId) return;
    // Contexto legado removido nesta versão pública da API.
    setIsAdmin(false);
  }, [tenantId]);

  function openApply(job: JobItem) {
    setSelectedJob(job);
    setApplyForm((f) => ({
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

    // Buscar campos personalizados da vaga
    if (job.id && tenantId) {
      apiFetch(`/api/public/vagas/${encodeURIComponent(job.id)}/campos-personalizados?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          if (Array.isArray(data)) {
            setCamposPersonalizados(data);
            const defaults: Record<string, string> = {};
            for (const c of data) {
              if (c.valorPadrao) defaults[c.id] = c.valorPadrao;
              else if (c.tipo === 2) defaults[c.id] = "false";
              else defaults[c.id] = "";
            }
            setCamposValues(defaults);
          }
        })
        .catch(() => { /* best-effort */ });
    }
  }

  // Deeplink: ao abrir o portal com vagaId, já pré-seleciona a vaga e abre candidatura.
  useEffect(() => {
    if (!canQuery) return;
    if (!vagaId) return;
    if (lastAppliedVagaIdRef.current === vagaId) return;

    let alive = true;
    lastAppliedVagaIdRef.current = vagaId;

    (async () => {
      try {
        const res = await apiFetch(
          `/api/public/vagas/${encodeURIComponent(vagaId)}?tenantId=${encodeURIComponent(tenantId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          toast.error("Vaga não encontrada no portal.");
          return;
        }

        const job = (await res.json()) as JobItem;
        if (!alive) return;
        openApply(job);
      } catch (e) {
        if (!alive) return;
        toast.error(e instanceof Error ? e.message : "Falha ao abrir candidatura pela vaga informada.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [canQuery, tenantId, vagaId]);

  // UF/Cidade agora são campos locais (sem dependência de endpoint legado de localização).

  async function submitApply() {
    if (!selectedJob?.id) return;
    if (!tenantId) {
      toast.error("Tenant não informado.");
      return;
    }
    if (!applyForm.consent) {
      toast.error("Você precisa concordar com o compartilhamento dos dados.");
      return;
    }
    if (
      !applyForm.fullName ||
      !applyForm.email ||
      !applyForm.phone ||
      !applyForm.currentRole ||
      !applyForm.experienceYears ||
      !applyForm.highlights ||
      !applyForm.uf ||
      !applyForm.city ||
      !applyForm.salaryExpectation ||
      !applyForm.availability
    ) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }
    // Validar campos personalizados obrigatórios
    for (const campo of camposPersonalizados) {
      if (campo.obrigatorio) {
        const val = (camposValues[campo.id] ?? "").trim();
        if (!val || (campo.tipo === 2 && val === "false")) {
          toast.error(`O campo "${campo.label}" é obrigatório.`);
          return;
        }
      }
    }
    if (applyFile) {
      if (applyFile.size > APPLY_MAX_FILE_BYTES) {
        toast.error("O arquivo excede 5MB. Selecione um arquivo menor.");
        return;
      }
      if (!hasAllowedApplyExtension(applyFile.name)) {
        toast.error("Formato não aceito. Use PDF, DOC ou DOCX.");
        return;
      }
    }
    const formData = new FormData();
    formData.append("vagaId", selectedJob.id);
    formData.append("nome", applyForm.fullName.trim());
    formData.append("email", applyForm.email.trim());
    formData.append("fone", applyForm.phone.trim());
    formData.append("cidadeUf", `${applyForm.city || ""}${applyForm.city && applyForm.uf ? ", " : ""}${applyForm.uf || ""}`.trim());
    formData.append("linkedin", applyForm.linkedin.trim());
    formData.append("portfolio", applyForm.portfolio.trim());
    formData.append("cargoAtual", applyForm.currentRole.trim());
    formData.append("anosExperiencia", applyForm.experienceYears.trim());

    const obs = [
      applyForm.highlights ? `Resumo: ${applyForm.highlights.trim()}` : "",
      applyForm.recruiterNotes ? `Info: ${applyForm.recruiterNotes.trim()}` : "",
      applyForm.salaryExpectation ? `Pretensão salarial: ${applyForm.salaryExpectation.trim()}` : "",
      applyForm.availability ? `Disponibilidade: ${applyForm.availability.trim()}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
    formData.append("observacoes", obs);
    if (applyFile) formData.append("arquivo", applyFile);

    // Campos personalizados (JSON)
    if (camposPersonalizados.length > 0) {
      const respostas = camposPersonalizados.map((c) => ({ campoId: c.id, valor: (camposValues[c.id] ?? "").trim() }));
      formData.append("camposPersonalizadosJson", JSON.stringify(respostas));
    }

    setSendingApply(true);
    try {
      const res = await apiFetch(`/api/public/candidaturas?tenantId=${encodeURIComponent(tenantId)}`, {
        method: "POST",
        headers: { "X-Tenant-Id": tenantId },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(err || `HTTP ${res.status}`);
      }
      toast.success("Candidatura enviada com sucesso.");
      addAppToHistory({
        title: selectedJob.titulo,
        company: (selectedJob.empresaNome || selectedJob.tenantName) ?? "",
        location: [selectedJob.cidade, selectedJob.uf].filter(Boolean).join(", "),
        date: new Date().toLocaleDateString("pt-BR"),
        status: "Aplicado",
      });
      setApplyOpen(false);
    } catch {
      toast.error("Falha ao enviar candidatura.");
    } finally {
      setSendingApply(false);
    }
  }

  async function openProfile() {
    setProfileOpen(true);
    if (!tenantId || !candidateSession?.id) {
      setAuthRequired(true);
      return;
    }
    try {
      const res = await portalCandidateFetch(tenantId, "", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as Profile | null;
      if (!res.ok || !data) {
        if (res.status === 401 || res.status === 403) {
          setAuthRequired(true);
          return;
        }
        throw new Error();
      }
      setAuthRequired(false);
      setProfile({
        nome: data.nome || "",
        email: data.email || "",
        fone: data.fone || "",
        cidade: data.cidade || "",
        uf: data.uf || "",
        linkedinUrl: data.linkedinUrl || "",
        resumoProfissional: data.resumoProfissional || "",
        avatarUrl: data.avatarUrl || "",
        trabalhandoAtualmente: (data as Record<string, unknown>).trabalhandoAtualmente as boolean | null | undefined,
      });
    } catch {
      toast.error("Falha ao carregar perfil.");
    }
  }

  async function saveProfile() {
    if (!tenantId) return;
    setSavingProfile(true);
    try {
      const res = await portalCandidateFetch(tenantId, "", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: profile.nome || "",
          fone: profile.fone || "",
          cidade: profile.cidade || "",
          uf: (profile.uf || "").toUpperCase(),
          linkedinUrl: profile.linkedinUrl || "",
          resumoProfissional: profile.resumoProfissional || "",
          trabalhandoAtualmente: profile.trabalhandoAtualmente ?? null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error();
      toast.success("Perfil salvo.");
      setProfile((p) => ({ ...p, ...data }));
    } catch {
      toast.error("Falha ao salvar perfil.");
    } finally {
      setSavingProfile(false);
    }
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
    } catch {
      toast.error("Falha no upload.");
    }
  }

  function onApplyFileChange(file: File | null) {
    if (!file) {
      setApplyFile(null);
      return;
    }
    if (file.size > APPLY_MAX_FILE_BYTES) {
      toast.error("O arquivo excede 5MB. Selecione um arquivo menor.");
      return;
    }
    if (!hasAllowedApplyExtension(file.name)) {
      toast.error("Formato não aceito. Use PDF, DOC ou DOCX.");
      return;
    }
    setApplyFile(file);
  }

  const [showBackToTop, setShowBackToTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const inputCls = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";
  const selectCls = "w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-1";

  return (
    <div className="min-h-screen bg-background relative">

      {/* ── Hero ── */}
      <div className="border-b border-border/40 bg-gradient-to-br from-primary/5 via-background to-background px-4 pb-8 pt-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Encontre sua próxima vaga</h1>
        <p className="mt-2 text-muted-foreground text-sm">Candidate-se em segundos, sem criar conta.</p>

        {/* Search bar */}
        <div className="mx-auto mt-6 flex max-w-2xl items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-2.5 shadow-sm">
          <svg className="size-4 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            className="flex-1 bg-transparent text-sm focus:outline-none"
            placeholder="Cargo, área, tecnologia..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
          {q && (
            <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { setQ(""); setPage(1); }}>
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
          <Button variant="ghost" size="sm" onClick={() => void openProfile()}>Meu perfil</Button>
          {tab !== "agenda" && (
            <Button variant="ghost" size="sm" onClick={() => setTab("agenda")}>Ver agenda</Button>
          )}
          {tab === "agenda" && (
            <Button variant="ghost" size="sm" onClick={() => setTab("vagas")}>Ver vagas</Button>
          )}
          {!tenantId && (
            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-800">
              Link sem tenantId — use <code>?tenantId=...</code> para ver vagas
            </span>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        {tab === "agenda" ? (
          <PortalVagasAgendaScreen />
        ) : (
          <div className="space-y-5">
            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-2">
              <select className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }}>
                <option value="">Localização</option>
                <option value="São Paulo, SP">São Paulo, SP</option>
                <option value="Rio de Janeiro, RJ">Rio de Janeiro, RJ</option>
                <option value="Belo Horizonte, MG">Belo Horizonte, MG</option>
                <option value="Curitiba, PR">Curitiba, PR</option>
                <option value="Remoto">Remoto (Brasil)</option>
              </select>
              <select className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }}>
                <option value="">Formato</option>
                <option value="Remoto">Remoto</option>
                <option value="Hibrido">Híbrido</option>
                <option value="Presencial">Presencial</option>
              </select>
              <select className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
                <option value="">Contratação</option>
                <option value="CLT">CLT</option>
                <option value="PJ">PJ</option>
                <option value="Estágio">Estágio</option>
              </select>
              <select className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}>
                <option value="">Senioridade</option>
                <option value="Júnior">Júnior</option>
                <option value="Pleno">Pleno</option>
                <option value="Sênior">Sênior</option>
                <option value="Liderança">Liderança</option>
              </select>
              <select className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={area} onChange={(e) => { setArea(e.target.value); setPage(1); }}>
                <option value="">Área</option>
                <option value="Engenharia">Engenharia</option>
                <option value="Dados">Dados</option>
                <option value="Produto">Produto</option>
                <option value="Design">Design</option>
                <option value="Segurança">Segurança</option>
                <option value="Operações">Operações</option>
              </select>

              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {loading ? "Carregando..." : `${jobs.totalItems} vaga${jobs.totalItems !== 1 ? "s" : ""}`}
                </span>
                <select className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="recent">Mais recentes</option>
                  <option value="salaryDesc">Maior salário</option>
                  <option value="companyAsc">Empresa A-Z</option>
                </select>
                {(q || location || mode || type || level || area || minSalary) && (
                  <Button variant="ghost" size="sm" onClick={() => { setQ(""); setLocation(""); setMode(""); setType(""); setLevel(""); setArea(""); setMinSalary(""); setPage(1); }}>
                    Limpar filtros
                  </Button>
                )}
              </div>
            </div>

            {/* Jobs grid */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-44 rounded-xl border border-border/40 bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : jobs.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <svg className="size-12 text-muted-foreground/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                <p className="font-semibold text-muted-foreground">Nenhuma vaga encontrada</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Tente remover filtros ou buscar por outras palavras.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {jobs.items.map((job, idx) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      index={idx}
                      onDetails={() => setSelectedJob(job)}
                      onApply={() => openApply(job)}
                    />
                  ))}
                </div>

                {jobs.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-4">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">Página {jobs.page} de {jobs.totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= jobs.totalPages} onClick={() => setPage((p) => p + 1)}>
                      Próxima
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Job Detail Modal ── */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-2xl border border-border/40 bg-card shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-border/40 bg-card px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold leading-tight">{selectedJob.titulo}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{selectedJob.empresaNome || selectedJob.tenantName || "Empresa"}</p>
              </div>
              <button type="button" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors" onClick={() => setSelectedJob(null)}>
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              {/* Meta chips */}
              <div className="flex flex-wrap gap-2">
                {selectedJob.modalidade && <span className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium">{selectedJob.modalidade}</span>}
                {selectedJob.tipoContratacao && <span className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium">{selectedJob.tipoContratacao}</span>}
                {selectedJob.senioridade && <span className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium">{selectedJob.senioridade}</span>}
                {(selectedJob.cidade || selectedJob.uf) && <span className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium">{[selectedJob.cidade, selectedJob.uf].filter(Boolean).join(", ")}</span>}
                {(selectedJob.salarioMinimo || selectedJob.salarioMaximo) && <span className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">{money(selectedJob.salarioMinimo, selectedJob.salarioMaximo)}</span>}
              </div>

              {/* Description */}
              {buildSummary(selectedJob) && (
                <p className="text-sm text-muted-foreground leading-relaxed">{buildSummary(selectedJob)}</p>
              )}

              {/* Responsibilities */}
              {parseTagsResponsabilidades(selectedJob.tagsResponsabilidadesRaw).length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Responsabilidades</p>
                  <ul className="space-y-1.5">
                    {parseTagsResponsabilidades(selectedJob.tagsResponsabilidadesRaw).map((r, i) => (
                      <li key={`resp-${selectedJob.id}-${i}`} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Tags */}
              {tags(selectedJob).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags(selectedJob).map((t, i) => (
                    <span key={`tag-${selectedJob.id}-${i}`} className="rounded-full border border-border/50 px-2.5 py-0.5 text-xs text-muted-foreground">{t}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border/40 bg-card px-6 py-4">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                onClick={() => {
                  const url = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}#${selectedJob.id}` : `#${selectedJob.id}`;
                  void navigator.clipboard.writeText(url);
                  toast.success("Link copiado!");
                }}
              >
                <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                Copiar link
              </button>
              <Button onClick={() => { setSelectedJob(null); openApply(selectedJob); }}>
                Candidatar-se a esta vaga
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Apply Modal ── */}
      {applyOpen && selectedJob && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-2xl border border-border/40 bg-card shadow-2xl max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border/40 px-6 py-4 shrink-0">
              <div>
                <h2 className="text-lg font-semibold">Candidatura</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{selectedJob.titulo}</p>
              </div>
              <button type="button" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors" onClick={() => setApplyOpen(false)}>
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {/* Dados pessoais */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Dados pessoais</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Nome completo *</label>
                    <input className={inputCls} placeholder="Seu nome completo" value={applyForm.fullName} onChange={(e) => setApplyForm((f) => ({ ...f, fullName: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>E-mail *</label>
                    <input className={inputCls} type="email" placeholder="seu@email.com" value={applyForm.email} onChange={(e) => setApplyForm((f) => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Telefone</label>
                    <input className={inputCls} placeholder="(11) 99999-9999" value={applyForm.phone} onChange={(e) => setApplyForm((f) => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>LinkedIn</label>
                    <input className={inputCls} placeholder="linkedin.com/in/seuperfil" value={applyForm.linkedin} onChange={(e) => setApplyForm((f) => ({ ...f, linkedin: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Cidade</label>
                    <input className={inputCls} placeholder="São Paulo" value={applyForm.city} onChange={(e) => setApplyForm((f) => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Estado</label>
                    <select className={selectCls} value={applyForm.uf} onChange={(e) => setApplyForm((f) => ({ ...f, uf: e.target.value.toUpperCase() }))}>
                      <option value="">Selecione</option>
                      {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Experiência */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Experiência</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Cargo atual</label>
                    <input className={inputCls} placeholder="Desenvolvedor Pleno" value={applyForm.currentRole} onChange={(e) => setApplyForm((f) => ({ ...f, currentRole: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Anos de experiência</label>
                    <input className={inputCls} type="number" min={0} placeholder="3" value={applyForm.experienceYears} onChange={(e) => setApplyForm((f) => ({ ...f, experienceYears: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Pretensão salarial</label>
                    <input className={inputCls} placeholder="R$ 8.000" value={applyForm.salaryExpectation} onChange={(e) => setApplyForm((f) => ({ ...f, salaryExpectation: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Disponibilidade</label>
                    <select className={selectCls} value={applyForm.availability} onChange={(e) => setApplyForm((f) => ({ ...f, availability: e.target.value }))}>
                      <option value="">Selecione</option>
                      <option value="Imediata">Imediata</option>
                      <option value="Até 15 dias">Até 15 dias</option>
                      <option value="Até 30 dias">Até 30 dias</option>
                      <option value="Mais de 30 dias">Mais de 30 dias</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Resumo profissional</label>
                    <textarea className={`${inputCls} resize-none`} rows={3} placeholder="Conte um pouco sobre você e seus diferenciais..." value={applyForm.highlights} onChange={(e) => setApplyForm((f) => ({ ...f, highlights: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Campos personalizados */}
              {camposPersonalizados.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Informações da vaga</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {camposPersonalizados.map((campo) => {
                      const val = camposValues[campo.id] ?? "";
                      const readOnly = campo.isReadOnly;
                      const fieldLabel = `${campo.label}${campo.obrigatorio ? " *" : ""}`;
                      if (campo.tipo === 2) {
                        return (
                          <label key={campo.id} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="rounded" disabled={readOnly} checked={val === "true"} onChange={(e) => setCamposValues((v) => ({ ...v, [campo.id]: e.target.checked ? "true" : "false" }))} />
                            <span className="text-sm">{fieldLabel}</span>
                          </label>
                        );
                      }
                      if (campo.tipo === 1 && campo.opcoes) {
                        return (
                          <div key={campo.id}>
                            <label className={labelCls}>{fieldLabel}</label>
                            <select className={selectCls} disabled={readOnly} value={val} onChange={(e) => setCamposValues((v) => ({ ...v, [campo.id]: e.target.value }))}>
                              <option value="">Selecione</option>
                              {campo.opcoes.split(";").map((o) => o.trim()).filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                        );
                      }
                      return (
                        <div key={campo.id}>
                          <label className={labelCls}>{fieldLabel}</label>
                          <input className={inputCls} type={campo.tipo === 3 ? "number" : "text"} readOnly={readOnly} value={val} onChange={(e) => setCamposValues((v) => ({ ...v, [campo.id]: e.target.value }))} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Currículo + LGPD */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Currículo e consentimento</p>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Currículo (PDF, DOC, DOCX — máx. 5MB)</label>
                    <input className={inputCls} type="file" accept=".pdf,.doc,.docx" onChange={(e) => onApplyFileChange(e.target.files?.[0] || null)} />
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="mt-0.5 rounded" checked={applyForm.consent} onChange={(e) => setApplyForm((f) => ({ ...f, consent: e.target.checked }))} />
                    <span className="text-sm text-muted-foreground">Concordo com o uso dos meus dados para fins de recrutamento e seleção *</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border/40 px-6 py-4 shrink-0">
              <Button variant="outline" onClick={() => setApplyOpen(false)}>Cancelar</Button>
              <Button disabled={sendingApply} onClick={() => void submitApply()}>
                {sendingApply ? "Enviando..." : "Enviar candidatura"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Profile Modal ── */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-4xl rounded-2xl border border-border/40 bg-card shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-border/40 px-6 py-4 shrink-0">
              <div>
                <h2 className="text-lg font-semibold">Meu Perfil</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Atualize seus dados de candidato.</p>
              </div>
              <button type="button" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 transition-colors" onClick={() => setProfileOpen(false)}>
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {authRequired ? (
              <div className="px-6 py-8 text-center">
                <p className="text-muted-foreground text-sm mb-4">Você precisa autenticar para editar o perfil.</p>
                <Button asChild><Link href={`/app/PortalVagas/Acesso${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`}>Ir para Acesso</Link></Button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-1 border-b border-border/40 px-6 py-3 shrink-0 overflow-x-auto">
                  {([["perfil", "Perfil"], ["skills", "Competências"], ["education", "Formação"], ["preferences", "Preferências"], ["lgpd", "LGPD"], ["notifications", "Notificações"], ["documents", "Documentos"], ["experience", "Experiência"], ["references", "Referências"], ["accessibility", "Acessibilidade"], ["apps", "Candidaturas"], ["tests", "Testes RH"]] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${profileSection === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                      onClick={() => setProfileSection(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="overflow-y-auto flex-1 px-6 py-5">
                  {profileSection === "perfil" && (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className={labelCls}>Nome</label>
                          <input className={inputCls} value={profile.nome || ""} onChange={(e) => setProfile((p) => ({ ...p, nome: e.target.value }))} />
                        </div>
                        <div>
                          <label className={labelCls}>E-mail</label>
                          <input className={inputCls} value={profile.email || ""} readOnly />
                        </div>
                        <div>
                          <label className={labelCls}>Telefone</label>
                          <input className={inputCls} value={profile.fone || ""} onChange={(e) => setProfile((p) => ({ ...p, fone: e.target.value }))} />
                        </div>
                        <div>
                          <label className={labelCls}>Estado</label>
                          <select className={selectCls} value={profile.uf || ""} onChange={(e) => setProfile((p) => ({ ...p, uf: e.target.value.toUpperCase() }))}>
                            <option value="">Selecione</option>
                            {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Cidade</label>
                          <input className={inputCls} value={profile.cidade || ""} onChange={(e) => setProfile((p) => ({ ...p, cidade: e.target.value }))} />
                        </div>
                        <div>
                          <label className={labelCls}>LinkedIn</label>
                          <input className={inputCls} value={profile.linkedinUrl || ""} onChange={(e) => setProfile((p) => ({ ...p, linkedinUrl: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="rounded" checked={profile.trabalhandoAtualmente === true} onChange={(e) => setProfile((p) => ({ ...p, trabalhandoAtualmente: e.target.checked }))} />
                            <span className="text-sm text-muted-foreground">Está trabalhando atualmente</span>
                          </label>
                        </div>
                        <div className="sm:col-span-2">
                          <label className={labelCls}>Resumo profissional</label>
                          <textarea className={`${inputCls} resize-none`} rows={4} value={profile.resumoProfissional || ""} onChange={(e) => setProfile((p) => ({ ...p, resumoProfissional: e.target.value }))} />
                        </div>
                        <div>
                          <label className={labelCls}>Avatar</label>
                          <input className={inputCls} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void upload("avatar", e.target.files[0])} />
                        </div>
                        <div>
                          <label className={labelCls}>Currículo</label>
                          <input className={inputCls} type="file" accept=".pdf,.doc,.docx" onChange={(e) => e.target.files?.[0] && void upload("curriculo", e.target.files[0])} />
                        </div>
                      </div>
                      <div className="mt-5 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setProfileOpen(false)}>Cancelar</Button>
                        <Button disabled={savingProfile} onClick={() => void saveProfile()}>
                          {savingProfile ? "Salvando..." : "Salvar perfil"}
                        </Button>
                      </div>
                    </>
                  )}
                  {profileSection === "skills" && <PortalVagasSkillsSection />}
                  {profileSection === "education" && <PortalVagasEducationSection />}
                  {profileSection === "preferences" && <PortalVagasPreferencesSection />}
                  {profileSection === "lgpd" && <PortalVagasLgpdSection />}
                  {profileSection === "notifications" && <PortalVagasNotificationsSection />}
                  {profileSection === "documents" && <PortalVagasDocumentsSection />}
                  {profileSection === "experience" && <PortalVagasExperienceSection />}
                  {profileSection === "references" && <PortalVagasReferencesSection />}
                  {profileSection === "accessibility" && <PortalVagasAccessibilitySection />}
                  {profileSection === "apps" && <PortalVagasAppsSection />}
                  {profileSection === "tests" && <PortalVagasTestsSection />}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <NewJobModal
        open={newJobOpen}
        onClose={() => setNewJobOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      {/* ── Back to top / Filtros mobile ── */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2 items-end">
        {showBackToTop && (
          <button
            type="button"
            className="rounded-xl border bg-card shadow-lg px-4 py-2 text-sm font-medium hover:bg-muted/60 transition-colors"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            ↑ Topo
          </button>
        )}
        <button
          type="button"
          className="rounded-xl bg-primary text-primary-foreground shadow-lg px-4 py-2 text-sm font-medium hover:opacity-90 md:hidden"
          onClick={() => setFiltersDrawerOpen(true)}
        >
          Filtros
        </button>
      </div>

      {filtersDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setFiltersDrawerOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-full bg-card shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
              <h3 className="font-semibold">Filtros</h3>
              <button type="button" className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50" onClick={() => setFiltersDrawerOpen(false)}>
                <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div><label className={labelCls}>Busca</label><input className={inputCls} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Cargo, área..." /></div>
              <div><label className={labelCls}>Localização</label><input className={inputCls} value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }} /></div>
              <div><label className={labelCls}>Formato</label><select className={selectCls} value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }}><option value="">Qualquer</option><option value="Remoto">Remoto</option><option value="Hibrido">Híbrido</option><option value="Presencial">Presencial</option></select></div>
              <div><label className={labelCls}>Contratação</label><select className={selectCls} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}><option value="">Qualquer</option><option value="CLT">CLT</option><option value="PJ">PJ</option><option value="Estágio">Estágio</option></select></div>
              <div><label className={labelCls}>Salário mínimo</label><input className={inputCls} type="number" placeholder="Ex: 5000" value={minSalary} onChange={(e) => { setMinSalary(e.target.value); setPage(1); }} /></div>
            </div>
            <div className="border-t border-border/40 px-5 py-4">
              <Button className="w-full" onClick={() => setFiltersDrawerOpen(false)}>Aplicar filtros</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

                <label className="mini-title mb-1 block">LinkedIn</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={applyForm.linkedin} onChange={(e) => setApplyForm((f) => ({ ...f, linkedin: e.target.value }))} />
              </div>
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Portfólio</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={applyForm.portfolio} onChange={(e) => setApplyForm((f) => ({ ...f, portfolio: e.target.value }))} />
              </div>
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Cargo atual</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={applyForm.currentRole} onChange={(e) => setApplyForm((f) => ({ ...f, currentRole: e.target.value }))} />
              </div>
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Anos de experiência</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={applyForm.experienceYears} onChange={(e) => setApplyForm((f) => ({ ...f, experienceYears: e.target.value }))} />
              </div>
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Pretensão salarial</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={applyForm.salaryExpectation} onChange={(e) => setApplyForm((f) => ({ ...f, salaryExpectation: e.target.value }))} />
              </div>
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Disponibilidade para iniciar</label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={applyForm.availability} onChange={(e) => setApplyForm((f) => ({ ...f, availability: e.target.value }))}>
                  <option value="">Selecione</option>
                  <option value="Imediata">Imediata</option>
                  <option value="Até 15 dias">Até 15 dias</option>
                  <option value="Até 30 dias">Até 30 dias</option>
                  <option value="Mais de 30 dias">Mais de 30 dias</option>
                </select>
              </div>
              <div className="md:col-span-12">
                <label className="mini-title mb-1 block">Resumo profissional</label>
                <textarea className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" rows={3} value={applyForm.highlights} onChange={(e) => setApplyForm((f) => ({ ...f, highlights: e.target.value }))} />
              </div>
              <div className="md:col-span-12">
                <label className="mini-title mb-1 block">Informações adicionais</label>
                <textarea className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" rows={3} value={applyForm.recruiterNotes} onChange={(e) => setApplyForm((f) => ({ ...f, recruiterNotes: e.target.value }))} />
              </div>
              {/* ── Campos personalizados dinâmicos ── */}
              {camposPersonalizados.length > 0 && (
                <div className="md:col-span-12 border-t border-border/40 pt-3 mt-1">
                  <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Informações adicionais da vaga</div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                    {camposPersonalizados.map((campo) => {
                      const val = camposValues[campo.id] ?? "";
                      const readOnly = campo.isReadOnly;
                      if (campo.tipo === 2) {
                        // Checkbox
                        return (
                          <div key={campo.id} className="md:col-span-6 flex items-center gap-2">
                            <input type="checkbox" disabled={readOnly} checked={val === "true"} onChange={(e) => setCamposValues((v) => ({ ...v, [campo.id]: e.target.checked ? "true" : "false" }))} />
                            <label className="text-sm">{campo.label}{campo.obrigatorio ? " *" : ""}</label>
                          </div>
                        );
                      }
                      if (campo.tipo === 1 && campo.opcoes) {
                        // Select
                        const opts = campo.opcoes.split(";").map((o) => o.trim()).filter(Boolean);
                        return (
                          <div key={campo.id} className="md:col-span-6">
                            <label className="mini-title mb-1 block">{campo.label}{campo.obrigatorio ? " *" : ""}</label>
                            <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" disabled={readOnly} value={val} onChange={(e) => setCamposValues((v) => ({ ...v, [campo.id]: e.target.value }))}>
                              <option value="">Selecione</option>
                              {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          </div>
                        );
                      }
                      if (campo.tipo === 3) {
                        // Numero
                        return (
                          <div key={campo.id} className="md:col-span-6">
                            <label className="mini-title mb-1 block">{campo.label}{campo.obrigatorio ? " *" : ""}</label>
                            <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="number" readOnly={readOnly} value={val} onChange={(e) => setCamposValues((v) => ({ ...v, [campo.id]: e.target.value }))} />
                          </div>
                        );
                      }
                      // Texto (default)
                      return (
                        <div key={campo.id} className="md:col-span-6">
                          <label className="mini-title mb-1 block">{campo.label}{campo.obrigatorio ? " *" : ""}</label>
                          <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" readOnly={readOnly} value={val} onChange={(e) => setCamposValues((v) => ({ ...v, [campo.id]: e.target.value }))} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="md:col-span-6">
                <label className="mini-title mb-1 block">Currículo (opcional)</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="file" accept=".pdf,.doc,.docx" onChange={(e) => onApplyFileChange(e.target.files?.[0] || null)} />
              </div>
              <div className="md:col-span-6 flex items-end">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={applyForm.consent} onChange={(e) => setApplyForm((f) => ({ ...f, consent: e.target.checked }))} />
                  <span>Concordo com o uso dos meus dados para recrutamento</span>
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setApplyOpen(false)}>Cancelar</Button>
              <Button size="sm" disabled={sendingApply} onClick={() => void submitApply()}>
                {sendingApply ? "Enviando..." : "Enviar candidatura"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {profileOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-4xl max-h-[90vh] flex flex-col p-4">
            <div className="flex items-start justify-between gap-2 shrink-0">
              <div>
                <div className="text-lg font-extrabold">Meu perfil</div>
                <div className="text-sm text-muted-foreground">Atualize seus dados de candidato.</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setProfileOpen(false)}>Fechar</Button>
            </div>

            {authRequired ? (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                Você precisa autenticar no Portal de Vagas para editar o perfil.
                <div className="mt-2">
                  <Button size="sm" asChild><Link href={`/app/PortalVagas/Acesso${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`}>Ir para Acesso</Link></Button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap gap-1 overflow-x-auto pb-2 border-b border-border/60 shrink-0">
                  {(
                    [
                      ["perfil", "Perfil"],
                      ["skills", "Competências"],
                      ["education", "Formação"],
                      ["preferences", "Preferências"],
                      ["lgpd", "LGPD"],
                      ["notifications", "Notificações"],
                      ["documents", "Documentos"],
                      ["experience", "Experiência"],
                      ["references", "Referências"],
                      ["accessibility", "Acessibilidade"],
                      ["apps", "Candidaturas"],
                      ["tests", "Testes RH"],
                    ] as const
                  ).map(([key, label]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={profileSection === key ? "default" : "outline"}
                      onClick={() => setProfileSection(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="mt-3 overflow-y-auto flex-1 min-h-0">
                  {profileSection === "perfil" && (
                    <>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                        <div className="md:col-span-6">
                          <label className="mini-title mb-1 block">Nome</label>
                          <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={profile.nome || ""} onChange={(e) => setProfile((p) => ({ ...p, nome: e.target.value }))} />
                        </div>
                        <div className="md:col-span-6">
                          <label className="mini-title mb-1 block">E-mail</label>
                          <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={profile.email || ""} readOnly />
                        </div>
                        <div className="md:col-span-4">
                          <label className="mini-title mb-1 block">Telefone</label>
                          <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={profile.fone || ""} onChange={(e) => setProfile((p) => ({ ...p, fone: e.target.value }))} />
                        </div>
                        <div className="md:col-span-4">
                          <label className="mini-title mb-1 block">UF</label>
                          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={profile.uf || ""} onChange={(e) => setProfile((p) => ({ ...p, uf: e.target.value.toUpperCase() }))}>
                            <option value="">Selecione</option>
                            {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                          </select>
                        </div>
                        <div className="md:col-span-4">
                          <label className="mini-title mb-1 block">Cidade</label>
                          <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={profile.cidade || ""} onChange={(e) => setProfile((p) => ({ ...p, cidade: e.target.value }))} />
                        </div>
                        <div className="md:col-span-12">
                          <label className="mini-title mb-1 block">LinkedIn</label>
                          <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={profile.linkedinUrl || ""} onChange={(e) => setProfile((p) => ({ ...p, linkedinUrl: e.target.value }))} />
                        </div>
                        <div className="md:col-span-12">
                          <label className="inline-flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={profile.trabalhandoAtualmente === true}
                              onChange={(e) => setProfile((p) => ({ ...p, trabalhandoAtualmente: e.target.checked }))}
                            />
                            <span className="text-sm">Está trabalhando atualmente</span>
                          </label>
                        </div>
                        <div className="md:col-span-12">
                          <label className="mini-title mb-1 block">Resumo profissional</label>
                          <textarea className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" rows={4} value={profile.resumoProfissional || ""} onChange={(e) => setProfile((p) => ({ ...p, resumoProfissional: e.target.value }))} />
                        </div>
                        <div className="md:col-span-6">
                          <label className="mini-title mb-1 block">Avatar</label>
                          <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void upload("avatar", e.target.files[0])} />
                        </div>
                        <div className="md:col-span-6">
                          <label className="mini-title mb-1 block">Currículo</label>
                          <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" type="file" accept=".pdf,.doc,.docx" onChange={(e) => e.target.files?.[0] && void upload("curriculo", e.target.files[0])} />
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setProfileOpen(false)}>Cancelar</Button>
                        <Button size="sm" disabled={savingProfile} onClick={() => void saveProfile()}>
                          {savingProfile ? "Salvando..." : "Salvar perfil"}
                        </Button>
                      </div>
                    </>
                  )}
                  {profileSection === "skills" && <PortalVagasSkillsSection />}
                  {profileSection === "education" && <PortalVagasEducationSection />}
                  {profileSection === "preferences" && <PortalVagasPreferencesSection />}
                  {profileSection === "lgpd" && <PortalVagasLgpdSection />}
                  {profileSection === "notifications" && <PortalVagasNotificationsSection />}
                  {profileSection === "documents" && <PortalVagasDocumentsSection />}
                  {profileSection === "experience" && <PortalVagasExperienceSection />}
                  {profileSection === "references" && <PortalVagasReferencesSection />}
                  {profileSection === "accessibility" && <PortalVagasAccessibilitySection />}
                  {profileSection === "apps" && <PortalVagasAppsSection />}
                  {profileSection === "tests" && <PortalVagasTestsSection />}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <NewJobModal
        open={newJobOpen}
        onClose={() => setNewJobOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2 items-end">
        {showBackToTop ? (
          <button
            type="button"
            className="rounded-lg border bg-white shadow-md px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Voltar ao topo"
          >
            Topo
          </button>
        ) : null}
        <button
          type="button"
          className="rounded-lg bg-[var(--lt-primary)] text-white shadow-md px-3 py-2 text-sm hover:opacity-90 md:hidden"
          onClick={() => setFiltersDrawerOpen(true)}
          aria-label="Abrir filtros"
        >
          Filtros
        </button>
      </div>

      {filtersDrawerOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFiltersDrawerOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-full bg-white shadow-xl p-4 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Filtros</h3>
              <Button variant="outline" size="sm" onClick={() => setFiltersDrawerOpen(false)}>Fechar</Button>
            </div>
            <div className="space-y-3">
              <div><label className="text-xs text-muted-foreground">Busca</label><input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm mt-1" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Buscar..." /></div>
              <div><label className="text-xs text-muted-foreground">Local</label><input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm mt-1" value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }} /></div>
              <div><label className="text-xs text-muted-foreground">Modelo</label><select className="h-9 rounded-md border border-input bg-background px-3 text-sm mt-1" value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }}><option value="">Qualquer</option><option value="Remoto">Remoto</option><option value="Hibrido">Híbrido</option><option value="Presencial">Presencial</option></select></div>
              <div><label className="text-xs text-muted-foreground">Sal. mín. (R$)</label><input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm mt-1" type="number" value={minSalary} onChange={(e) => { setMinSalary(e.target.value); setPage(1); }} /></div>
            </div>
            <Button size="sm" className="w-full mt-4" onClick={() => setFiltersDrawerOpen(false)}>Aplicar</Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

