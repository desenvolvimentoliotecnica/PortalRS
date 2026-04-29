"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { PendingItem } from "../dashboardTypes";

function formatDate(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function AprovacoesWidget({
  pendentes,
  pendentesLoading,
}: {
  pendentes: PendingItem[];
  pendentesLoading: boolean;
}) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border/50 bg-card shadow-sm p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Clock className="size-3.5 text-amber-600" />
          <span className="text-sm font-semibold">Aprovações Pendentes</span>
          {!pendentesLoading && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              {pendentes.length}
            </span>
          )}
        </div>
        <Link href="/gestao/painel-solicitacoes">
          <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
            Ver todas →
          </Button>
        </Link>
      </div>

      {pendentesLoading && (
        <div className="text-xs text-muted-foreground py-2">Carregando…</div>
      )}

      {!pendentesLoading && pendentes.length === 0 && (
        <div className="text-xs text-muted-foreground py-2">Nenhuma aprovação pendente.</div>
      )}

      {!pendentesLoading && pendentes.length > 0 && (
        <div className="divide-y divide-border/30 overflow-auto">
          {pendentes.slice(0, 6).map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={`${p.tipo}-${p.id}-${i}`}
                className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-muted/30 rounded px-1 -mx-1"
                onClick={() => { window.location.href = `/app${p.href}`; }}
              >
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold w-28 shrink-0 ${p.color}`}>
                  <Icon className="size-3" />
                  {p.tipo}
                </span>
                <span className="text-sm truncate flex-1">{p.titulo}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{formatDate(p.data)}</span>
              </div>
            );
          })}
          {pendentes.length > 6 && (
            <div className="pt-1.5 text-center">
              <Link
                href="/gestao/painel-solicitacoes"
                className="text-xs text-primary hover:underline"
              >
                +{pendentes.length - 6} mais
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
