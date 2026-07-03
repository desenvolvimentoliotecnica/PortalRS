"use client";

import Link from "next/link";
import type { SlaData } from "../dashboardTypes";

const STATUS_CONFIG = {
  no_prazo: { label: "No prazo", color: "text-green-700", bg: "bg-green-500" },
  critica: { label: "Crítica", color: "text-amber-700", bg: "bg-amber-500" },
  atrasada: { label: "Atrasada", color: "text-red-700", bg: "bg-red-500" },
} as const;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function SlaWidget({ data, loading }: { data: SlaData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="h-full rounded-xl border border-border/50 bg-card shadow-sm p-4 flex items-center justify-center">
        <span className="text-xs text-muted-foreground">Carregando SLA…</span>
      </div>
    );
  }

  const kpis = data?.kpis ?? { total: 0, noPrazo: 0, critica: 0, atrasada: 0 };
  const vagas = data?.vagas ?? [];

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/50 bg-card shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <div className="text-sm font-semibold">SLA de Vagas</div>
          <div className="text-muted-foreground text-xs">Prazo de abertura</div>
        </div>
        <Link href="/recrutamento/sla" className="text-xs text-primary hover:underline">
          Ver tudo →
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-2 shrink-0 mb-3">
        {[
          { label: "Total", value: kpis.total, color: "text-foreground" },
          { label: "No prazo", value: kpis.noPrazo, color: "text-green-600" },
          { label: "Crítica", value: kpis.critica, color: "text-amber-600" },
          { label: "Atrasada", value: kpis.atrasada, color: "text-red-600" },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border border-border/40 bg-muted/30 p-2 text-center">
            <div className={`text-lg font-bold tabular-nums ${c.color}`}>{c.value}</div>
            <div className="text-[10px] text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Vagas list */}
      <div className="space-y-1.5 overflow-auto flex-1">
        {vagas.slice(0, 6).map((v) => {
          const cfg = STATUS_CONFIG[v.slaStatus] ?? STATUS_CONFIG.no_prazo;
          const pct = clamp(v.percentualConsumido, 0, 100);
          return (
            <div key={v.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-xs truncate">{v.titulo}</span>
                  <span className={`text-[10px] font-semibold shrink-0 ${cfg.color}`}>
                    {v.diasAberto}d / {v.metaDias}d
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={`h-full ${cfg.bg} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {vagas.length === 0 && (
          <div className="text-xs text-muted-foreground py-2">Nenhuma vaga com SLA registrado.</div>
        )}
      </div>
    </div>
  );
}
