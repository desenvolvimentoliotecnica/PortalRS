"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Briefcase, CheckCircle2, Clock, Search, XCircle } from "lucide-react";
import { loadAppsHistory, type AppHistoryItem } from "@/features/portalvagas/appsStorage";
import { getPortalCandidateSession, portalAuthFetch } from "@/features/portalvagas/publicApi";

type EtapaMacro =
  | "Aplicada"
  | "EmTriagem"
  | "Entrevista"
  | "Teste"
  | "Proposta"
  | "Contratado"
  | "Recusado"
  | "Desistiu";

type CandidaturaStatus = "Ativa" | "Contratado" | "Reprovado" | "Desistiu" | "Arquivada";

type CandidaturaHistoricoItem = {
  etapaAnterior: EtapaMacro | number;
  etapaNova: EtapaMacro | number;
  emUtc: string;
  observacao: string | null;
};

type CandidaturaServerResponse = {
  id: string;
  candidatoId: string;
  vagaId: string;
  vagaCodigo: string | null;
  vagaTitulo: string | null;
  vagaLocal: string | null;
  status: CandidaturaStatus | number;
  etapaMacro: EtapaMacro | number;
  aplicadaEmUtc: string;
  etapaAtualDesdeUtc: string | null;
  updatedAtUtc: string;
  historico: CandidaturaHistoricoItem[];
};

const ETAPA_NAMES: EtapaMacro[] = [
  "Aplicada",
  "EmTriagem",
  "Entrevista",
  "Teste",
  "Proposta",
  "Contratado",
  "Recusado",
  "Desistiu",
];

const STATUS_NAMES: CandidaturaStatus[] = [
  "Ativa",
  "Contratado",
  "Reprovado",
  "Desistiu",
  "Arquivada",
];

function resolveEtapa(value: EtapaMacro | number): EtapaMacro {
  if (typeof value === "number") return ETAPA_NAMES[value] ?? "Aplicada";
  return value;
}

function resolveStatus(value: CandidaturaStatus | number): CandidaturaStatus {
  if (typeof value === "number") return STATUS_NAMES[value] ?? "Ativa";
  return value;
}

const STAGE_LABELS = [
  { key: "applied", label: "Candidatura", icon: CheckCircle2 },
  { key: "screen", label: "Triagem", icon: Search },
  { key: "interview", label: "Entrevista", icon: Briefcase },
  { key: "offer", label: "Oferta", icon: CheckCircle2 },
] as const;

function etapaToStageFlags(e: EtapaMacro): { applied: boolean; screen: boolean; interview: boolean; test: boolean; offer: boolean } {
  const base = { applied: true, screen: false, interview: false, test: false, offer: false };
  switch (e) {
    case "EmTriagem": return { ...base, screen: true };
    case "Entrevista": return { ...base, screen: true, interview: true };
    case "Teste": return { ...base, screen: true, interview: true, test: true };
    case "Proposta": return { ...base, screen: true, interview: true, offer: true };
    case "Contratado": return { ...base, screen: true, interview: true, offer: true };
    default: return base;
  }
}

function StatusBadge({ etapa, status }: { etapa: EtapaMacro; status: CandidaturaStatus }) {
  if (status === "Reprovado")
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-500/15 text-red-700"><XCircle className="size-3" /> Reprovado</span>;
  if (status === "Contratado")
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-700"><CheckCircle2 className="size-3" /> Contratado</span>;
  if (status === "Desistiu")
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-neutral-400/20 text-neutral-700"><XCircle className="size-3" /> Desistiu</span>;
  if (etapa === "Entrevista")
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-500/15 text-blue-700"><Briefcase className="size-3" /> Entrevista</span>;
  if (etapa === "EmTriagem")
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-500/15 text-amber-700"><Search className="size-3" /> Triagem</span>;
  if (etapa === "Proposta")
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-violet-500/15 text-violet-700"><Clock className="size-3" /> Proposta</span>;
  return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-sky-500/15 text-sky-700"><Clock className="size-3" /> Aplicado</span>;
}

