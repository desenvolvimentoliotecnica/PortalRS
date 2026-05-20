"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { getTenantId } from "@/lib/session";
import { getPortalCandidateSession, portalCandidateFetch } from "@/features/portalvagas/publicApi";
import PortalVagasAgendaScreen from "@/features/portalvagas/agenda/PortalVagasAgendaScreen";
import {
  PortalVagasAccessibilitySection,
  PortalVagasDocumentsSection,
  PortalVagasEducationSection,
  PortalVagasExperienceSection,
  PortalVagasLgpdSection,
  PortalVagasNotificationsSection,
  PortalVagasPreferencesSection,
  PortalVagasReferencesSection,
  PortalVagasSkillsSection,
  PortalVagasTestsSection,
} from "@/features/portalvagas/sections";

type WorkspaceSection =
  | "overview"
  | "perfil"
  | "skills"
  | "education"
  | "experience"
  | "preferences"
  | "agenda"
  | "documents"
  | "references"
  | "lgpd"
  | "notifications"
  | "accessibility"
  | "tests";

type PortalProfile = {
  id: string;
  nome: string;
  email: string;
  fone?: string | null;
  celular?: string | null;
  cidade?: string | null;
  uf?: string | null;
  linkedinUrl?: string | null;
  resumoProfissional?: string | null;
  avatarUrl?: string | null;
  curriculo?: { id: string; nomeArquivo: string; createdAtUtc: string } | null;
  trabalhandoAtualmente?: boolean | null;
};

type PortalCompletion = {
  sections: Record<string, number>;
  overall: number;
  warnings?: string[];
  evidence?: Record<string, string>;
  suggestions?: { section: string; text: string; impact: string }[];
};

type PortalMatchItem = {
  vagaId: string;
  score: number;
  title?: string | null;
  area?: string | null;
  city?: string | null;
  uf?: string | null;
  mode?: string | null;
  level?: string | null;
  reason?: string | null;
};

type PortalInternalNotificationsSummary = {
  pendentes?: number;
};

const UF_LIST = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];

const SECTIONS: Array<[WorkspaceSection, string]> = [
  ["overview", "Resumo"],
  ["perfil", "Perfil"],
  ["skills", "Competencias"],
  ["education", "Formacao"],
  ["experience", "Experiencia"],
  ["preferences", "Preferencias"],
  ["agenda", "Agenda"],
  ["documents", "Documentos"],
  ["references", "Referencias"],
  ["lgpd", "LGPD"],
  ["notifications", "Notificacoes"],
  ["accessibility", "Acessibilidade"],
  ["tests", "Testes RH"],
];

