"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Chart from "chart.js/auto";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Filter,
  Loader2,
  PlayCircle,
  Printer,
  RefreshCcw,
  Search,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
  X,
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
type LotacaoLookup = { id: string; description?: string | null };

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
  if (k.includes("people") || k.includes("users-round")) return Users;
  if (k.includes("users")) return Users;
  if (k.includes("exclamation")) return AlertTriangle;
  if (k.includes("stars") || k.includes("spark")) return Sparkles;
  if (k.includes("trending-down")) return TrendingDown;
  if (k.includes("trending-up") || k.includes("graph") || k.includes("trend")) return TrendingUp;
  if (k.includes("timer")) return Timer;
  if (k.includes("alarm") || k.includes("clock")) return Clock;
  if (k.includes("arrow-up-right")) return ArrowUpRight;
  if (k.includes("palm") || k.includes("ferias") || k.includes("calendar")) return CalendarDays;
  if (k.includes("bar-chart") || k.includes("bar") || k.includes("chart")) return BarChart3;
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

function mapLotacoes(payload: unknown): LotacaoLookup[] {
  const arr = Array.isArray(payload) ? (payload as unknown[]) : [];
  return arr
    .map((x) => {
      const r = asRecord(x) ?? {};
      const id = pickString(r.id, "").trim();
      if (!id) return null;
      return { id, description: pickString(r.description, "").trim() || null };
    })
    .filter(Boolean) as LotacaoLookup[];
}

function buildQueryString(args: {
  period: string;
  vagas: string[];
  origens: string[];
  statuses: string[];
  q: string;
  lotacaoIds?: string[];
  compareYear?: boolean;
}) {
  const qs = new URLSearchParams();
  if (args.period) qs.set("period", args.period);
  for (const v of args.vagas) qs.append("vagaId", v);
  for (const o of args.origens) qs.append("origem", o);
  for (const s of args.statuses) qs.append("status", s);
  if (args.q) qs.set("q", args.q);
  for (const id of (args.lotacaoIds ?? [])) qs.append("unidadeLotacaoId", id);
  if (args.compareYear) qs.set("compareYear", "true");
  const s = qs.toString();
  return s ? `?${s}` : "";
}

function reportEndpoint(reportId: string) {
  switch (reportId) {
    case "r1": return "entrada-origem";
    case "r2": return "falhas-processamento";
    case "r3": return "pipeline-status";
    case "r4": return "funil-vaga";
    case "r5": return "ranking-matching";
    case "r6": return "sla-vaga";
    case "r7": return "headcount-movimentacao";
    case "r8": return "turnover-retencao";
    case "r9": return "tth-contratacao";
    case "r10": return "headcount-plan-real";
    case "r11": return "piramide-etaria";
    case "r12": return "promocoes-salariais";
    case "r13": return "ferias-overview";
    default: return "entrada-origem";
  }
}

const HR_REPORT_IDS = new Set(["r7", "r8", "r9", "r10", "r11", "r12", "r13"]);
const HR_REPORTS_WITH_PERIOD = new Set(["r7", "r8", "r9", "r12", "r13"]);
const HR_REPORTS_WITH_COMPARE = new Set(["r7"]);

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
  if (r === "r7") return "Movimentação de Headcount";
  if (r === "r8") return "Turnover e Retenção";
  if (r === "r9") return "Tempo Médio de Contratação (TTH)";
  if (r === "r10") return "Headcount Plan vs. Real";
  if (r === "r11") return "Pirâmide Etária e Diversidade";
  if (r === "r12") return "Promoções e Movimentações";
  if (r === "r13") return "Relatório de Férias";
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
  if (r === "r7") return "Entradas, saídas, transferências e promoções no período.";
  if (r === "r8") return "Desligamentos voluntários vs. involuntários.";
  if (r === "r9") return "TTH por lotação, recrutador e tipo de contrato.";
  if (r === "r10") return "Posições estruturais vs. headcount ativo por lotação.";
  if (r === "r11") return "Distribuição por faixa etária e gênero.";
  if (r === "r12") return "Histórico de promoções aprovadas.";
  if (r === "r13") return "Férias solicitadas, aprovadas e gozadas por lotação.";
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

