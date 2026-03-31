"use client";

import { useMemo } from "react";
import { Briefcase, CheckCircle2, Clock, Search, XCircle } from "lucide-react";
import { loadAppsHistory, type AppHistoryItem } from "@/features/portalvagas/appsStorage";

const STAGE_LABELS = [
  { key: "applied", label: "Candidatura", icon: CheckCircle2 },
  { key: "screen", label: "Triagem", icon: Search },
  { key: "interview", label: "Entrevista", icon: Briefcase },
  { key: "offer", label: "Oferta", icon: CheckCircle2 },
] as const;

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s.includes("reprovad") || s.includes("reject"))
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-500/15 text-red-700"><XCircle className="size-3" /> Reprovado</span>;
  if (s.includes("aprovad") || s.includes("contrat") || s.includes("offer"))
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-700"><CheckCircle2 className="size-3" /> Aprovado</span>;
  if (s.includes("entrevista") || s.includes("interview"))
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-blue-500/15 text-blue-700"><Briefcase className="size-3" /> Entrevista</span>;
  if (s.includes("triagem") || s.includes("screen"))
    return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-500/15 text-amber-700"><Search className="size-3" /> Triagem</span>;
  return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-sky-500/15 text-sky-700"><Clock className="size-3" /> {status || "Aplicado"}</span>;
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

export default function MinhasCandidaturasSection() {
  const apps = useMemo(() => loadAppsHistory().sort((a, b) => b.createdAt.localeCompare(a.createdAt)), []);

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
                <h3 className="font-semibold text-foreground truncate">{app.title || "Vaga sem título"}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {app.company && <span>{app.company}</span>}
                  {app.location && <span>- {app.location}</span>}
                  <span>- {app.date}</span>
                </div>
              </div>
              <div className="shrink-0">
                <StatusBadge status={app.status} />
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
