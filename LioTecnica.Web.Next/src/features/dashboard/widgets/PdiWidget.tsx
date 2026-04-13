"use client";

import Link from "next/link";
import type { PdiItem } from "../dashboardTypes";

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  in_progress: { label: "Em andamento", color: "text-blue-700", dot: "bg-blue-500" },
  completed: { label: "Concluído", color: "text-green-700", dot: "bg-green-500" },
  overdue: { label: "Atrasado", color: "text-red-700", dot: "bg-red-500" },
  pending: { label: "Pendente", color: "text-slate-600", dot: "bg-slate-400" },
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function PdiWidget({ pdis, loading }: { pdis: PdiItem[]; loading: boolean }) {
  const counts = pdis.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/50 bg-card shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <div className="text-sm font-semibold">Planos de Desenvolvimento</div>
          <div className="text-muted-foreground text-xs">{pdis.length} PDIs ativos</div>
        </div>
        <Link href="/app/gestao/planos" className="text-xs text-primary hover:underline">
          Ver todos →
        </Link>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 gap-2 mb-3 shrink-0">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/20 px-2 py-1.5">
            <span className={`size-2 rounded-full shrink-0 ${cfg.dot}`} />
            <span className="text-[10px] text-muted-foreground truncate">{cfg.label}</span>
            <span className="ml-auto text-xs font-semibold">{counts[key] ?? 0}</span>
          </div>
        ))}
      </div>

      {loading && <div className="text-xs text-muted-foreground">Carregando…</div>}

      {/* PDI list */}
      {!loading && (
        <div className="space-y-2 overflow-auto flex-1">
          {pdis.slice(0, 5).map((p) => {
            const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending;
            const pct = clamp(p.progress, 0, 100);
            return (
              <div key={p.id}>
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-xs truncate flex-1">{p.title}</span>
                  <span className={`text-[10px] font-semibold shrink-0 ${cfg.color}`}>{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className="h-full bg-[rgb(var(--lt-primary))] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{p.responsibleName}</div>
              </div>
            );
          })}
          {pdis.length === 0 && (
            <div className="text-xs text-muted-foreground py-2">Nenhum plano de desenvolvimento cadastrado.</div>
          )}
        </div>
      )}
    </div>
  );
}
