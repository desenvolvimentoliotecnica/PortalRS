"use client";

import type { MoodStats } from "../dashboardTypes";

const MOOD_CONFIG: Record<string, { label: string; emoji: string; color: string; bar: string }> = {
  very_bad: { label: "Muito ruim", emoji: "😞", color: "text-red-700", bar: "bg-red-500" },
  bad: { label: "Ruim", emoji: "😕", color: "text-orange-600", bar: "bg-orange-400" },
  neutral: { label: "Neutro", emoji: "😐", color: "text-slate-600", bar: "bg-slate-400" },
  good: { label: "Bom", emoji: "🙂", color: "text-green-600", bar: "bg-green-400" },
  great: { label: "Ótimo", emoji: "😄", color: "text-emerald-600", bar: "bg-emerald-500" },
};

const MOOD_ORDER = ["very_bad", "bad", "neutral", "good", "great"];

export function HumorEquipeWidget({
  stats,
  loading,
}: {
  stats: MoodStats | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="h-full rounded-xl border border-border/50 bg-card shadow-sm p-4 flex items-center justify-center">
        <span className="text-xs text-muted-foreground">Carregando humor…</span>
      </div>
    );
  }

  const avg = stats?.averageMood ?? "";
  const total = stats?.totalResponses ?? 0;
  const dist = stats?.distribution ?? [];
  const avgCfg = MOOD_CONFIG[avg] ?? { label: avg || "—", emoji: "❓", color: "text-muted-foreground", bar: "bg-muted" };

  const ordered = MOOD_ORDER.map((mood) => {
    const found = dist.find((d) => d.mood === mood);
    return found ?? { mood, count: 0, percentage: 0 };
  });

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/50 bg-card shadow-sm p-4">
      <div className="mb-3 shrink-0">
        <div className="text-sm font-semibold">Humor da Equipe</div>
        <div className="text-muted-foreground text-xs">{total} respostas</div>
      </div>

      {/* Average mood */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <span className="text-4xl">{avgCfg.emoji}</span>
        <div>
          <div className={`text-base font-bold ${avgCfg.color}`}>{avgCfg.label}</div>
          <div className="text-xs text-muted-foreground">Humor médio atual</div>
        </div>
      </div>

      {/* Distribution bars */}
      <div className="space-y-2 overflow-auto flex-1">
        {ordered.map((d) => {
          const cfg = MOOD_CONFIG[d.mood] ?? { label: d.mood, emoji: "❓", color: "text-muted-foreground", bar: "bg-muted" };
          return (
            <div key={d.mood} className="flex items-center gap-2">
              <span className="text-base w-5 shrink-0">{cfg.emoji}</span>
              <div className="flex-1">
                <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={`h-full ${cfg.bar} transition-all`}
                    style={{ width: `${d.percentage}%` }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0">
                {d.percentage.toFixed(0)}%
              </span>
            </div>
          );
        })}
        {total === 0 && (
          <div className="text-xs text-muted-foreground py-2">Nenhuma resposta registrada.</div>
        )}
      </div>
    </div>
  );
}
