"use client";

import { CalendarClock, Target, Users } from "lucide-react";
import Link from "next/link";
import type { UpcomingAction } from "../dashboardTypes";

function formatDate(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function isDue(iso: string) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return diff < 2 * 24 * 60 * 60 * 1000; // within 48h
}

const TYPE_ICON: Record<string, React.ElementType> = {
  meta: Target,
  reuniao: Users,
  meeting: Users,
  goal: Target,
};

export function ProximasAcoesWidget({
  actions,
  loading,
}: {
  actions: UpcomingAction[];
  loading: boolean;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border/50 bg-card shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <div className="text-sm font-semibold">Próximas Ações</div>
          <div className="text-muted-foreground text-xs">Compromissos e deadlines</div>
        </div>
        <Link href="/app/gestao/solicitacoes" className="text-xs text-primary hover:underline">
          Ver todas →
        </Link>
      </div>

      {loading && <div className="text-xs text-muted-foreground">Carregando…</div>}

      {!loading && actions.length === 0 && (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-xs text-muted-foreground">Nenhuma ação próxima.</span>
        </div>
      )}

      {!loading && actions.length > 0 && (
        <div className="space-y-1.5 overflow-auto flex-1">
          {actions.map((a) => {
            const Icon = TYPE_ICON[a.type?.toLowerCase() ?? ""] ?? CalendarClock;
            const urgent = isDue(a.dueAtUtc);
            return (
              <div
                key={a.id}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${urgent ? "border-amber-200/60 bg-amber-50/50" : "border-border/40 bg-muted/20"}`}
              >
                <Icon className={`size-3.5 shrink-0 ${urgent ? "text-amber-600" : "text-muted-foreground"}`} />
                <span className="text-xs flex-1 truncate">{a.description}</span>
                <span className={`text-[10px] font-semibold shrink-0 ${urgent ? "text-amber-700" : "text-muted-foreground"}`}>
                  {formatDate(a.dueAtUtc)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
