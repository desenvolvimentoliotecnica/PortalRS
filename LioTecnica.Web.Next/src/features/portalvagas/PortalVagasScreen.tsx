"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
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

export default function PortalVagasScreen() {
  const searchParams = useSearchParams();
  const tenantId = (searchParams.get("tenantId") || searchParams.get("tenant") || "").trim();

  const [tab, setTab] = useState<Tab>("vagas");
  const [jobs, setJobs] = useState<PagedJobs>({ items: [], totalItems: 0, totalPages: 1, page: 1 });
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [location, setLocation] = useState("");
  const [mode, setMode] = useState("");
  const [type, setType] = useState("");
  const [level, setLevel] = useState("");
  const [area, setArea] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);

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

  const canQuery = tenantId.length > 0;

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
  }, [canQuery, query, tenantId]);

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
    setApplyOpen(true);
  }

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
    if (!applyForm.fullName || !applyForm.email || !applyForm.phone || !applyForm.currentRole || !applyForm.experienceYears || !applyForm.highlights) {
      toast.error("Preencha os campos obrigatórios.");
      return;
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
        company: selectedJob.empresaNome ?? "",
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
    try {
      const res = await apiFetch("/PortalVagas/Profile", { cache: "no-store" });
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
      });
    } catch {
      toast.error("Falha ao carregar perfil.");
    }
  }

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await apiFetch("/PortalVagas/Profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: profile.nome || "",
          fone: profile.fone || "",
          cidade: profile.cidade || "",
          uf: (profile.uf || "").toUpperCase(),
          linkedinUrl: profile.linkedinUrl || "",
          resumoProfissional: profile.resumoProfissional || "",
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
    const url = kind === "avatar" ? "/PortalVagas/Profile/Avatar" : "/PortalVagas/Profile/Curriculo";
    const fd = new FormData();
    fd.append("arquivo", file);
    try {
      const res = await apiFetch(url, { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      toast.success(kind === "avatar" ? "Foto atualizada." : "Currículo atualizado.");
    } catch {
      toast.error("Falha no upload.");
    }
  }

  return (
    <section className="space-y-4">
      <div className="card-soft p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold">Portal de Vagas</div>
            <div className="text-muted-foreground text-sm">
              Catálogo público, candidatura, perfil e agenda no Next.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" type="button" onClick={() => void openProfile()}>
              Meu perfil
            </button>
            <form method="post" action={`/PortalVagas/Logout${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`}>
              <button className="btn-ghost text-red-600" type="submit">
                Sair
              </button>
            </form>
          </div>
        </div>

        {!tenantId ? (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            Tenant não informado na URL. Use o link com <code>?tenantId=...</code> para habilitar catálogo/candidatura.
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button className={`btn-ghost ${tab === "vagas" ? "bg-[rgba(16,82,144,.12)]" : ""}`} onClick={() => setTab("vagas")} type="button">
            Vagas
          </button>
          <button className={`btn-ghost ${tab === "agenda" ? "bg-[rgba(16,82,144,.12)]" : ""}`} onClick={() => setTab("agenda")} type="button">
            Agenda
          </button>
          <Link className="btn-ghost" href={`/PortalVagas/Acesso${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`}>
            Acesso
          </Link>
        </div>
      </div>

      {tab === "vagas" ? (
        <div className="card-soft p-4 space-y-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
            <div className="md:col-span-4">
              <input className="form-control" placeholder="Buscar vaga..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            </div>
            <div className="md:col-span-2">
              <input className="form-control" placeholder="Local" value={location} onChange={(e) => { setLocation(e.target.value); setPage(1); }} />
            </div>
            <div className="md:col-span-2">
              <select className="form-select" value={mode} onChange={(e) => { setMode(e.target.value); setPage(1); }}>
                <option value="">Modelo</option>
                <option value="Remoto">Remoto</option>
                <option value="Hibrido">Híbrido</option>
                <option value="Presencial">Presencial</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <input className="form-control" placeholder="Área" value={area} onChange={(e) => { setArea(e.target.value); setPage(1); }} />
            </div>
            <div className="md:col-span-2">
              <select className="form-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="recent">Mais recentes</option>
                <option value="salaryDesc">Maior salário</option>
                <option value="companyAsc">Empresa A-Z</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
            <div className="md:col-span-3">
              <input className="form-control" placeholder="Tipo (CLT/PJ...)" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} />
            </div>
            <div className="md:col-span-3">
              <input className="form-control" placeholder="Senioridade" value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }} />
            </div>
            <div className="md:col-span-6 flex items-center justify-end text-sm text-muted-foreground">
              {loading ? "Carregando..." : `${jobs.totalItems} vaga(s) encontrada(s)`}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {jobs.items.map((job) => (
              <div key={job.id} className="rounded-xl border border-[rgba(16,82,144,.14)] bg-white/55 p-4">
                <div className="font-extrabold">{job.titulo}</div>
                <div className="text-sm text-muted-foreground mt-1">{job.empresaNome || "Empresa"}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="badge-soft">{job.modalidade || "—"}</span>
                  <span className="badge-soft">{job.tipoContratacao || "—"}</span>
                  <span className="badge-soft">{job.senioridade || "—"}</span>
                  <span className="badge-soft">{job.area || "—"}</span>
                </div>
                <div className="mt-2 text-sm">{job.cidade || "—"}{job.uf ? `, ${job.uf}` : ""}</div>
                <div className="mt-1 text-sm font-semibold">{money(job.salarioMinimo, job.salarioMaximo)}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {tags(job).map((t, i) => (
                    <span className="rounded-full border border-border/60 px-2 py-0.5 text-xs" key={`${job.id}-${i}`}>
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button className="btn-ghost px-3 py-2" type="button" onClick={() => setSelectedJob(job)}>
                    Detalhes
                  </button>
                  <button className="btn-brand px-3 py-2" type="button" onClick={() => openApply(job)}>
                    Candidatar-se
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!loading && jobs.items.length === 0 ? <div className="py-6 text-center text-muted-foreground">Nenhuma vaga encontrada.</div> : null}

          {jobs.totalPages > 1 ? (
            <div className="flex items-center justify-end gap-2">
              <button className="btn-ghost px-3 py-2" type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Anterior
              </button>
              <span className="text-sm text-muted-foreground">Página {jobs.page} de {jobs.totalPages}</span>
              <button className="btn-ghost px-3 py-2" type="button" disabled={page >= jobs.totalPages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "agenda" ? <PortalVagasAgendaScreen /> : null}

      {selectedJob ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-extrabold">{selectedJob.titulo}</div>
                <div className="text-sm text-muted-foreground">{selectedJob.empresaNome || "Empresa"}</div>
              </div>
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setSelectedJob(null)}>Fechar</button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <div><strong>Área:</strong> {selectedJob.area || "—"}</div>
              <div><strong>Local:</strong> {selectedJob.cidade || "—"}{selectedJob.uf ? `, ${selectedJob.uf}` : ""}</div>
              <div><strong>Modalidade:</strong> {selectedJob.modalidade || "—"}</div>
              <div><strong>Contrato:</strong> {selectedJob.tipoContratacao || "—"}</div>
              <div><strong>Senioridade:</strong> {selectedJob.senioridade || "—"}</div>
              <div><strong>Faixa:</strong> {money(selectedJob.salarioMinimo, selectedJob.salarioMaximo)}</div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" type="button" onClick={() => setSelectedJob(null)}>Fechar</button>
              <button className="btn-brand" type="button" onClick={() => openApply(selectedJob)}>Candidatar-se</button>
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
                <div className="text-sm text-muted-foreground">{selectedJob.titulo} - {selectedJob.empresaNome || "Empresa"}</div>
              </div>
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setApplyOpen(false)}>Fechar</button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
              {([
                ["Nome completo", "fullName"],
                ["E-mail", "email"],
                ["Telefone", "phone"],
                ["UF", "uf"],
                ["Cidade", "city"],
                ["LinkedIn", "linkedin"],
                ["Portfólio", "portfolio"],
                ["Cargo atual", "currentRole"],
                ["Anos de experiência", "experienceYears"],
                ["Pretensão salarial", "salaryExpectation"],
                ["Disponibilidade", "availability"],
              ] as Array<[string, ApplyFieldKey]>).map(([label, key]) => (
                <div className="md:col-span-4" key={key}>
                  <label className="mini-title mb-1 block">{label}</label>
                  <input
                    className="form-control"
                    value={applyForm[key]}
                    onChange={(e) => setApplyForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="md:col-span-12">
                <label className="mini-title mb-1 block">Resumo profissional</label>
                <textarea className="form-control" rows={3} value={applyForm.highlights} onChange={(e) => setApplyForm((f) => ({ ...f, highlights: e.target.value }))} />
              </div>
              <div className="md:col-span-12">
                <label className="mini-title mb-1 block">Informações adicionais</label>
                <textarea className="form-control" rows={3} value={applyForm.recruiterNotes} onChange={(e) => setApplyForm((f) => ({ ...f, recruiterNotes: e.target.value }))} />
              </div>
              <div className="md:col-span-6">
                <label className="mini-title mb-1 block">Currículo (opcional)</label>
                <input className="form-control" type="file" accept=".pdf,.doc,.docx" onChange={(e) => setApplyFile(e.target.files?.[0] || null)} />
              </div>
              <div className="md:col-span-6 flex items-end">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={applyForm.consent} onChange={(e) => setApplyForm((f) => ({ ...f, consent: e.target.checked }))} />
                  <span>Concordo com o uso dos meus dados para recrutamento</span>
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" type="button" onClick={() => setApplyOpen(false)}>Cancelar</button>
              <button className="btn-brand" type="button" disabled={sendingApply} onClick={() => void submitApply()}>
                {sendingApply ? "Enviando..." : "Enviar candidatura"}
              </button>
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
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setProfileOpen(false)}>Fechar</button>
            </div>

            {authRequired ? (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                Você precisa autenticar no Portal de Vagas para editar o perfil.
                <div className="mt-2">
                  <Link className="btn-brand" href={`/PortalVagas/Acesso${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`}>Ir para Acesso</Link>
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
                    <button
                      key={key}
                      className={`btn-ghost px-3 py-1.5 text-sm ${profileSection === key ? "bg-[rgba(16,82,144,.12)]" : ""}`}
                      type="button"
                      onClick={() => setProfileSection(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 overflow-y-auto flex-1 min-h-0">
                  {profileSection === "perfil" && (
                    <>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                        <div className="md:col-span-6">
                          <label className="mini-title mb-1 block">Nome</label>
                          <input className="form-control" value={profile.nome || ""} onChange={(e) => setProfile((p) => ({ ...p, nome: e.target.value }))} />
                        </div>
                        <div className="md:col-span-6">
                          <label className="mini-title mb-1 block">E-mail</label>
                          <input className="form-control" value={profile.email || ""} readOnly />
                        </div>
                        <div className="md:col-span-4">
                          <label className="mini-title mb-1 block">Telefone</label>
                          <input className="form-control" value={profile.fone || ""} onChange={(e) => setProfile((p) => ({ ...p, fone: e.target.value }))} />
                        </div>
                        <div className="md:col-span-4">
                          <label className="mini-title mb-1 block">Cidade</label>
                          <input className="form-control" value={profile.cidade || ""} onChange={(e) => setProfile((p) => ({ ...p, cidade: e.target.value }))} />
                        </div>
                        <div className="md:col-span-4">
                          <label className="mini-title mb-1 block">UF</label>
                          <input className="form-control" value={profile.uf || ""} onChange={(e) => setProfile((p) => ({ ...p, uf: e.target.value }))} />
                        </div>
                        <div className="md:col-span-12">
                          <label className="mini-title mb-1 block">LinkedIn</label>
                          <input className="form-control" value={profile.linkedinUrl || ""} onChange={(e) => setProfile((p) => ({ ...p, linkedinUrl: e.target.value }))} />
                        </div>
                        <div className="md:col-span-12">
                          <label className="mini-title mb-1 block">Resumo profissional</label>
                          <textarea className="form-control" rows={4} value={profile.resumoProfissional || ""} onChange={(e) => setProfile((p) => ({ ...p, resumoProfissional: e.target.value }))} />
                        </div>
                        <div className="md:col-span-6">
                          <label className="mini-title mb-1 block">Avatar</label>
                          <input className="form-control" type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void upload("avatar", e.target.files[0])} />
                        </div>
                        <div className="md:col-span-6">
                          <label className="mini-title mb-1 block">Currículo</label>
                          <input className="form-control" type="file" accept=".pdf,.doc,.docx" onChange={(e) => e.target.files?.[0] && void upload("curriculo", e.target.files[0])} />
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <button className="btn-ghost" type="button" onClick={() => setProfileOpen(false)}>Cancelar</button>
                        <button className="btn-brand" type="button" disabled={savingProfile} onClick={() => void saveProfile()}>
                          {savingProfile ? "Salvando..." : "Salvar perfil"}
                        </button>
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
    </section>
  );
}

