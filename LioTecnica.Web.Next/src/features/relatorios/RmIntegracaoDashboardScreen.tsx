"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DashboardKpis {
  solicitacoesCriadas: number;
  vagasVinculadas: number;
  integracoesConcluidas: number;
  falhasIntegracao: number;
  tempoMedioTotal: string;
  percentualVagasVinculadas: number;
  percentualIntegracoesConcluidas: number;
  percentualFalhas: number;
}

interface SliceItem {
  label: string;
  total: number;
  percentual: number;
}

interface DailyPoint {
  data: string;
  criadas: number;
  integradas: number;
  falhas: number;
  taxaSucesso: number;
}

interface BarItem {
  label: string;
  total: number;
  percentual: number;
}

interface StageTime {
  label: string;
  tempoMedio: string;
}

interface DashboardResponse {
  dataDe: string;
  dataAte: string;
  atualizadoEmUtc: string;
  kpis: DashboardKpis;
  solicitacoesPorStatus: SliceItem[];
  integracoesPorDia: DailyPoint[];
  falhasPorMotivo: BarItem[];
  vagasCriadasPorUnidade: BarItem[];
  tempoMedioPorEtapa: StageTime[];
  taxaSucessoPorPeriodo: DailyPoint[];
}

const STATUS_COLORS = ["#4f22d8", "#16a34a", "#ef4444", "#64748b"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(baseIso: string, days: number) {
  const d = new Date(`${baseIso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  const [, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}

function pct(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function exportCsv(data: DashboardResponse) {
  const rows = [
    ["Indicador", "Valor"],
    ["Solicitações criadas", String(data.kpis.solicitacoesCriadas)],
    ["Vagas vinculadas", String(data.kpis.vagasVinculadas)],
    ["Integrações concluídas", String(data.kpis.integracoesConcluidas)],
    ["Falhas na integração", String(data.kpis.falhasIntegracao)],
    ["Tempo médio total", data.kpis.tempoMedioTotal],
    [],
    ["Falhas por motivo", "Total", "%"],
    ...data.falhasPorMotivo.map((x) => [x.label, String(x.total), String(x.percentual)]),
    [],
    ["Vagas por unidade", "Total", "%"],
    ...data.vagasCriadasPorUnidade.map((x) => [x.label, String(x.total), String(x.percentual)]),
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dashboard-integracao-rm-${data.dataDe}-${data.dataAte}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RmIntegracaoDashboardScreen() {
  const initialAte = todayIso();
  const [dataDe, setDataDe] = useState(() => addDaysIso(initialAte, -6));
  const [dataAte, setDataAte] = useState(initialAte);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dataDe) params.set("dataDe", dataDe);
      if (dataAte) params.set("dataAte", dataAte);

      const res = await apiFetch(`/api/integracao-totvs/requisicoes-rm/dashboard?${params}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { message?: string; detail?: string } | null;
        throw new Error(body?.message || body?.detail || `HTTP ${res.status}`);
      }
      setData(await res.json() as DashboardResponse);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao carregar dashboard RM.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dataAte, dataDe]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxIntegracoesDia = useMemo(() => {
    const values = data?.integracoesPorDia.map((x) => Math.max(x.criadas, x.integradas, x.falhas)) ?? [];
    return Math.max(1, ...values);
  }, [data]);

  const donut = useMemo(() => buildDonut(data?.solicitacoesPorStatus ?? []), [data]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-muted-foreground text-sm">Relatórios &gt; Dashboard de Integração RM</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Dashboard de Integração RM</h1>
          <p className="text-muted-foreground text-sm">
            Visão geral do processo de criação de requisições e integração com o RM.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="rounded-lg border border-border/50 bg-card px-3 py-2">
            <div className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <CalendarDays className="size-3.5" /> Período
            </div>
            <div className="flex items-center gap-2">
              <Input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} className="h-8 w-36" />
              <span className="text-muted-foreground text-xs">a</span>
              <Input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} className="h-8 w-36" />
            </div>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" onClick={() => data && exportCsv(data)} disabled={!data || loading}>
            <Download className="size-4" /> Exportar
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <KpiCard icon={FileSpreadsheet} label="Solicitações criadas" value={data?.kpis.solicitacoesCriadas ?? 0} sub="Total no período" tone="violet" />
        <KpiCard icon={BriefcaseBusiness} label="Vagas vinculadas" value={data?.kpis.vagasVinculadas ?? 0} sub={`${pct(data?.kpis.percentualVagasVinculadas ?? 0)} do total`} tone="green" />
        <KpiCard icon={CheckCircle2} label="Integrações concluídas" value={data?.kpis.integracoesConcluidas ?? 0} sub={`${pct(data?.kpis.percentualIntegracoesConcluidas ?? 0)} do total`} tone="emerald" />
        <KpiCard icon={XCircle} label="Falhas na integração" value={data?.kpis.falhasIntegracao ?? 0} sub={`${pct(data?.kpis.percentualFalhas ?? 0)} do total`} tone="red" />
        <KpiCard icon={Clock3} label="Tempo médio total" value={data?.kpis.tempoMedioTotal ?? "00:00:00"} sub="Do início à integração" tone="purple" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Solicitações por status">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <DonutChart segments={donut} total={data?.kpis.solicitacoesCriadas ?? 0} />
            <div className="space-y-2">
              {(data?.solicitacoesPorStatus ?? []).map((item, idx) => (
                <Legend key={item.label} color={STATUS_COLORS[idx % STATUS_COLORS.length]} label={item.label} value={`${item.total} (${pct(item.percentual)})`} />
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Integrações por dia" className="lg:col-span-1">
          <LineChart points={data?.integracoesPorDia ?? []} max={maxIntegracoesDia} valueKey="integradas" color="#4f22d8" />
          <div className="mt-2 text-center text-xs text-muted-foreground">Integrações concluídas</div>
        </Panel>

        <Panel title="Falhas por motivo">
          <HorizontalBars items={data?.falhasPorMotivo ?? []} color="bg-red-500" emptyText="Nenhuma falha no período." />
        </Panel>

        <Panel title="Vagas criadas por unidade">
          <HorizontalBars items={data?.vagasCriadasPorUnidade ?? []} color="bg-violet-700" emptyText="Nenhuma vaga vinculada no período." />
        </Panel>

        <Panel title="Tempo médio por etapa">
          <div className="space-y-3">
            {(data?.tempoMedioPorEtapa ?? []).map((item, idx) => (
              <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                    {idx + 1}
                  </span>
                  <span className="font-medium">{item.label}</span>
                </div>
                <span className="font-mono text-sm">{item.tempoMedio}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Taxa de sucesso por período">
          <LineChart points={data?.taxaSucessoPorPeriodo ?? []} max={100} valueKey="taxaSucesso" color="#22c55e" suffix="%" fill />
          <div className="mt-2 text-center text-xs text-muted-foreground">Taxa de sucesso (%)</div>
        </Panel>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50 p-4 text-sm text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/25 dark:text-violet-100">
        <AlertCircle className="size-5 shrink-0 text-violet-700 dark:text-violet-300" />
        <div>
          <div className="font-semibold">Dados atualizados em {formatDateTime(data?.atualizadoEmUtc)}</div>
          <div className="text-violet-900/75 dark:text-violet-100/75">
            As informações são baseadas nas solicitações de aumento de quadro e nas tentativas de integração realizadas no período selecionado.
          </div>
        </div>
      </div>
    </section>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  sub: string;
  tone: "violet" | "green" | "emerald" | "red" | "purple";
}) {
  const palette = {
    violet: "bg-violet-100 text-violet-700",
    green: "bg-green-100 text-green-700",
    emerald: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    purple: "bg-purple-100 text-purple-700",
  }[tone];

  return (
    <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <div className={`rounded-full p-2.5 ${palette}`}>
          <Icon className="size-5" />
        </div>
        <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      </div>
      <div className="text-3xl font-bold tracking-tight">{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</div>
      <div className="mt-1 text-xs font-medium text-muted-foreground">{sub}</div>
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border/40 bg-card p-4 shadow-sm ${className}`}>
      <h2 className="mb-4 text-sm font-bold">{title}</h2>
      {children}
    </div>
  );
}

function HorizontalBars({ items, color, emptyText }: { items: BarItem[]; color: string; emptyText: string }) {
  if (items.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground">{emptyText}</div>;
  }

  const max = Math.max(1, ...items.map((x) => x.total));
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[minmax(110px,1fr)_2fr_auto] items-center gap-3 text-xs">
          <div className="truncate text-right font-medium" title={item.label}>{item.label}</div>
          <div className="h-4 overflow-hidden rounded bg-muted">
            <div className={`h-full rounded ${color}`} style={{ width: `${Math.max(6, (item.total / max) * 100)}%` }} />
          </div>
          <div className="w-20 font-semibold">{item.total} ({pct(item.percentual)})</div>
        </div>
      ))}
    </div>
  );
}

function buildDonut(items: SliceItem[]) {
  let acc = 0;
  const total = items.reduce((sum, x) => sum + x.total, 0);
  if (total <= 0) return [];
  return items.map((item, idx) => {
    const value = item.total / total;
    const start = acc;
    acc += value;
    return { ...item, color: STATUS_COLORS[idx % STATUS_COLORS.length], start, end: acc };
  });
}

function DonutChart({ segments, total }: { segments: Array<SliceItem & { color: string; start: number; end: number }>; total: number }) {
  if (segments.length === 0) {
    return <div className="flex size-36 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground">Sem dados</div>;
  }

  const gradient = segments
    .map((s) => `${s.color} ${s.start * 100}% ${s.end * 100}%`)
    .join(", ");

  return (
    <div
      className="relative flex size-36 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${gradient})` }}
    >
      <div className="flex size-20 flex-col items-center justify-center rounded-full bg-card shadow-inner">
        <div className="text-2xl font-bold">{total}</div>
        <div className="text-xs text-muted-foreground">Total</div>
      </div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}

function LineChart({
  points,
  max,
  valueKey,
  color,
  suffix = "",
  fill = false,
}: {
  points: DailyPoint[];
  max: number;
  valueKey: keyof Pick<DailyPoint, "integradas" | "taxaSucesso">;
  color: string;
  suffix?: string;
  fill?: boolean;
}) {
  const width = 520;
  const height = 180;
  const pad = 24;
  const safeMax = Math.max(1, max);
  const step = points.length <= 1 ? 0 : (width - pad * 2) / (points.length - 1);
  const coords = points.map((p, idx) => {
    const raw = Number(p[valueKey] ?? 0);
    return {
      x: pad + idx * step,
      y: height - pad - (raw / safeMax) * (height - pad * 2),
      value: raw,
      label: formatDate(p.data),
    };
  });
  const d = coords.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = coords.length > 0
    ? `${d} L ${coords[coords.length - 1].x} ${height - pad} L ${coords[0].x} ${height - pad} Z`
    : "";

  if (points.length === 0) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Sem dados no período.</div>;
  }

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={pad}
            x2={width - pad}
            y1={pad + t * (height - pad * 2)}
            y2={pad + t * (height - pad * 2)}
            stroke="currentColor"
            className="text-border"
            strokeWidth="1"
          />
        ))}
        {fill && <path d={area} fill={color} opacity="0.14" />}
        <path d={d} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((p) => (
          <g key={`${p.x}-${p.y}`}>
            <circle cx={p.x} cy={p.y} r="4" fill={color} />
            <title>{`${p.label}: ${p.value}${suffix}`}</title>
          </g>
        ))}
        {coords.map((p, idx) => (
          <text key={p.label} x={p.x} y={height - 4} textAnchor={idx === 0 ? "start" : idx === coords.length - 1 ? "end" : "middle"} className="fill-muted-foreground text-[11px]">
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