function MiniPipeline({ stages }: { stages: AppHistoryItem["stages"] }) {
  return (
    <div className="flex items-center gap-1">
      {STAGE_LABELS.map(({ key, label, icon: Icon }) => {
        const done = stages?.[key as keyof typeof stages] ?? false;
        return (
          <div key={key} className="flex items-center gap-1">
            <div
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                done ? "bg-emerald-500/15 text-emerald-700" : "bg-muted/50 text-muted-foreground"
              }`}
              title={label}
            >
              <Icon className="size-2.5" />
              <span className="hidden sm:inline">{label}</span>
            </div>
            {key !== "offer" && (
              <div className={`h-px w-3 ${done ? "bg-emerald-400" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

type NormalizedApp = {
  id: string;
  title: string;
  subtitle: string;
  location: string;
  date: string;
  etapa: EtapaMacro;
  status: CandidaturaStatus;
  stages: ReturnType<typeof etapaToStageFlags>;
  notes?: string;
};

function fromServer(c: CandidaturaServerResponse): NormalizedApp {
  const etapa = resolveEtapa(c.etapaMacro);
  const status = resolveStatus(c.status);
  return {
    id: c.id,
    title: c.vagaTitulo ?? `Vaga ${c.vagaId.slice(0, 8)}`,
    subtitle: c.vagaCodigo ?? "",
    location: c.vagaLocal ?? "",
    date: new Date(c.aplicadaEmUtc).toLocaleDateString("pt-BR"),
    etapa,
    status,
    stages: etapaToStageFlags(etapa),
    notes: c.historico[c.historico.length - 1]?.observacao ?? undefined,
  };
}

function fromLocal(a: AppHistoryItem): NormalizedApp {
  const st = (a.status || "").toLowerCase();
  let etapa: EtapaMacro = "Aplicada";
  let status: CandidaturaStatus = "Ativa";
  if (st.includes("reprovad") || st.includes("reject")) status = "Reprovado";
  else if (st.includes("contrat") || st.includes("offer")) etapa = "Proposta";
  else if (st.includes("entrevista") || st.includes("interview")) etapa = "Entrevista";
  else if (st.includes("triagem") || st.includes("screen")) etapa = "EmTriagem";
  return {
    id: a.id,
    title: a.title || "Vaga sem título",
    subtitle: a.company || "",
    location: a.location || "",
    date: a.date,
    etapa,
    status,
    stages: { applied: true, screen: !!a.stages?.screen, interview: !!a.stages?.interview, test: !!a.stages?.test, offer: !!a.stages?.offer },
    notes: a.notes || undefined,
  };
}

export default function MinhasCandidaturasSection() {
  const searchParams = useSearchParams();
  const tenantId = (searchParams.get("tenantId") || searchParams.get("tenant") || "").trim();
  const session = useMemo(() => (tenantId ? getPortalCandidateSession(tenantId) : null), [tenantId]);

  const [serverItems, setServerItems] = useState<NormalizedApp[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.id || !tenantId) return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const resp = await portalAuthFetch(tenantId, `/api/public/portal-auth/minhas-candidaturas/${encodeURIComponent(session.id)}`, {
          signal: ac.signal,
          cache: "no-store",
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as CandidaturaServerResponse[];
        if (!ac.signal.aborted) setServerItems(data.map(fromServer));
      } catch (err) {
        if ((err as DOMException).name !== "AbortError")
          setError("Falha ao carregar suas candidaturas.");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [session?.id, tenantId]);

  const apps = useMemo<NormalizedApp[]>(() => {
    if (serverItems) return serverItems;
    return loadAppsHistory()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(fromLocal);
  }, [serverItems]);

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Carregando…</div>;
  }

  if (error) {
    return <div className="py-16 text-center text-sm text-red-600">{error}</div>;
  }

  if (apps.length === 0) {
    return (
      <div className="text-center py-16">
        <Briefcase className="mx-auto size-10 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-semibold text-foreground">Nenhuma candidatura ainda</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Candidate-se a uma vaga para acompanhar seu progresso aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Minhas Candidaturas</h2>
        <span className="text-xs text-muted-foreground">{apps.length} candidatura(s)</span>
      </div>

      <div className="space-y-3">
        {apps.map((app) => (
          <div
            key={app.id}
            className="rounded-xl border border-border/40 bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">{app.title}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {app.subtitle && <span>{app.subtitle}</span>}
                  {app.location && <span>- {app.location}</span>}
                  <span>- {app.date}</span>
                </div>
              </div>
              <div className="shrink-0">
                <StatusBadge etapa={app.etapa} status={app.status} />
              </div>
            </div>
            <div className="mt-3">
              <MiniPipeline stages={app.stages} />
            </div>
            {app.notes && (
              <p className="mt-2 text-xs text-muted-foreground">{app.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