// ── Componentes de filtro reutilizáveis ─────────────────────────────────────

type SelectOption = { value: string; label: string };

/**
 * Hook: retorna o DOMRect do trigger e atualiza em scroll/resize.
 * Usado para posicionar dropdowns em portal (evita clipping por overflow/canvas).
 */
function useTriggerRect(triggerRef: React.RefObject<HTMLElement | null>, open: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!open) { setRect(null); return; }
    const update = () => {
      if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, triggerRef]);
  return rect;
}

/**
 * Fecha o dropdown ao clicar fora do trigger OU fora do portal dropdown.
 */
function useClickOutside(
  triggerRef: React.RefObject<HTMLElement | null>,
  dropdownRef: React.RefObject<HTMLElement | null>,
  handler: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const fn = (e: MouseEvent) => {
      const t = e.target as Node;
      const inTrigger = triggerRef.current?.contains(t) ?? false;
      const inDropdown = dropdownRef.current?.contains(t) ?? false;
      if (!inTrigger && !inDropdown) handler();
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [triggerRef, dropdownRef, handler, enabled]);
}

/** Multi-select simples com portal — para Origem e Status */
function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  className,
}: {
  options: SelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const rect = useTriggerRect(triggerRef, open);
  useClickOutside(triggerRef, dropdownRef, () => setOpen(false), open);

  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
      ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
      : `${selected.length} selecionados`;

  const dropdown = open && rect && (
    <div
      ref={dropdownRef}
      style={{ position: "fixed", top: rect.bottom + 4, left: rect.left, minWidth: rect.width, zIndex: 9999 }}
      className="rounded-md border border-border bg-popover shadow-lg overflow-hidden"
    >
      {options.map((o) => {
        const checked = selected.includes(o.value);
        return (
          <label key={o.value} className="flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-muted cursor-pointer select-none">
            <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${checked ? "bg-primary border-primary text-primary-foreground" : "border-input"}`}>
              {checked && <Check className="size-3" />}
            </span>
            {o.label}
          </label>
        );
      })}
    </div>
  );

  return (
    <div className={className ?? ""}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="h-9 w-full flex items-center justify-between gap-1 rounded-md border border-input bg-background px-2.5 text-sm text-left hover:border-ring transition-colors"
      >
        <span className="flex-1 truncate text-muted-foreground">{label}</span>
        {selected.length > 0 ? (
          <X className="size-3.5 shrink-0 opacity-50 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onChange([]); }} />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        )}
      </button>
      {typeof document !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}

/** Multi-select com busca e portal — para Vagas */
function ComboboxMulti({
  options,
  selected,
  onChange,
  placeholder,
  searchPlaceholder,
  className,
}: {
  options: SelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const rect = useTriggerRect(triggerRef, open);
  useClickOutside(triggerRef, dropdownRef, () => { setOpen(false); setQ(""); }, open);

  const filtered = useMemo(
    () => options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())),
    [options, q],
  );

  const toggle = (val: string) =>
    onChange(selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]);

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
      ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
      : `${selected.length} vagas`;

  const dropdown = open && rect && (
    <div
      ref={dropdownRef}
      style={{ position: "fixed", top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 288), zIndex: 9999 }}
      className="rounded-md border border-border bg-popover shadow-lg"
    >
      {/* busca */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={searchPlaceholder ?? "Buscar…"}
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
        />
        {q && <X className="size-3.5 shrink-0 text-muted-foreground cursor-pointer" onClick={() => setQ("")} />}
      </div>
      {/* lista */}
      <div className="max-h-52 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">Nenhum resultado.</p>
        ) : filtered.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <label key={o.value} className="flex items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-muted cursor-pointer select-none">
              <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${checked ? "bg-primary border-primary text-primary-foreground" : "border-input"}`}>
                {checked && <Check className="size-3" />}
              </span>
              <span className="truncate">{o.label}</span>
            </label>
          );
        })}
      </div>
      {/* rodapé */}
      {selected.length > 0 && (
        <div className="border-t border-border px-3 py-1.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{selected.length} selecionada(s)</span>
          <button type="button" onClick={() => onChange([])} className="text-xs text-primary hover:underline">Limpar</button>
        </div>
      )}
    </div>
  );

  return (
    <div className={className ?? ""}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="h-9 w-full flex items-center justify-between gap-1 rounded-md border border-input bg-background px-2.5 text-sm text-left hover:border-ring transition-colors"
      >
        <span className="flex-1 truncate text-muted-foreground">{label}</span>
        {selected.length > 0 ? (
          <X className="size-3.5 shrink-0 opacity-50 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onChange([]); }} />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        )}
      </button>
      {typeof document !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

export default function RelatoriosScreen({ initialCatalog, initialVagas }: { initialCatalog: unknown; initialVagas: unknown }) {
  const [catalog, setCatalog] = useState<ReportCatalogItem[]>(() => mapCatalog(initialCatalog));
  const [vagas, setVagas] = useState<VagaLookup[]>(() => mapVagas(initialVagas));
  const [lotacoes, setLotacoes] = useState<LotacaoLookup[]>([]);
  const [compareYear, setCompareYear] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [chartHeight, setChartHeight] = useState(180);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartH = useRef(0);

  const [enums, setEnums] = useState<EnumsByKey | null>(null);

  // vagaAll removido — multi-select usa array vazio como "todas"

  const [reportId, setReportId] = useState<string>(() => (mapCatalog(initialCatalog)[0]?.id ?? "r1"));
  const [filters, setFilters] = useState<{ period: string; vagas: string[]; origens: string[]; statuses: string[]; q: string; lotacaoIds: string[] }>(() => ({
    period: "30d",
    vagas: [],
    origens: [],
    statuses: [],
    q: "",
    lotacaoIds: [],
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

  const origemOptions = useMemo<SelectOption[]>(() => {
    const list = enumOptions(enums, "origemFilterSimple").filter(
      (x) => normalizeEnumCode(x.code) !== "all",
    );
    if (list.length) return list.map((x) => ({ value: x.code, label: x.text }));
    return [
      { value: "email", label: "Email" },
      { value: "pasta", label: "Pasta" },
      { value: "upload", label: "Upload" },
    ];
  }, [enums]);

  const statusOptions = useMemo<SelectOption[]>(() => {
    const list = enumOptions(enums, "inboxStatusFilterSimple").filter(
      (x) => normalizeEnumCode(x.code) !== "all",
    );
    if (list.length) return list.map((x) => ({ value: x.code, label: x.text }));
    return [
      { value: "novo", label: "Novo" },
      { value: "processando", label: "Processando" },
      { value: "processado", label: "Processado" },
      { value: "falha", label: "Falha" },
      { value: "descartado", label: "Descartado" },
    ];
  }, [enums]);

  const vagaOptions = useMemo<SelectOption[]>(() => {
    return vagas
      .slice()
      .sort((a, b) => (a.titulo || "").localeCompare(b.titulo || "", "pt-BR"))
      .map((v) => ({ value: v.id, label: v.codigo ? `${v.titulo} (${v.codigo})` : v.titulo }));
  }, [vagas]);

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

  // (useEffect de sync do vagaAll removido — não necessário com multi-select)

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

  // Notifica Chart.js quando o container muda de altura
  useEffect(() => {
    chartRef.current?.resize();
  }, [chartHeight]);

  async function loadCatalogAndVagas() {
    const [c, v, l] = await Promise.all([
      fetchJson<unknown>(`${REPORTS_API_BASE}/catalog`),
      fetchJson<unknown>(`${REPORTS_API_BASE}/vagas`),
      fetchJson<unknown>(`${REPORTS_API_BASE}/unidades-lotacao`).catch(() => [] as unknown),
    ]);
    setCatalog(mapCatalog(c));
    setVagas(mapVagas(v));
    setLotacoes(mapLotacoes(l));
  }

  async function loadCurrentReport(overrides?: Partial<typeof filters> & { reportId?: string }) {
    const rid = overrides?.reportId ?? reportId;
    const next = { ...filters, ...(overrides ?? {}) };

    const endpoint = reportEndpoint(rid);
    const isHrReport = HR_REPORT_IDS.has(rid);
    const qs = buildQueryString({
      period: next.period,
      vagas: isHrReport ? [] : (next.vagas ?? []),
      origens: isHrReport ? [] : (next.origens ?? []),
      statuses: isHrReport ? [] : (next.statuses ?? []),
      q: next.q.trim(),
      lotacaoIds: isHrReport ? (next.lotacaoIds ?? []) : [],
      compareYear: HR_REPORTS_WITH_COMPARE.has(rid) ? compareYear : undefined,
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
    if (HR_REPORT_IDS.has(reportId)) {
      const lotTxt = filters.lotacaoIds.length === 0
        ? "todas as lotações"
        : filters.lotacaoIds.length === 1
          ? (lotacoes.find((l) => l.id === filters.lotacaoIds[0])?.description ?? "lotação selecionada")
          : `${filters.lotacaoIds.length} lotações`;
      const compareTxt = compareYear ? " • Comparando com ano anterior." : "";
      return `Período: ${pl} • Lotação: ${lotTxt}${compareTxt}`;
    }
    const vagaTxt = filters.vagas.length === 0 ? "todas" : `${filters.vagas.length} selecionada(s)`;
    const origemTxt = filters.origens.length === 0 ? "todas" : filters.origens.join(", ");
    const statusTxt = filters.statuses.length === 0 ? "todos" : filters.statuses.join(", ");
    return `Período: ${pl} • Vaga: ${vagaTxt} • Origem: ${origemTxt} • Status: ${statusTxt}`;
  }, [filters.period, filters.vagas, filters.origens, filters.statuses, filters.lotacaoIds, reportId, lotacoes, compareYear]);

  function handleChartResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartH.current = chartHeight;

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const next = Math.max(80, Math.min(600, dragStartH.current + ev.clientY - dragStartY.current));
      setChartHeight(next);
    };
    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <section className="flex flex-col gap-3">
      {/* ── Estilos de impressão ── */}
      <style>{`
        @media print {
          /* oculta sidebar, topbar e qualquer elemento fora da seção de relatório */
          aside, nav, header, [data-sidebar], [data-topbar] { display: none !important; }
          /* remove fundo e sombra do card na impressão */
          .backdrop-blur { backdrop-filter: none !important; }
          /* tabela ocupa a página inteira */
          table { width: 100% !important; font-size: 11px; }
          th, td { padding: 4px 8px !important; }
          /* evita quebra dentro de linha */
          tr { break-inside: avoid; }
          /* remove scroll do container da tabela */
          .overflow-y-auto { overflow: visible !important; max-height: none !important; }
        }
      `}</style>
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">{activeReport?.title || reportTitleById(reportId)}</h4>
          <p className="text-muted-foreground text-sm print:hidden">Relatórios operacionais e gerenciais</p>
          <p className="hidden text-muted-foreground text-xs print:block">{hint}</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); void loadCatalogAndVagas().then(async () => { await loadCurrentReport(); toast.success("Atualizado."); }).catch(() => toast.error("Falha.")).finally(() => setLoading(false)); }}>
            <RefreshCcw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => { try { downloadCsv(reportId, data.headers, data.rows); toast.success("CSV exportado."); } catch { toast.error("Falha."); } }}>
            <Download className="size-4" /><span className="hidden sm:inline ml-1">CSV</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" /><span className="hidden sm:inline ml-1">Imprimir</span>
          </Button>
          <Button size="sm" onClick={() => { void loadCurrentReport().catch(() => toast.error("Falha.")); }}>
            <PlayCircle className="size-4" /><span className="ml-1">Gerar</span>
          </Button>
        </div>
      </div>


      {/* ── Two-column: Catalog | Report ── */}
      <div className="flex flex-1 min-h-0 gap-3 items-stretch min-h-[calc(100dvh-6rem)]">

        {/* LEFT: Catálogo — colapsável, oculto na impressão */}
        <div
          className={`print:hidden shrink-0 flex flex-col rounded-xl border border-border/40 bg-card/60 backdrop-blur overflow-hidden transition-[width,opacity] duration-200
            ${catalogOpen ? "w-72 opacity-100" : "w-10 opacity-100"}`}
        >
          {/* Cabeçalho do catálogo */}
          <div className={`flex items-center gap-2 p-3 ${catalogOpen ? "justify-between" : "justify-center"}`}>
            {catalogOpen && (
              <div className="min-w-0">
                <div className="font-semibold text-sm leading-tight">Catálogo</div>
                <div className="text-muted-foreground text-xs">Selecione um relatório.</div>
              </div>
            )}
            <button
              type="button"
              title={catalogOpen ? "Recolher catálogo" : "Expandir catálogo"}
              onClick={() => setCatalogOpen((p) => !p)}
              className="flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              {catalogOpen ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          </div>

          {/* Lista de relatórios (só visível quando expandido) */}
          {catalogOpen && (
            <>
              <div className="border-t border-border/20 mx-3" />
              <div className="flex-1 min-h-0 overflow-y-auto grid gap-1 p-3 pt-2 content-start">
                {(catalog.length
                  ? catalog
                  : [{ id: reportId, icon: "bar-chart", title: reportTitleById(reportId), desc: reportDescById(reportId), scope: "relatórios" }]
                ).map((r) => {
                  const Icon = iconForCatalog(r.icon);
                  const active = r.id === reportId;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors overflow-hidden ${active ? "bg-primary/10 text-primary ring-1 ring-primary/20" : "hover:bg-muted/50"}`}
                      onClick={() => setReportId(r.id)}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary mt-0.5">
                          <Icon className="size-3.5" />
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="font-medium text-xs break-words line-clamp-2">{r.title}</div>
                          <div className="text-muted-foreground text-[11px] break-words line-clamp-2 mt-0.5">{r.desc}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Ícones empilhados quando recolhido */}
          {!catalogOpen && (
            <div className="grid gap-1 px-1.5 pb-3">
              {(catalog.length
                ? catalog
                : [{ id: reportId, icon: "bar-chart", title: reportTitleById(reportId), desc: reportDescById(reportId), scope: "relatórios" }]
              ).map((r) => {
                const Icon = iconForCatalog(r.icon);
                const active = r.id === reportId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    title={r.title}
                    onClick={() => { setReportId(r.id); setCatalogOpen(true); }}
                    className={`flex size-7 mx-auto items-center justify-center rounded-md transition-colors ${active ? "bg-primary/10 text-primary ring-1 ring-primary/20" : "hover:bg-muted/50 text-muted-foreground"}`}
                  >
                    <Icon className="size-3.5" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT: Relatório */}
        <div className="flex-1 min-w-0 flex flex-col rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur print:border-0 print:p-0 print:bg-transparent print:shadow-none">

          {/* Title row */}
          <div className="flex flex-wrap items-start justify-between gap-2 mb-3 print:mb-4">
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="font-bold break-words line-clamp-2 print:text-lg">{activeReport?.title || reportTitleById(reportId)}</div>
              <div className="text-muted-foreground text-sm break-words line-clamp-2">{activeReport?.desc || reportDescById(reportId) || "Selecione um relatório."}</div>
            </div>
            <div className="flex gap-1.5 shrink-0 print:hidden">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                <Filter className="size-3" />{activeReport?.scope || "escopo"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[11px] font-medium">
                <Clock className="size-3" />atual
              </span>
            </div>
          </div>

          {/* ── Filtros do relatório selecionado ── */}
          <div className="border-t border-border/20 pt-3 pb-3 print:hidden">
            <div className="flex flex-wrap gap-x-3 gap-y-2 items-end">

              {/* Período — todos os relatórios */}
              {(
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Período</label>
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-[140px]"
                    value={filters.period}
                    onChange={(e) => setFilters((p) => ({ ...p, period: e.target.value }))}
                  >
                    {periodOptions.map((o) => <option key={o.code} value={o.code}>{o.text}</option>)}
                  </select>
                </div>
              )}

              {/* Vagas — só r1–r6 */}
              {!HR_REPORT_IDS.has(reportId) && (
                <div className="flex flex-col gap-1 min-w-[160px] flex-1 max-w-[260px]">
                  <label className="text-xs font-medium text-muted-foreground">Vagas</label>
                  <ComboboxMulti
                    options={vagaOptions}
                    selected={filters.vagas}
                    onChange={(v) => setFilters((p) => ({ ...p, vagas: v }))}
                    placeholder="Todas as vagas"
                    searchPlaceholder="Buscar vaga…"
                  />
                </div>
              )}

              {/* Origem — só r1–r6 */}
              {!HR_REPORT_IDS.has(reportId) && (
                <div className="flex flex-col gap-1 min-w-[120px]">
                  <label className="text-xs font-medium text-muted-foreground">Origem</label>
                  <MultiSelect
                    options={origemOptions}
                    selected={filters.origens}
                    onChange={(v) => setFilters((p) => ({ ...p, origens: v }))}
                    placeholder="Todas"
                  />
                </div>
              )}

              {/* Status — só r1–r6 */}
              {!HR_REPORT_IDS.has(reportId) && (
                <div className="flex flex-col gap-1 min-w-[120px]">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <MultiSelect
                    options={statusOptions}
                    selected={filters.statuses}
                    onChange={(v) => setFilters((p) => ({ ...p, statuses: v }))}
                    placeholder="Todos"
                  />
                </div>
              )}

              {/* Buscar — só r1–r6 */}
              {!HR_REPORT_IDS.has(reportId) && (
                <div className="flex flex-col gap-1 min-w-[140px] flex-1 max-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground">Buscar</label>
                  <Input
                    className="h-8"
                    value={filters.q}
                    onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))}
                    placeholder="Nome, email…"
                  />
                </div>
              )}

              {/* Unidade de Lotação — só r7–r13 */}
              {HR_REPORT_IDS.has(reportId) && (
                <div className="flex flex-col gap-1 min-w-[160px] flex-1 max-w-[280px]">
                  <label className="text-xs font-medium text-muted-foreground">Unidade de Lotação</label>
                  <ComboboxMulti
                    options={lotacoes.map((l) => ({ value: l.id, label: l.description || l.id }))}
                    selected={filters.lotacaoIds}
                    onChange={(v) => setFilters((p) => ({ ...p, lotacaoIds: v }))}
                    placeholder="Todas as lotações"
                    searchPlaceholder="Buscar lotação…"
                  />
                </div>
              )}

              {/* Comparar ano anterior — só r7 */}
              {HR_REPORTS_WITH_COMPARE.has(reportId) && (
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 cursor-pointer h-8 px-1 select-none text-sm">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-input accent-primary"
                      checked={compareYear}
                      onChange={(e) => setCompareYear(e.target.checked)}
                    />
                    Comparar ano anterior
                  </label>
                </div>
              )}

              {/* Aplicar / Limpar */}
              <div className="flex gap-2 items-end pb-0.5 ml-auto">
                <Button size="sm" className="h-8" onClick={() => { void loadCurrentReport().catch(() => toast.error("Falha.")); }}>
                  <Filter className="size-3.5 mr-1" />Aplicar
                </Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => {
                  const next = { period: "30d", vagas: [], origens: [], statuses: [], q: "", lotacaoIds: [] };
                  setFilters(next);
                  setCompareYear(false);
                  void loadCurrentReport(next).catch(() => toast.error("Falha."));
                }}>
                  Limpar
                </Button>
              </div>

            </div>
          </div>

          {/* Chart — redimensionável por arrasto */}
          <div className="border-t border-border/20 pt-3 print:mb-6">
            <div className="relative print:h-auto" style={{ height: chartHeight }}>
              <canvas ref={chartCanvasRef} style={{ width: "100%", height: "100%" }} />
              {loading && (
                <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-[2px] rounded-lg print:hidden">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" />Carregando</div>
                </div>
              )}
            </div>
            {/* Handle de resize */}
            <div
              onMouseDown={handleChartResizeStart}
              className="group flex items-center justify-center h-4 cursor-ns-resize select-none print:hidden"
              title="Arraste para redimensionar o gráfico"
            >
              <div className="w-10 h-1 rounded-full bg-border group-hover:bg-primary/40 transition-colors" />
            </div>
          </div>

          {/* Results table — ocupa o espaço restante */}
          <div className="border-t border-border/20 pt-3 flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2 print:hidden">
              <div className="font-semibold text-sm">Resultados</div>
              <div className="flex gap-1.5">
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{data.rows.length} linhas</span>
                <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-medium">exportável</span>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto print:overflow-visible">
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
                      <TableRow key={ri} className="print:break-inside-avoid">
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
