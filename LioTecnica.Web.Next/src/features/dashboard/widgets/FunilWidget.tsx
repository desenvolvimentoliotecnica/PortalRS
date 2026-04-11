"use client";

import { Button } from "@/components/ui/button";
import type { Funil } from "../dashboardTypes";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function FunilWidget({
  funil,
  onOpenFilters,
}: {
  funil: Funil;
  onOpenFilters: () => void;
}) {
  const funnelBase = funil.recebidos > 0 ? funil.recebidos : 1;
  const bars = {
    recebidos: 100,
    triagem: Math.round((funil.triagem / funnelBase) * 100),
    entrevista: Math.round((funil.entrevista / funnelBase) * 100),
    aprovados: Math.round((funil.aprovados / funnelBase) * 100),
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/50 bg-card shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-semibold">Funil</div>
          <div className="text-muted-foreground text-xs">Pipeline</div>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenFilters}>
          Filtros
        </Button>
      </div>

      <div className="space-y-3 mt-2">
        {[
          { key: "recebidos", label: "Recebidos", value: funil.recebidos, pct: bars.recebidos },
          { key: "triagem", label: "Triagem", value: funil.triagem, pct: bars.triagem },
          { key: "entrevista", label: "Entrevista", value: funil.entrevista, pct: bars.entrevista },
          { key: "aprovados", label: "Aprovados", value: funil.aprovados, pct: bars.aprovados },
        ].map((x) => (
          <div key={x.key}>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{x.label}</span>
              <span className="font-semibold">{x.value}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-black/10 overflow-hidden">
              <div
                className="h-full bg-[rgb(var(--lt-primary))]"
                style={{ width: `${clamp(x.pct, 0, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-muted-foreground text-sm">
        Dica: use filtros para ver diferentes períodos/vagas.
      </div>
    </div>
  );
}
