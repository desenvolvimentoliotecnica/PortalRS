"use client";

import Link from "next/link";
import type { MeuTimeData } from "../dashboardTypes";

function initials(nome: string) {
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-pink-500",
];

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function MeuTimeWidget({
  data,
  loading,
}: {
  data: MeuTimeData | null;
  loading: boolean;
}) {
  const membros = data?.membros ?? [];
  const diretos = data?.totalDiretos ?? 0;
  const indiretos = data?.totalIndiretos ?? 0;

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/50 bg-card shadow-sm p-4">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <div className="text-sm font-semibold">Meu Time</div>
          <div className="text-muted-foreground text-xs">
            {loading ? "Carregando…" : `${membros.length} colaborador${membros.length !== 1 ? "es" : ""}`}
          </div>
        </div>
        <Link href="/app/funcionarios" className="text-xs text-primary hover:underline">
          Ver todos →
        </Link>
      </div>

      {/* KPI row */}
      {!loading && membros.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3 shrink-0">
          <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
            <span className="size-2 rounded-full bg-[rgb(var(--lt-primary))] shrink-0" />
            <span className="text-[10px] text-muted-foreground">Diretos</span>
            <span className="ml-auto text-sm font-bold">{diretos}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
            <span className="size-2 rounded-full bg-slate-400 shrink-0" />
            <span className="text-[10px] text-muted-foreground">Indiretos</span>
            <span className="ml-auto text-sm font-bold">{indiretos}</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Carregando time…</span>
        </div>
      )}

      {!loading && membros.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">Nenhum colaborador subordinado encontrado.</span>
        </div>
      )}

      {!loading && membros.length > 0 && (
        <div className="space-y-1.5 overflow-auto flex-1">
          {membros.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2.5 rounded-lg border border-border/30 bg-muted/20 px-3 py-2"
            >
              {/* Avatar */}
              <div
                className={`size-7 rounded-full ${avatarColor(m.id)} flex items-center justify-center shrink-0`}
              >
                <span className="text-[10px] font-bold text-white">{initials(m.nome)}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{m.nome}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {m.cargo || m.area || "—"}
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-1.5 shrink-0">
                {m.tipo === "direto" ? (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    Direto
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    Indireto
                  </span>
                )}
                <span
                  className={`size-1.5 rounded-full ${
                    m.status?.toLowerCase() === "active" || m.status?.toLowerCase() === "ativo"
                      ? "bg-green-500"
                      : "bg-slate-300"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
