"use client";

import { Button } from "@/components/ui/button";
import type { Funil, FunilConversao } from "../dashboardTypes";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function FunilWidget({
  funil,
  funilConversao,
  onOpenFilters,
}: {
  funil: Funil;
  funilConversao?: FunilConversao | null;
  onOpenFilters: () => void;
}) {
  const hasConversionFunnel = !!funilConversao && funilConversao.etapas.length > 0;
  const firstStageTotal = funilConversao?.etapas[0]?.total ?? 0;
  const contratados = funilConversao?.etapas.find((etapa) => etapa.titulo === "Contratado")?.total ?? 0;
  const conversionRate = firstStageTotal > 0 ? (contratados * 100) / firstStageTotal : null;

  const funnelBase = funil.recebidos > 0 ? funil.recebidos : 1;
  const bars = {
    recebidos: 100,
    triagem: Math.round((funil.triagem / funnelBase) * 100),
    entrevista: Math.round((funil.entrevista / funnelBase) * 100),
    aprovados: Math.round((funil.aprovados / funnelBase) * 100),
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/50 bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Funil</div>
          <div className="text-xs text-muted-foreground">
            {hasConversionFunnel ? "Conversao de candidaturas" : "Pipeline"}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenFilters}>
          Filtros
        </Button>
      </div>

      {hasConversionFunnel ? (
        <div className="mt-2 flex min-h-0 flex-1 flex-col">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Total geral", value: funilConversao.totalGeral, tone: "text-neutral-900" },
              { label: "Aplicaram", value: firstStageTotal, tone: "text-sky-600" },
              { label: "Contratados", value: contratados, tone: "text-emerald-600" },
              {
                label: "Conversao",
                value: conversionRate == null ? "-" : `${conversionRate.toFixed(1)}%`,
                tone: "text-violet-600",
              },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {item.label}
                </div>
                <div className={`mt-1 text-xl font-bold tabular-nums ${item.tone}`}>{item.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2 overflow-auto pr-1">
            {funilConversao.etapas.map((etapa) => {
              const widthPct = firstStageTotal > 0 ? Math.max(5, (etapa.total / firstStageTotal) * 100) : 0;
              const conversionTone =
                etapa.taxaConversaoPercent == null
                  ? "text-muted-foreground"
                  : etapa.taxaConversaoPercent >= 50
                    ? "text-emerald-700"
                    : etapa.taxaConversaoPercent >= 25
                      ? "text-amber-700"
                      : "text-red-700";

              return (
                <div key={etapa.titulo}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-foreground">{etapa.titulo}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{etapa.total}</span>
                  </div>
                  <div className="mt-1 h-3 overflow-hidden rounded-full bg-black/10">
                    <div
                      className="h-full bg-[rgb(var(--lt-primary))]"
                      style={{ width: `${clamp(widthPct, 0, 100)}%` }}
                    />
                  </div>
                  {etapa.taxaConversaoPercent !== null ? (
                    <div className={`mt-0.5 text-xs ${conversionTone}`}>
                      {etapa.taxaConversaoPercent.toFixed(1)}% para a proxima etapa
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {funilConversao.vagaTitulo ? (
            <div className="mt-2 text-xs text-muted-foreground">
              Vaga: <span className="font-medium text-foreground">{funilConversao.vagaTitulo}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-2 space-y-3">
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
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/10">
                  <div
                    className="h-full bg-[rgb(var(--lt-primary))]"
                    style={{ width: `${clamp(x.pct, 0, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-sm text-muted-foreground">
            Dica: use filtros para ver diferentes periodos/vagas.
          </div>
        </>
      )}
    </div>
  );
}
