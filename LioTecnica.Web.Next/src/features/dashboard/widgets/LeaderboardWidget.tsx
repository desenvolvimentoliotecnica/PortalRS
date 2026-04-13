"use client";

import Link from "next/link";
import type { LeaderboardEntry, MyBalance } from "../dashboardTypes";

function rankLabel(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export function LeaderboardWidget({
  entries,
  myBalance,
  loading,
}: {
  entries: LeaderboardEntry[];
  myBalance: MyBalance | null;
  loading: boolean;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border/50 bg-card shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <div className="text-sm font-semibold">Leaderboard</div>
          <div className="text-muted-foreground text-xs">Ranking de RenderCoins</div>
        </div>
        <Link href="/app/gamificacao" className="text-xs text-primary hover:underline">
          Ver tudo →
        </Link>
      </div>

      {/* My balance */}
      {myBalance && (
        <div className="mb-3 shrink-0 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-primary font-medium">Meu saldo</span>
          <span className="text-sm font-bold text-primary">
            {myBalance.balance.toLocaleString("pt-BR")} RC
          </span>
        </div>
      )}

      {loading && <div className="text-xs text-muted-foreground">Carregando…</div>}

      {!loading && (
        <div className="space-y-1.5 overflow-auto flex-1">
          {entries.slice(0, 7).map((e) => (
            <div
              key={e.userId}
              className="flex items-center gap-2.5 rounded-lg border border-border/30 bg-muted/20 px-3 py-2"
            >
              <span className="text-sm w-7 shrink-0 text-center">{rankLabel(e.rank)}</span>
              <span className="text-xs flex-1 truncate font-medium">{e.fullName}</span>
              <span className="text-xs font-bold tabular-nums text-[rgb(var(--lt-primary))]">
                {e.balance.toLocaleString("pt-BR")} RC
              </span>
            </div>
          ))}
          {entries.length === 0 && (
            <div className="text-xs text-muted-foreground py-2">Nenhuma entrada no leaderboard.</div>
          )}
        </div>
      )}
    </div>
  );
}
