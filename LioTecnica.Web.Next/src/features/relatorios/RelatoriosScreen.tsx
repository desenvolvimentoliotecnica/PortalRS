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

const BASE = "/app";
const REPORTS_API_BASE = `${BASE}/Relatorios/_api`;

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
    if (list.length) return [{ code: "all", text: "Origem: todas" }, ...list];
    return [
      { code: "all", text: "Origem: todas" },
      { code: "email", text: "Email" },
      { code: "pasta", text: "Pasta" },
      { code: "upload", text: "Upload" },
    ] satisfies EnumOption[];
  }, [enums]);

  const statusOptions = useMemo(() => {
    const list = enumOptions(enums, "inboxStatusFilterSimple");
    if (list.length) return [{ code: "all", text: "Status: todos" }, ...list];
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
    <section className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Relatórios</h4>
          <div className="text-muted-foreground text-sm">Relatórios operacionais e gerenciais</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn-ghost"
            type="button"
            onClick={() => {
              setLoading(true);
              void loadCatalogAndVagas()
                .then(async () => {
                  await loadCurrentReport();
                  toast.success("Relatórios atualizados.");
                })
                .catch(() => toast.error("Falha ao atualizar relatórios."))
                .finally(() => setLoading(false));
            }}
          >
            <RefreshCcw className="size-4" />
            <span className="ml-1">Atualizar</span>
          </button>

          <button
            className="btn-ghost"
            type="button"
            onClick={() => {
              try {
                downloadCsv(reportId, data.headers, data.rows);
                toast.success("Exportação iniciada.");
              } catch {
                toast.error("Falha ao exportar CSV.");
              }
            }}
          >
            <Download className="size-4" />
            <span className="ml-1">Exportar CSV</span>
          </button>

          <button
            className="btn-brand"
            type="button"
            onClick={() => {
              void loadCurrentReport().catch(() => toast.error("Falha ao gerar relatório."));
            }}
          >
            <PlayCircle className="size-4" />
            <span className="ml-1">Gerar</span>
          </button>
        </div>
      </div>

      {/* ── Two‑column layout: Catalog | Report ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[280px_1fr]">

        {/* ── LEFT: Catálogo de relatórios ── */}
        <div className="card-soft p-3 self-start">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="fw-bold">Catálogo de relatórios</div>
              <div className="text-muted-foreground text-sm">Selecione um relatório e configure filtros.</div>
            </div>
            {loading ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
          </div>
          <hr className="my-3 divider" />

          <div className="grid gap-2">
            {(catalog.length ? catalog : [{ id: reportId, icon: "bar-chart", title: reportTitleById(reportId), desc: reportDescById(reportId), scope: "relatórios" }]).map(
              (r) => {
                const Icon = iconForCatalog(r.icon);
                const active = r.id === reportId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={active ? "tile active text-start" : "tile text-start"}
                    onClick={() => {
                      setReportId(r.id);
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="iconbox">
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="fw-bold truncate">{r.title}</div>
                        <div className="text-muted-foreground text-sm truncate">{r.desc}</div>
                      </div>
                    </div>
                  </button>
                );
              },
            )}
          </div>
        </div>

        {/* ── RIGHT: Report detail ── */}
        <div className="space-y-3 min-w-0">
          <div className="card-soft p-3">
            {/* Report title + tags */}
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="fw-bold text-base">{activeReport?.title || reportTitleById(reportId)}</div>
                <div className="text-muted-foreground text-sm">{activeReport?.desc || reportDescById(reportId) || "Selecione um relatório no catálogo."}</div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <span className="tag">
                  <Filter className="size-4" /> {activeReport?.scope || "escopo"}
                </span>
                <span className="tag ok">
                  <Clock className="size-4" /> atual
                </span>
              </div>
            </div>

            <hr className="my-3 divider" />

            {/* ── Inline filters ── */}
            <div className="flex flex-wrap items-end gap-2 mb-3">
              <div className="min-w-[120px] flex-1">
                <label className="form-label small">Período</label>
                <select className="form-select" value={filters.period} onChange={(e) => setFilters((p) => ({ ...p, period: e.target.value }))}>
                  {periodOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.text}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[160px] flex-[2]">
                <label className="form-label small">Vaga</label>
                <select className="form-select" value={filters.vaga} onChange={(e) => setFilters((p) => ({ ...p, vaga: e.target.value }))}>
                  {vagaOptions.map((opt) => (
                    <option key={`${opt.kind}:${opt.value}`} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[120px] flex-1">
                <label className="form-label small">Origem</label>
                <select className="form-select" value={filters.origem} onChange={(e) => setFilters((p) => ({ ...p, origem: e.target.value }))}>
                  {origemOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.text}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[120px] flex-1">
                <label className="form-label small">Status</label>
                <select className="form-select" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
                  {statusOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.text}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[140px] flex-1">
                <label className="form-label small">Buscar</label>
                <input className="form-control" value={filters.q} onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))} placeholder="Nome, email..." />
              </div>

              <div className="flex gap-2 shrink-0">
                <button
                  className="btn-brand px-3 py-2"
                  type="button"
                  onClick={() => {
                    void loadCurrentReport().catch(() => toast.error("Falha ao aplicar filtros."));
                  }}
                >
                  <Filter className="size-4" />
                  <span className="ml-1">Aplicar</span>
                </button>
                <button
                  className="btn-ghost px-3 py-2"
                  type="button"
                  onClick={() => {
                    const next = { period: "30d", vaga: vagaAll || "all", origem: "all", status: "all", q: "" };
                    setFilters(next);
                    void loadCurrentReport(next).catch(() => toast.error("Falha ao limpar filtros."));
                  }}
                >
                  <Clock className="size-4" />
                  <span className="ml-1">Limpar</span>
                </button>
              </div>
            </div>

            {/* ── Chart ── */}
            <div className="chart-wrap mb-3 relative">
              <canvas ref={chartCanvasRef} style={{ width: "100%", height: "100%" }} />
              {loading ? (
                <div className="absolute inset-0 grid place-items-center bg-white/40 backdrop-blur-[2px] rounded-[18px]">
                  <div className="badge-soft flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Carregando
                  </div>
                </div>
              ) : null}
            </div>

            {/* ── Results table ── */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="mini-title">Resultados</div>
              <div className="flex gap-2 flex-wrap">
                <span className="pill">{data.rows.length} linhas</span>
                <span className="pill">exportável</span>
              </div>
            </div>

            <div className="table-responsive mt-2">
              <table className="table">
                <thead>
                  <tr>
                    {(data.headers.length ? data.headers : ["—"]).map((h, idx) => (
                      <th key={`${idx}:${h}`} style={{ whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={Math.max(1, data.headers.length)} className="text-center text-muted py-4">
                        Carregando…
                      </td>
                    </tr>
                  ) : data.rows.length ? (
                    data.rows.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => {
                          if (cell == null) return <td key={cIdx} />;
                          if (typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean") return <td key={cIdx}>{String(cell)}</td>;
                          const cls = (cell.className ?? "").trim();
                          return (
                            <td key={cIdx} className={cls || undefined}>
                              {cell.text == null ? "" : String(cell.text)}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={Math.max(1, data.headers.length)} className="text-center text-muted py-4">
                        Nenhum registro atende o filtro atual.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="text-muted-foreground text-sm mt-3">{hint}</div>
          </div>

          {catalog.length === 0 ? (
            <div className="card-soft p-3">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="size-4 text-amber-600" />
                <span>Catálogo não carregou; usando fallback local.</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

