"use client";

import { AlertCircle, ArrowRight, Clock, CheckCircle } from "lucide-react";
import Link from "next/link";

export function OQueFazerWidget({
  pendentesMatch,
  vagasForaSla,
}: {
  pendentesMatch: number;
  vagasForaSla: number;
}) {
  const hasAlerts = pendentesMatch > 0 || vagasForaSla > 0;

  if (!hasAlerts) {
    return (
      <div className="h-full rounded-xl border border-green-200/60 bg-green-50/50 p-4 flex items-center gap-3">
        <CheckCircle className="size-5 text-green-600 shrink-0" />
        <div>
          <div className="text-sm font-semibold text-green-900">Tudo em dia</div>
          <div className="text-xs text-green-700/70">Nenhuma pendência crítica no momento.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full rounded-xl border border-amber-200/60 bg-amber-50/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="size-4 text-amber-600" />
        <h2 className="text-sm font-semibold text-amber-900">O que fazer agora</h2>
      </div>
      <div className="space-y-2">
        {pendentesMatch > 0 && (
          <Link
            href="/matching"
            className="flex items-center justify-between gap-2 rounded-lg bg-white/80 border border-amber-200/40 px-3 py-2 text-sm hover:bg-white transition-colors group"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-amber-600" />
              <span>
                <strong>{pendentesMatch}</strong> candidatos pendentes de matching
              </span>
            </div>
            <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
        )}
        {vagasForaSla > 0 && (
          <Link
            href="/recrutamento/candidaturas"
            className="flex items-center justify-between gap-2 rounded-lg bg-white/80 border border-red-200/40 px-3 py-2 text-sm hover:bg-white transition-colors group"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-red-600" />
              <span>
                <strong>{vagasForaSla}</strong> vagas fora do SLA
              </span>
            </div>
            <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
        )}
      </div>
    </div>
  );
}
