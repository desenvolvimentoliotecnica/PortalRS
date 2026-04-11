"use client";

import type { Kpis } from "../dashboardTypes";

export function KpiWidget({ kpis }: { kpis: Kpis }) {
  return (
    <div className="grid h-full grid-cols-1 gap-3 md:grid-cols-5">
      <div
        className="rounded-xl border border-border/40 bg-card shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
        role="button"
        tabIndex={0}
        onClick={() => { window.location.href = "/app/vagas"; }}
        onKeyDown={(ev) => {
          if (ev.key !== "Enter" && ev.key !== " ") return;
          ev.preventDefault();
          window.location.href = "/app/vagas";
        }}
      >
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Vagas abertas</div>
        <div className="text-2xl font-bold mt-1.5 tabular-nums text-[rgb(var(--lt-primary))]">{kpis.openVagas}</div>
        <div className="text-muted-foreground text-xs mt-0.5">em aberto</div>
      </div>
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 shadow-sm p-4">
        <div className="text-[10px] font-semibold text-blue-600/70 uppercase tracking-widest">CVs hoje</div>
        <div className="text-2xl font-bold mt-1.5 text-blue-600 tabular-nums">{kpis.cvsHoje}</div>
        <div className="text-muted-foreground text-xs mt-0.5">recebidos</div>
      </div>
      <div className="rounded-xl border border-amber-100 bg-amber-50/50 shadow-sm p-4">
        <div className="text-[10px] font-semibold text-amber-600/70 uppercase tracking-widest">Pendentes match</div>
        <div className="text-2xl font-bold mt-1.5 text-amber-600 tabular-nums">{kpis.pendentesMatch}</div>
        <div className="text-muted-foreground text-xs mt-0.5">aguardando</div>
      </div>
      <div className="rounded-xl border border-green-100 bg-green-50/50 shadow-sm p-4">
        <div className="text-[10px] font-semibold text-green-600/70 uppercase tracking-widest">Aprovados 7 dias</div>
        <div className="text-2xl font-bold mt-1.5 text-green-600 tabular-nums">{kpis.aprovados7Dias}</div>
        <div className="text-muted-foreground text-xs mt-0.5">últimos 7 dias</div>
      </div>
      <div className="rounded-xl border border-red-100 bg-red-50/50 shadow-sm p-4">
        <div className="text-[10px] font-semibold text-red-600/70 uppercase tracking-widest">Vagas fora SLA</div>
        <div className="text-2xl font-bold mt-1.5 text-red-600 tabular-nums">{kpis.vagasForaSla}</div>
        <div className="text-muted-foreground text-xs mt-0.5">atenção</div>
      </div>
    </div>
  );
}