export default function PortalVagasCandidateWorkspace() {
  const searchParams = useSearchParams();
  const tenantId = (
    searchParams.get("tenantId") ||
    searchParams.get("tenant") ||
    getTenantId() ||
    ""
  ).trim();

  const session = useMemo(() => getPortalCandidateSession(tenantId), [tenantId]);
  const [section, setSection] = useState<WorkspaceSection>("overview");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [parsingResume, setParsingResume] = useState(false);
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [completion, setCompletion] = useState<PortalCompletion | null>(null);
  const [matches, setMatches] = useState<PortalMatchItem[]>([]);
  const [notificationPendingCount, setNotificationPendingCount] = useState(0);

  const accessHref = `/app/PortalVagas/Acesso?tenantId=${encodeURIComponent(tenantId)}`;
  const jobsHref = `/app/PortalVagas?tenantId=${encodeURIComponent(tenantId)}`;

  useEffect(() => {
    if (!tenantId || !session?.id) {
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    Promise.all([
      portalCandidateFetch(tenantId, "", { cache: "no-store" }),
      portalCandidateFetch(tenantId, "/profile-completion", { cache: "no-store" }),
      portalCandidateFetch(tenantId, "/job-matches", { cache: "no-store" }),
      portalCandidateFetch(tenantId, "/portal-notifications", { cache: "no-store" }),
    ])
      .then(async ([profileRes, completionRes, matchesRes, notificationsRes]) => {
        if (!alive) return;
        if (!profileRes.ok) throw new Error(`PROFILE_${profileRes.status}`);
        const profileData = (await profileRes.json().catch(() => null)) as PortalProfile | null;
        const completionData = completionRes.ok ? ((await completionRes.json().catch(() => null)) as PortalCompletion | null) : null;
        const matchesData = matchesRes.ok ? ((await matchesRes.json().catch(() => null)) as { matches?: PortalMatchItem[] } | null) : null;
        const notificationsData = notificationsRes.ok ? ((await notificationsRes.json().catch(() => null)) as PortalInternalNotificationsSummary | null) : null;
        setProfile(profileData);
        setCompletion(completionData);
        setMatches(Array.isArray(matchesData?.matches) ? matchesData.matches : []);
        setNotificationPendingCount(notificationsData?.pendentes ?? 0);
      })
      .catch(() => {
        if (alive) toast.error("Falha ao carregar workspace do candidato.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [tenantId, session?.id]);

  async function refreshSummary() {
    if (!tenantId || !session?.id) return;
    const [profileRes, completionRes, matchesRes] = await Promise.all([
      portalCandidateFetch(tenantId, "", { cache: "no-store" }),
      portalCandidateFetch(tenantId, "/profile-completion", { cache: "no-store" }),
      portalCandidateFetch(tenantId, "/job-matches", { cache: "no-store" }),
    ]);
    if (profileRes.ok) setProfile((await profileRes.json().catch(() => null)) as PortalProfile | null);
    if (completionRes.ok) setCompletion((await completionRes.json().catch(() => null)) as PortalCompletion | null);
    if (matchesRes.ok) {
      const data = (await matchesRes.json().catch(() => null)) as { matches?: PortalMatchItem[] } | null;
      setMatches(Array.isArray(data?.matches) ? data.matches : []);
    }
  }

  async function saveProfile() {
    if (!tenantId || !profile) return;
    setSavingProfile(true);
    try {
      const res = await portalCandidateFetch(tenantId, "", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: profile.nome || "",
          fone: profile.fone || "",
          celular: profile.celular || "",
          cidade: profile.cidade || "",
          uf: (profile.uf || "").toUpperCase(),
          linkedinUrl: profile.linkedinUrl || "",
          resumoProfissional: profile.resumoProfissional || "",
          trabalhandoAtualmente: profile.trabalhandoAtualmente ?? null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      setProfile((await res.json().catch(() => profile)) as PortalProfile);
      await refreshSummary();
      toast.success("Perfil salvo.");
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
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      await refreshSummary();
      toast.success(kind === "avatar" ? "Foto atualizada." : "Curriculo atualizado.");
    } catch {
      toast.error("Falha no upload.");
    }
  }

  async function parseResume(file: File) {
    if (!tenantId) return;
    setParsingResume(true);
    const fd = new FormData();
    fd.append("arquivo", file);
    try {
      const res = await portalCandidateFetch(tenantId, "/parse-resume", { method: "POST", body: fd },);
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      await refreshSummary();
      toast.success("Curriculo enviado e analisado.");
    } catch {
      toast.error("Falha ao analisar curriculo. Use PDF valido.");
    } finally {
      setParsingResume(false);
    }
  }

  async function downloadResume(kind: "html" | "pdf") {
    if (!tenantId) return;
    try {
      const res = await portalCandidateFetch(tenantId, kind === "html" ? "/resume-html" : "/resume-pdf", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      const data = await res.json();
      if (kind === "html") {
        const blob = new Blob([String(data.html || "")], { type: "text/html;charset=utf-8" });
        downloadBlob(blob, data.fileName || "curriculo.html");
      } else {
        const bytes = Uint8Array.from(atob(String(data.base64 || "")), (char) => char.charCodeAt(0));
        const blob = new Blob([bytes], { type: data.contentType || "application/pdf" });
        downloadBlob(blob, data.fileName || "curriculo.pdf");
      }
    } catch {
      toast.error("Falha ao exportar curriculo.");
    }
  }

  if (!tenantId) {
    return <WorkspaceMessage title="Acesso invalido" description="Use o link do portal enviado pela empresa." />;
  }

  if (!session?.id) {
    return (
      <WorkspaceMessage
        title="Entre para acessar seu workspace"
        description="Faca login ou crie sua conta para editar perfil, acompanhar matches e exportar curriculo."
        action={<Link href={accessHref} className="rounded-lg bg-[#105290] px-4 py-2 text-sm font-semibold text-white">Entrar / Criar conta</Link>}
      />
    );
  }

  if (loading) {
    return <WorkspaceMessage title="Preparando seu workspace..." description="Carregando perfil, conclusao e vagas sugeridas." />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-border/40 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#105290]">Portal de Vagas</p>
            <h1 className="text-xl font-bold text-slate-950">Workspace do candidato</h1>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href={jobsHref} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-muted/50">
              Ver vagas
            </Link>
            <button type="button" onClick={() => void refreshSummary()} className="rounded-lg bg-[#105290] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0d3f72]">
              Atualizar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-2xl border border-border/40 bg-white p-3 shadow-sm">
          <div className="mb-3 rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-950">{profile?.nome || session.nome || "Candidato"}</p>
            <p className="text-xs text-muted-foreground">{profile?.email || session.email}</p>
          </div>
          <nav className="flex flex-col gap-1">
            {SECTIONS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSection(key)}
                className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${section === key ? "bg-[#105290] text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                {label}
                {key === "notifications" && notificationPendingCount > 0 ? ` (${notificationPendingCount})` : ""}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          {section === "overview" && <Overview tenantId={tenantId} completion={completion} matches={matches} onDownload={downloadResume} />}
          {section === "perfil" && profile && (
            <ProfileEditor
              profile={profile}
              saving={savingProfile}
              parsingResume={parsingResume}
              setProfile={setProfile}
              onSave={saveProfile}
              onUpload={upload}
              onParseResume={parseResume}
              onDownload={downloadResume}
            />
          )}
          {section === "skills" && <PortalVagasSkillsSection />}
          {section === "education" && <PortalVagasEducationSection />}
          {section === "experience" && <PortalVagasExperienceSection />}
          {section === "preferences" && <PortalVagasPreferencesSection />}
          {section === "agenda" && <PortalVagasAgendaScreen />}
          {section === "documents" && <PortalVagasDocumentsSection />}
          {section === "references" && <PortalVagasReferencesSection />}
          {section === "lgpd" && <PortalVagasLgpdSection />}
          {section === "notifications" && (
            <PortalVagasNotificationsSection
              tenantId={tenantId}
              onOpenProfile={() => setSection("perfil")}
              onInternalCountChange={setNotificationPendingCount}
            />
          )}
          {section === "accessibility" && <PortalVagasAccessibilitySection />}
          {section === "tests" && <PortalVagasTestsSection />}
        </section>
      </main>
    </div>
  );
}

function Overview({ tenantId, completion, matches, onDownload }: { tenantId: string; completion: PortalCompletion | null; matches: PortalMatchItem[]; onDownload: (kind: "html" | "pdf") => Promise<void> }) {
  const cards = [
    ["Perfil", completion?.sections?.perfil ?? 0],
    ["Competencias", completion?.sections?.comp ?? 0],
    ["Formacao", completion?.sections?.formacao ?? 0],
    ["Experiencia", completion?.sections?.exp ?? 0],
    ["LGPD", completion?.sections?.lgpd ?? 0],
    ["Agenda", completion?.sections?.agenda ?? 0],
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/40 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Conclusao do perfil</p>
            <h2 className="mt-1 text-4xl font-black text-[#105290]">{completion?.overall ?? 0}%</h2>
          </div>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => void onDownload("html")} className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50">HTML</button>
            <button type="button" onClick={() => void onDownload("pdf")} className="rounded-lg bg-[#105290] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0d3f72]">PDF</button>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border/40 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{label}</span>
                <span className="font-bold text-[#105290]">{value}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200">
                <div className="h-2 rounded-full bg-[#105290]" style={{ width: `${Math.min(100, Number(value))}%` }} />
              </div>
            </div>
          ))}
        </div>
        {(completion?.suggestions?.length ?? 0) > 0 && (
          <div className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Proximos passos sugeridos</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {completion?.suggestions?.map((item, index) => <li key={`${item.section}-${index}`}>{item.text}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/40 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Vagas sugeridas</p>
            <h2 className="text-lg font-bold text-slate-950">{matches.length} oportunidade(s)</h2>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {matches.map((match) => (
            <Link key={match.vagaId} href={`/app/PortalVagas?tenantId=${encodeURIComponent(tenantId)}&vagaId=${encodeURIComponent(match.vagaId)}`} className="rounded-xl border border-border/40 p-4 hover:border-[#105290]/50 hover:bg-slate-50">
              <div className="flex items-start gap-3">
                <span className="rounded-full bg-[#105290]/10 px-2 py-1 text-xs font-bold text-[#105290]">{match.score}%</span>
                <div>
                  <p className="font-semibold text-slate-950">{match.title || "Vaga disponivel"}</p>
                  <p className="text-xs text-muted-foreground">{[match.area, match.city, match.uf, match.mode, match.level].filter(Boolean).join(" | ")}</p>
                  {match.reason && <p className="mt-2 text-sm text-slate-600">{match.reason}</p>}
                </div>
              </div>
            </Link>
          ))}
          {matches.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma vaga sugerida ainda. Complete o perfil para melhorar o matching.</p>}
        </div>
      </div>
    </div>
  );
}

function ProfileEditor(props: {
  profile: PortalProfile;
  saving: boolean;
  parsingResume: boolean;
  setProfile: (profile: PortalProfile) => void;
  onSave: () => Promise<void>;
  onUpload: (kind: "avatar" | "curriculo", file: File) => Promise<void>;
  onParseResume: (file: File) => Promise<void>;
  onDownload: (kind: "html" | "pdf") => Promise<void>;
}) {
  const { profile, saving, parsingResume, setProfile, onSave, onUpload, onParseResume, onDownload } = props;
  const inp = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#105290]/20";
  const lbl = "mb-1 block text-xs font-medium text-muted-foreground";

  return (
    <div className="rounded-2xl border border-border/40 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Dados do perfil</h2>
          <p className="text-sm text-muted-foreground">Essas informacoes alimentam candidatura, matching e curriculo exportado.</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => void onDownload("html")} className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50">Exportar HTML</button>
          <button type="button" onClick={() => void onDownload("pdf")} className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50">Exportar PDF</button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={lbl}>Nome</label><input className={inp} value={profile.nome || ""} onChange={(e) => setProfile({ ...profile, nome: e.target.value })} /></div>
        <div><label className={lbl}>E-mail</label><input className={inp} value={profile.email || ""} readOnly /></div>
        <div><label className={lbl}>Telefone</label><input className={inp} value={profile.fone || ""} onChange={(e) => setProfile({ ...profile, fone: e.target.value })} /></div>
        <div>
          <label className={lbl}>Celular</label>
          <div className="flex gap-2">
            <input className={inp} value={profile.celular || ""} onChange={(e) => setProfile({ ...profile, celular: e.target.value })} />
            <button
              type="button"
              disabled={!profile.fone}
              onClick={() => setProfile({ ...profile, celular: profile.fone || "" })}
              className="whitespace-nowrap rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50 disabled:opacity-50"
            >
              Copiar telefone
            </button>
          </div>
        </div>
        <div><label className={lbl}>UF</label><select className={inp} value={profile.uf || ""} onChange={(e) => setProfile({ ...profile, uf: e.target.value.toUpperCase() })}><option value="">Selecione</option>{UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select></div>
        <div><label className={lbl}>Cidade</label><input className={inp} value={profile.cidade || ""} onChange={(e) => setProfile({ ...profile, cidade: e.target.value })} /></div>
        <div><label className={lbl}>LinkedIn</label><input className={inp} value={profile.linkedinUrl || ""} onChange={(e) => setProfile({ ...profile, linkedinUrl: e.target.value })} /></div>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={profile.trabalhandoAtualmente === true} onChange={(e) => setProfile({ ...profile, trabalhandoAtualmente: e.target.checked })} /> Trabalhando atualmente</label>
        <div className="sm:col-span-2"><label className={lbl}>Resumo profissional</label><textarea className={`${inp} min-h-28`} value={profile.resumoProfissional || ""} onChange={(e) => setProfile({ ...profile, resumoProfissional: e.target.value })} /></div>
        <div><label className={lbl}>Foto</label><input className={inp} type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && void onUpload("avatar", e.target.files[0])} /></div>
        <div><label className={lbl}>Curriculo</label><input className={inp} type="file" accept=".pdf,.doc,.docx" onChange={(e) => e.target.files?.[0] && void onUpload("curriculo", e.target.files[0])} /></div>
        <div className="sm:col-span-2"><label className={lbl}>Analisar curriculo com IA (PDF)</label><input className={inp} type="file" accept=".pdf" disabled={parsingResume} onChange={(e) => e.target.files?.[0] && void onParseResume(e.target.files[0])} /></div>
      </div>

      <div className="mt-5 flex justify-end">
        <button type="button" disabled={saving} onClick={() => void onSave()} className="rounded-lg bg-[#105290] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0d3f72] disabled:opacity-60">
          {saving ? "Salvando..." : "Salvar perfil"}
        </button>
      </div>
    </div>
  );
}

function WorkspaceMessage({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center">
      <div className="max-w-md rounded-2xl border border-border/40 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
