"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { clearPortalCandidateSession, getPortalCandidateSession, portalCandidateFetch } from "@/features/portalvagas/publicApi";
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
import { getSectionInfo, parseTagsResponsabilidades, buildSummary } from "@/features/portalvagas/jobsUtils";

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

  return (
    <section className="space-y-4 relative">
      <div className="rounded-xl bg-gradient-to-br from-[rgba(16,82,144,.08)] to-transparent p-6 mb-4">
        <h1 className="text-2xl font-extrabold">Transforme o Futuro da Alimentação</h1>
        <p className="text-muted-foreground mt-1">Ambiente inovador, tecnologia de ponta e paixão por qualidade.</p>
      </div>

      <div className="card-soft p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold">Portal de Vagas</div>
            <div className="text-muted-foreground text-sm">
              Catálogo público, candidatura, perfil e agenda no Next.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin ? (
              <Button size="sm" onClick={() => setNewJobOpen(true)}>
                Nova vaga
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void openProfile()}>
              Meu perfil
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (tenantId) clearPortalCandidateSession(tenantId);
                setAuthRequired(true);
                toast.success("Sessão encerrada neste navegador.");
              }}
            >
              Sair
            </Button>
          </div>
        </div>

        {!tenantId ? (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            Tenant não informado na URL. Use o link com <code>?tenantId=...</code> para habilitar catálogo/candidatura.
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant={tab === "vagas" ? "default" : "outline"} onClick={() => setTab("vagas")}>
            Vagas
          </Button>
          <Button size="sm" variant={tab === "agenda" ? "default" : "outline"} onClick={() => setTab("agenda")}>
            Agenda
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/app/PortalVagas/Acesso${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`}>
              Acesso
            </Link>
          </Button>
        </div>
      </div>

      {tab === "vagas" ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-white border border-[rgba(16,82,144,.1)] shadow-sm p-3 flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">🔍</span>
            <input
              className="flex-1 min-w-[200px] border-0 bg-transparent focus:outline-none focus:ring-0"
              placeholder="Buscar por cargo, empresa, tecnologia..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
            />
            <Button size="sm" onClick={() => setPage(1)}>
              Buscar
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setQ(""); setPage(1); }}>
              Limpar
            </Button>
          </div>

          <div className="card-soft p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                {loading ? "Carregando..." : `${jobs.totalItems} vaga(s) encontrada(s)`}
              </span>
              <div className="flex flex-wrap gap-2">
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm text-sm w-auto" value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }}>
                  <option value="">Local (qualquer)</option>
                  <option value="São Paulo, SP">São Paulo, SP</option>
                  <option value="Rio de Janeiro, RJ">Rio de Janeiro, RJ</option>
                  <option value="Belo Horizonte, MG">Belo Horizonte, MG</option>
                  <option value="Curitiba, PR">Curitiba, PR</option>
                  <option value="Remoto">Remoto (Brasil)</option>
                </select>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm text-sm w-auto" value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }}>
                  <option value="">Formato</option>
                  <option value="Remoto">Remoto</option>
                  <option value="Hibrido">Híbrido</option>
                  <option value="Presencial">Presencial</option>
                </select>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm text-sm w-auto" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
                  <option value="">Tipo</option>
                  <option value="CLT">CLT</option>
                  <option value="PJ">PJ</option>
                  <option value="Estágio">Estágio</option>
                </select>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm text-sm w-auto" value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}>
                  <option value="">Senioridade</option>
                  <option value="Júnior">Júnior</option>
                  <option value="Pleno">Pleno</option>
                  <option value="Sênior">Sênior</option>
                  <option value="Liderança">Liderança</option>
                </select>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm text-sm w-auto" value={area} onChange={(e) => { setArea(e.target.value); setPage(1); }}>
                  <option value="">Área</option>
                  <option value="Engenharia">Engenharia</option>
                  <option value="Dados">Dados</option>
                  <option value="Produto">Produto</option>
                  <option value="Design">Design</option>
                  <option value="Segurança">Segurança</option>
                  <option value="Operações">Operações</option>
                </select>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm text-sm w-24" placeholder="Sal. mín." type="number" min={0} step={500} value={minSalary} onChange={(e) => { setMinSalary(e.target.value); setPage(1); }} />
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm text-sm w-auto" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="recent">Mais recentes</option>
                  <option value="salaryDesc">Maior salário</option>
                  <option value="companyAsc">Empresa A-Z</option>
                </select>
              </div>
            </div>

            {!loading && jobs.items.length === 0 ? (
              <div className="py-12 text-center">
                <h3 className="font-semibold mb-2">Nenhuma vaga encontrada</h3>
                <p className="text-muted-foreground text-sm mb-3">Tente remover alguns filtros ou refinar o texto de busca.</p>
                <Button variant="outline" size="sm" onClick={() => { setQ(""); setLocation(""); setMode(""); setType(""); setLevel(""); setArea(""); setMinSalary(""); setPage(1); }}>
                  Limpar filtros
                </Button>
              </div>
            ) : (
              <>
                {(() => {
                  const groups = new Map<string, JobItem[]>();
                  const areaFallback = "Geral";
                  jobs.items.forEach((job) => {
                    const key = (job.area || areaFallback).toString();
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key)!.push(job);
                  });
                  let offset = 0;
                  return Array.from(groups.entries()).map(([areaKey, areaJobs]) => {
                    const info = getSectionInfo(areaKey);
                    const section = (
                      <section key={areaKey} className="mb-8">
                        <div
                          className="rounded-xl mb-4 p-6 text-white flex flex-col justify-end min-h-[120px] bg-cover bg-center relative overflow-hidden"
                          style={{ backgroundImage: `url('${info.image}')` }}
                        >
                          <div className="absolute inset-0 bg-black/40" />
                          <div className="relative z-10">
                            <h2 className="text-xl font-bold">{info.title}</h2>
                            <span className="text-sm opacity-90">{areaJobs.length} vagas</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {areaJobs.map((job, idx) => (
                            <JobCard
                              key={job.id}
                              job={job}
                              index={offset + idx}
                              onDetails={() => setSelectedJob(job)}
                              onApply={() => openApply(job)}
                            />
                          ))}
                        </div>
                      </section>
                    );
                    offset += areaJobs.length;
                    return section;
                  });
                })()}

                {jobs.totalPages > 1 ? (
                  <div className="flex items-center justify-end gap-2 pt-4">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">Página {jobs.page} de {jobs.totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= jobs.totalPages} onClick={() => setPage((p) => p + 1)}>
                      Próxima
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      {tab === "agenda" ? <PortalVagasAgendaScreen /> : null}

      {selectedJob ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-2xl p-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-extrabold">{selectedJob.titulo}</div>
                <div className="text-sm text-muted-foreground">{selectedJob.empresaNome || selectedJob.tenantName || "Empresa"}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedJob(null)}>Fechar</Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{buildSummary(selectedJob)}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags(selectedJob).map((t, i) => (
                <span key={`modal-${selectedJob.id}-${i}`} className="rounded-full border border-border/60 px-2 py-0.5 text-xs bg-slate-50">
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <div><strong>Área:</strong> {selectedJob.area || "—"}</div>
              <div><strong>Local:</strong> {selectedJob.cidade || "—"}{selectedJob.uf ? `, ${selectedJob.uf}` : ""}</div>
              <div><strong>Modalidade:</strong> {selectedJob.modalidade || "—"}</div>
              <div><strong>Contrato:</strong> {selectedJob.tipoContratacao || "—"}</div>
              <div><strong>Senioridade:</strong> {selectedJob.senioridade || "—"}</div>
              <div><strong>Faixa:</strong> {money(selectedJob.salarioMinimo, selectedJob.salarioMaximo)}</div>
            </div>
            {parseTagsResponsabilidades(selectedJob.tagsResponsabilidadesRaw).length > 0 ? (
              <div className="mt-4">
                <strong className="text-sm">Responsabilidades</strong>
                <ul className="mt-1 list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {parseTagsResponsabilidades(selectedJob.tagsResponsabilidadesRaw).map((r, i) => (
                    <li key={`resp-${selectedJob.id}-${i}`}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}#${selectedJob.id}` : `#${selectedJob.id}`;
                  void navigator.clipboard.writeText(url);
                  toast.success("Link copiado para a área de transferência.");
                }}
              >
                Copiar link interno
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedJob(null)}>Fechar</Button>
                <Button size="sm" onClick={() => openApply(selectedJob)}>Candidatar-se</Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {applyOpen && selectedJob ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-3xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-extrabold">Enviar candidatura</div>
                <div className="text-sm text-muted-foreground">{selectedJob.titulo} - {selectedJob.empresaNome || selectedJob.tenantName || "Empresa"}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setApplyOpen(false)}>Fechar</Button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Nome completo</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={applyForm.fullName} onChange={(e) => setApplyForm((f) => ({ ...f, fullName: e.target.value }))} />
              </div>
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">E-mail</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={applyForm.email} onChange={(e) => setApplyForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Telefone</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={applyForm.phone} onChange={(e) => setApplyForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">UF</label>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={applyForm.uf} onChange={(e) => setApplyForm((f) => ({ ...f, uf: e.target.value.toUpperCase() }))}>
                  <option value="">Selecione</option>
                  {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Cidade</label>
                <input className="form-input rounded-md border border-input bg-background px-3 py-1.5 text-sm" value={applyForm.city} onChange={(e) => setApplyForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="md:col-span-4">
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

