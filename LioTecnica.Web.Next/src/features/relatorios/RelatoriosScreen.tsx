"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Clock,
  Download,
  Filter,
  Loader2,
  PlayCircle,
  RefreshCcw,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";

const BASE = "/app";
const REPORTS_API_BASE = `/api/reports`;

type EnumOption = { code: string; text: string };
type EnumsByKey = Record<string, EnumOption[]>;

type ReportCatalogItem = {
  id: string;
  icon: string;
  title: string;
  desc: string;
  scope: string;
};

type VagaLookup = { id: string; titulo: string; codigo?: string | null };

type ReportCell =
  | string
  | number
  | boolean
  | null
  | {
    text?: string | number | null;
    className?: string | null;
    icon?: string | null;
  };

type ReportPayload = {
  labels?: unknown;
  values?: unknown;
  headers?: unknown;
  rows?: unknown;
};

type ReportData = {
  labels: string[];
  values: number[];
  headers: string[];
  rows: ReportCell[][];
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickString(v: unknown, fallback = "") {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}

function pickNumber(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP_${res.status}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function mapCatalog(payload: unknown): ReportCatalogItem[] {
  const arr = Array.isArray(payload) ? (payload as unknown[]) : [];
  return arr
    .map((x) => {
      const r = asRecord(x) ?? {};
      const id = pickString(r.id, "").trim();
      if (!id) return null;
      return {
        id,
        icon: pickString(r.icon, "bar-chart").trim(),
        title: pickString(r.title, id).trim(),
        desc: pickString(r.desc, "").trim(),
        scope: pickString(r.scope, "").trim(),
      };
    })
    .filter(Boolean) as ReportCatalogItem[];
}

function mapVagas(payload: unknown): VagaLookup[] {
  const arr = Array.isArray(payload) ? (payload as unknown[]) : [];
  return arr
    .map((x) => {
      const r = asRecord(x) ?? {};
      const id = pickString(r.id, "").trim();
      if (!id) return null;
      return {
        id,
        titulo: pickString(r.titulo, "").trim(),
        codigo: pickString(r.codigo, "").trim() || null,
      };
    })
    .filter(Boolean) as VagaLookup[];
}

function normalizeEnumCode(code: unknown) {
  return (code ?? "").toString().trim().toLowerCase();
}

function enumOptions(enums: EnumsByKey | null, key: string): EnumOption[] {
  const list = enums?.[key];
  return Array.isArray(list) ? list : [];
}

function defaultEnumCode(enums: EnumsByKey | null, key: string, fallback: string) {
  return enumOptions(enums, key)[0]?.code ?? fallback;
}

function iconForCatalog(raw: string) {
  const k = (raw || "").toString().trim().toLowerCase();
  if (k.includes("briefcase")) return Briefcase;
  if (k.includes("people") || k.includes("users")) return Users;
  if (k.includes("exclamation")) return AlertTriangle;
  if (k.includes("stars") || k.includes("spark")) return Sparkles;
  if (k.includes("graph") || k.includes("trend")) return TrendingUp;
  if (k.includes("bar-chart") || k.includes("bar")) return BarChart3;
  return BarChart3;
}

function mapPayloadToReportData(payload: unknown): ReportData {
  const p = asRecord(payload) ?? ({} as ReportPayload);

  const labelsRaw = Array.isArray(p.labels) ? (p.labels as unknown[]) : [];
  const valuesRaw = Array.isArray(p.values) ? (p.values as unknown[]) : [];
  const headersRaw = Array.isArray(p.headers) ? (p.headers as unknown[]) : [];
  const rowsRaw = Array.isArray(p.rows) ? (p.rows as unknown[]) : [];

  const labels = labelsRaw.map((x) => pickString(x, "")).filter(Boolean);
  const values = valuesRaw.map((x) => clamp(pickNumber(x, 0), 0, Number.MAX_SAFE_INTEGER));
  const headers = headersRaw.map((x) => pickString(x, "")).filter(Boolean);

  const rows: ReportCell[][] = rowsRaw
    .map((row) => (Array.isArray(row) ? (row as unknown[]) : []))
    .map((row) =>
      row.map((cell) => {
        if (cell == null) return null;
        if (typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean") return cell;
        const r = asRecord(cell);
        if (!r) return pickString(cell, "");
        return {
          text: r.text == null ? null : (r.text as string | number),
          className: pickString(r.className, "").trim() || null,
          icon: pickString(r.icon, "").trim() || null,
        };
      }),
    );

  return { labels, values, headers, rows };
}

function buildQueryString(args: {
  period: string;
  vaga: string;
  vagaAll: string;
  origem: string;
  status: string;
  q: string;
}) {
  const qs = new URLSearchParams();
  if (args.period) qs.set("period", args.period);
  if (args.vaga && args.vaga !== args.vagaAll) qs.set("vagaId", args.vaga);
  if (args.origem && args.origem !== "all") qs.set("origem", args.origem);
  if (args.status && args.status !== "all") qs.set("status", args.status);
  if (args.q) qs.set("q", args.q);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

function reportEndpoint(reportId: string) {
  switch (reportId) {
    case "r1":
      return "entrada-origem";
    case "r2":
      return "falhas-processamento";
    case "r3":
      return "pipeline-status";
    case "r4":
      return "funil-vaga";
    case "r5":
      return "ranking-matching";
    case "r6":
      return "sla-vaga";
    default:
      return "entrada-origem";
  }
}

function periodLabel(code: string) {
  const p = (code || "").trim().toLowerCase();
  if (p === "7d") return "7 dias";
  if (p === "30d") return "30 dias";
  if (p === "90d") return "90 dias";
  if (p === "ytd") return "YTD";
  return code || "—";
}

function reportTitleById(reportId: string) {
  const r = (reportId || "").trim().toLowerCase();
  if (r === "r1") return "Entrada por Origem";
  if (r === "r2") return "Falhas de Processamento";
  if (r === "r3") return "Pipeline RH (Status)";
  if (r === "r4") return "Funil por Vaga";
  if (r === "r5") return "Ranking de Matching";
  if (r === "r6") return "SLA por Vaga";
  return "Relatório";
}

function reportDescById(reportId: string) {
  const r = (reportId || "").trim().toLowerCase();
  if (r === "r1") return "Quantidade por origem no período.";
  if (r === "r2") return "Falhas e causas no processamento.";
  if (r === "r3") return "Distribuição por status no pipeline.";
  if (r === "r4") return "Funil por vaga e estágio.";
  if (r === "r5") return "Top candidatos por match (ranking).";
  if (r === "r6") return "SLA agregado por recrutador e área.";
  return "";
}

function mapSlaToUnifiedData(payload: unknown): ReportData {
  const r = asRecord(payload) ?? {};
  const porRecrutador = Array.isArray(r.porRecrutador) ? (r.porRecrutador as unknown[]) : [];
  const porArea = Array.isArray(r.porArea) ? (r.porArea as unknown[]) : [];

  const toGroup = (x: unknown) => {
    const rr = asRecord(x) ?? {};
    return {
      grupoNome: pickString(rr.grupoNome, "—"),
      total: pickNumber(rr.total, 0),
      dentroSla: pickNumber(rr.dentroSla, 0),
      foraSla: pickNumber(rr.foraSla, 0),
      mediaDias: rr.mediaDias == null ? null : pickNumber(rr.mediaDias, 0),
    };
  };

  const rec = porRecrutador.map(toGroup);
  const area = porArea.map(toGroup);

  const rowsRec: ReportCell[][] = rec.map((x) => [
    { text: x.grupoNome },
    { text: String(x.total), className: "fw-semibold" },
    { text: String(x.dentroSla), className: "text-green-700 font-semibold" },
    { text: String(x.foraSla), className: "text-red-600 font-semibold" },
    { text: x.mediaDias != null ? x.mediaDias.toFixed(1) : "—" },
  ]);

  const rowsArea: ReportCell[][] = area.map((x) => [
    { text: x.grupoNome },
    { text: String(x.total), className: "fw-semibold" },
    { text: String(x.dentroSla), className: "text-green-700 font-semibold" },
    { text: String(x.foraSla), className: "text-red-600 font-semibold" },
    { text: x.mediaDias != null ? x.mediaDias.toFixed(1) : "—" },
  ]);

  const separator: ReportCell[][] = area.length
    ? [[{ text: "— Por área —", className: "border-top fw-semibold" }, { text: "" }, { text: "" }, { text: "" }, { text: "" }]]
    : [];

  return {
    labels: rec.map((x) => x.grupoNome),
    values: rec.map((x) => x.total),
    headers: ["Recrutador / Área", "Total", "Dentro SLA", "Fora SLA", "Média (dias)"],
    rows: rowsRec.concat(separator).concat(rowsArea),
  };
}

function csvText(cell: ReportCell) {
  if (cell == null) return "";
  if (typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean") return String(cell).trim();
  return String(cell.text ?? "").trim();
}

function downloadCsv(reportId: string, headers: string[], rows: ReportCell[][]) {
  const csv = [
    headers.map((h) => `"${String(h).replaceAll('"', '""')}"`).join(";"),
    ...rows.map((r) => r.map((c) => `"${csvText(c).replaceAll('"', '""')}"`).join(";")),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio_${reportId || "r"}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function RelatoriosScreen({ initialCatalog, initialVagas }: { initialCatalog: unknown; initialVagas: unknown }) {
  const [catalog, setCatalog] = useState<ReportCatalogItem[]>(() => mapCatalog(initialCatalog));
  const [vagas, setVagas] = useState<VagaLookup[]>(() => mapVagas(initialVagas));

  const [enums, setEnums] = useState<EnumsByKey | null>(null);

  const vagaAll = useMemo(() => defaultEnumCode(enums, "vagaFilterSimple", "all"), [enums]);

  const [reportId, setReportId] = useState<string>(() => (mapCatalog(initialCatalog)[0]?.id ?? "r1"));
  const [filters, setFilters] = useState<{ period: string; vaga: string; origem: string; status: string; q: string }>(() => ({
    period: "30d",
    vaga: vagaAll || "all",
    origem: "all",
    status: "all",
    q: "",
  }));

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReportData>(() => ({ labels: [], values: [], headers: [], rows: [] }));

  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const activeReport = useMemo(() => catalog.find((x) => x.id === reportId) ?? null, [catalog, reportId]);

  const periodOptions = useMemo(() => {
    const list = enumOptions(enums, "relatorioPeriodo");
    if (list.length) return list;
    return [
      { code: "7d", text: "Últimos 7 dias" },
      { code: "30d", text: "Últimos 30 dias" },
      { code: "90d", text: "Últimos 90 dias" },
      { code: "ytd", text: "Ano atual (YTD)" },
    ] satisfies EnumOption[];
  }, [enums]);

  const origemOptions = useMemo(() => {
    const list = enumOptions(enums, "origemFilterSimple");
    if (list.length) {
      const hasAll = list.some(x => normalizeEnumCode(x.code) === "all");
      return hasAll ? list : [{ code: "all", text: "Origem: todas" }, ...list];
    }
    return [
      { code: "all", text: "Origem: todas" },
      { code: "email", text: "Email" },
      { code: "pasta", text: "Pasta" },
      { code: "upload", text: "Upload" },
    ] satisfies EnumOption[];
  }, [enums]);

  const statusOptions = useMemo(() => {
    const list = enumOptions(enums, "inboxStatusFilterSimple");
    if (list.length) {
      const hasAll = list.some(x => normalizeEnumCode(x.code) === "all");
      return hasAll ? list : [{ code: "all", text: "Status: todos" }, ...list];
    }
    return [
      { code: "all", text: "Status: todos" },
      { code: "novo", text: "Novo" },
      { code: "processando", text: "Processando" },
      { code: "processado", text: "Processado" },
      { code: "falha", text: "Falha" },
      { code: "descartado", text: "Descartado" },
    ] satisfies EnumOption[];
  }, [enums]);

  const vagaOptions = useMemo(() => {
    const top = enumOptions(enums, "vagaFilterSimple");
    const items: { value: string; label: string; kind: "enum" | "vaga" }[] = [];
    if (top.length) {
      for (const opt of top) items.push({ value: opt.code, label: opt.text, kind: "enum" });
    } else {
      items.push({ value: "all", label: "Todas", kind: "enum" });
    }
    const sorted = vagas
      .slice()
      .sort((a, b) => (a.titulo || "").localeCompare(b.titulo || "", "pt-BR"))
      .map((v) => ({ value: v.id, label: v.codigo ? `${v.titulo} (${v.codigo})` : v.titulo, kind: "vaga" as const }));
    return items.concat(sorted);
  }, [enums, vagas]);

  useEffect(() => {
    void fetchJson<unknown>(`${BASE}/api/lookup/enums`)
      .then((payload) => {
        const r = asRecord(payload) ?? {};
        setEnums(r as EnumsByKey);
      })
      .catch(() => {
        // sem enums: UI continua com fallbacks
      });
  }, []);

  useEffect(() => {
    setFilters((prev) => {
      const nextVaga = prev.vaga || vagaAll || "all";
      return prev.vaga === nextVaga ? prev : { ...prev, vaga: nextVaga };
    });
  }, [vagaAll]);

  useEffect(() => {
    const ctx = chartCanvasRef.current;
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.data.labels = data.labels;
      chartRef.current.data.datasets[0]!.data = data.values;
      chartRef.current.update();
      return;
    }

    chartRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels: data.labels,
        datasets: [
          {
            label: "Total",
            data: data.values,
            borderRadius: 12,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: "rgba(16,82,144,.10)" }, ticks: { precision: 0 } },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.labels.join("|"), data.values.join("|")]);

  async function loadCatalogAndVagas() {
    const [c, v] = await Promise.all([
      fetchJson<unknown>(`${REPORTS_API_BASE}/catalog`),
      fetchJson<unknown>(`${REPORTS_API_BASE}/vagas`),
    ]);
    setCatalog(mapCatalog(c));
    setVagas(mapVagas(v));
  }

  async function loadCurrentReport(overrides?: Partial<typeof filters> & { reportId?: string }) {
    const rid = overrides?.reportId ?? reportId;
    const next = { ...filters, ...(overrides ?? {}) };

    const endpoint = reportEndpoint(rid);
    const qs = buildQueryString({
      period: next.period,
      vaga: next.vaga,
      vagaAll,
      origem: next.origem,
      status: next.status,
      q: next.q.trim(),
    });

    const url =
      endpoint === "ranking-matching"
        ? `${REPORTS_API_BASE}/${endpoint}${qs}${qs ? "&" : "?"}take=12`
        : `${REPORTS_API_BASE}/${endpoint}${qs}`;

    setLoading(true);
    try {
      const payload = await fetchJson<unknown>(url, { headers: { "X-LT-Silent": "1" } });
      const nextData = endpoint === "sla-vaga" ? mapSlaToUnifiedData(payload) : mapPayloadToReportData(payload);
      setData(nextData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCatalogAndVagas().catch(() => { /* silent */ });
    void loadCurrentReport().catch(() => {
      toast.error("Falha ao carregar relatório.");
      setData({ labels: [], values: [], headers: [], rows: [] });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadCurrentReport({ reportId }).catch(() => {
      toast.error("Falha ao carregar relatório.");
      setData({ labels: [], values: [], headers: [], rows: [] });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const hint = useMemo(() => {
    const pl = periodLabel(filters.period);
    const vagaTxt = normalizeEnumCode(filters.vaga) === normalizeEnumCode(vagaAll) ? "todas" : "filtrada";
    return `Período: ${pl} • Vaga: ${vagaTxt} • Origem/Status: conforme filtros.`;
  }, [filters.period, filters.vaga, vagaAll]);

  return (
    <section className="space-y-3">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Relatórios</h4>
          <p className="text-muted-foreground text-sm">Relatórios operacionais e gerenciais</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setLoading(true); void loadCatalogAndVagas().then(async () => { await loadCurrentReport(); toast.success("Atualizado."); }).catch(() => toast.error("Falha.")).finally(() => setLoading(false)); }}>
            <RefreshCcw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => { try { downloadCsv(reportId, data.headers, data.rows); toast.success("CSV exportado."); } catch { toast.error("Falha."); } }}>
            <Download className="size-4" /><span className="hidden sm:inline ml-1">CSV</span>
          </Button>
          <Button size="sm" onClick={() => { void loadCurrentReport().catch(() => toast.error("Falha.")); }}>
            <PlayCircle className="size-4" /><span className="ml-1">Gerar</span>
          </Button>
        </div>
      </div>

      {/* ── Filters (full-width above grid — matches Razor) ── */}
      <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div className="font-semibold text-sm">Filtros</div>
            <div className="text-muted-foreground text-xs">Os filtros alteram a tabela/gráfico do relatório selecionado.</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { void loadCurrentReport().catch(() => toast.error("Falha.")); }}>
              <Filter className="size-3.5 mr-1" />Aplicar
            </Button>
            <Button variant="outline" size="sm" onClick={() => { const next = { period: "30d", vaga: vagaAll || "all", origem: "all", status: "all", q: "" }; setFilters(next); void loadCurrentReport(next).catch(() => toast.error("Falha.")); }}>
              Limpar
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Período</label>
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={filters.period} onChange={(e) => setFilters((p) => ({ ...p, period: e.target.value }))}>
              {periodOptions.map((o) => <option key={o.code} value={o.code}>{o.text}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Vaga</label>
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={filters.vaga} onChange={(e) => setFilters((p) => ({ ...p, vaga: e.target.value }))}>
              {vagaOptions.map((o) => <option key={`${o.kind}:${o.value}`} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Origem</label>
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={filters.origem} onChange={(e) => setFilters((p) => ({ ...p, origem: e.target.value }))}>
              {origemOptions.map((o, i) => <option key={`origem-${i}`} value={o.code}>{o.text}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
              {statusOptions.map((o, i) => <option key={`status-${i}`} value={o.code}>{o.text}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Buscar</label>
            <Input className="h-9" value={filters.q} onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))} placeholder="Nome, email..." />
          </div>
        </div>
      </div>

      {/* ── Two-column: Catalog | Report ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[240px_1fr]">

        {/* LEFT: Catálogo */}
        <div className="rounded-xl border border-border/40 bg-card/60 p-3 backdrop-blur self-start">
          <div className="font-semibold text-sm">Catálogo</div>
          <div className="text-muted-foreground text-xs mb-2">Selecione um relatório.</div>
          <div className="border-t border-border/20 my-2" />
          <div className="grid gap-1">
            {(catalog.length ? catalog : [{ id: reportId, icon: "bar-chart", title: reportTitleById(reportId), desc: reportDescById(reportId), scope: "relatórios" }]).map((r) => {
              const Icon = iconForCatalog(r.icon);
              const active = r.id === reportId;
              return (
                <button key={r.id} type="button" className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors ${active ? "bg-primary/10 text-primary ring-1 ring-primary/20" : "hover:bg-muted/50"}`} onClick={() => setReportId(r.id)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-xs truncate">{r.title}</div>
                      <div className="text-muted-foreground text-[11px] truncate">{r.desc}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Report (single card) */}
        <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur min-w-0 overflow-hidden">

          {/* Title row */}
          <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
            <div className="min-w-0">
              <div className="font-bold truncate">{activeReport?.title || reportTitleById(reportId)}</div>
              <div className="text-muted-foreground text-sm">{activeReport?.desc || reportDescById(reportId) || "Selecione um relatório."}</div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                <Filter className="size-3" />{activeReport?.scope || "escopo"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[11px] font-medium">
                <Clock className="size-3" />atual
              </span>
            </div>
          </div>

          {/* Chart — constrained height */}
          <div className="border-t border-border/20 pt-3 mb-3">
            <div className="relative" style={{ height: 180 }}>
              <canvas ref={chartCanvasRef} style={{ width: "100%", height: "100%" }} />
              {loading && (
                <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-[2px] rounded-lg">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" />Carregando</div>
                </div>
              )}
            </div>
          </div>

          {/* Results table */}
          <div className="border-t border-border/20 pt-3">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div className="font-semibold text-sm">Resultados</div>
              <div className="flex gap-1.5">
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{data.rows.length} linhas</span>
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium">exportável</span>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {(data.headers.length ? data.headers : ["—"]).map((h, i) => (
                      <TableHead key={`${i}:${h}`} className="whitespace-nowrap text-xs">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={Math.max(1, data.headers.length)} className="text-center text-muted-foreground py-6 text-sm">Carregando…</TableCell></TableRow>
                  ) : data.rows.length ? (
                    data.rows.map((row, ri) => (
                      <TableRow key={ri}>
                        {row.map((cell, ci) => {
                          if (cell == null) return <TableCell key={ci} />;
                          if (typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean") return <TableCell key={ci} className="text-sm">{String(cell)}</TableCell>;
                          return <TableCell key={ci} className={`text-sm ${(cell.className ?? "").trim()}`}>{cell.text == null ? "" : String(cell.text)}</TableCell>;
                        })}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={Math.max(1, data.headers.length)} className="text-center text-muted-foreground py-6 text-sm">Nenhum registro.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="text-muted-foreground text-xs mt-2">{hint}</div>
          </div>
        </div>
      </div>

      {catalog.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-sm text-amber-700 flex items-center gap-2">
          <AlertTriangle className="size-4" /><span>Catálogo não carregou; usando fallback local.</span>
        </div>
      )}
    </section>
  );
}
