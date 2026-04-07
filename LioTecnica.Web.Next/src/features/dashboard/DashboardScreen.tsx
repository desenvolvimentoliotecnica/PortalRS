"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { toast } from "sonner";
import { AlertCircle, ArrowRight, Clock, Folder, Mail, Search, Briefcase, Palmtree, Heart, Users, MapPin } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";


const DEFAULT_MIN_MATCH = 70;

type Kpis = {
  openVagas: number;
  cvsHoje: number;
  pendentesMatch: number;
  aprovados7Dias: number;
  vagasForaSla: number;
};

type Funil = {
  recebidos: number;
  triagem: number;
  entrevista: number;
  aprovados: number;
};

type Series = { labels: string[]; values: number[] };

type VagaLookup = { id: string; titulo: string; codigo: string; cidade?: string | null; uf?: string | null };
type AreaLookup = { id: string; nome: string };

type TopMatchRow = {
  vagaId: string;
  vagaCodigo: string;
  vagaTitulo: string;
  candidatoId: string;
  candidatoNome: string;
  origem: string;
  matchScore: number;
  etapa: string;
};

type EnumOption = { code: string; text: string };
type EnumData = Record<string, EnumOption[]>;

type OpenVagaRow = {
  id: string;
  codigo: string;
  titulo: string;
  area: string;
  modalidade: string;
  cidade: string;
  uf: string;
  senioridade: string;
  updatedAtUtc: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickNumber(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pickString(v: unknown, fallback = "") {
  return typeof v === "string" ? v : v == null ? fallback : String(v);
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function formatLocal(v: { cidade?: string | null; uf?: string | null }) {
  const parts = [v.cidade, v.uf].map((x) => (x ?? "").trim()).filter(Boolean);
  return parts.length ? parts.join(" - ") : "-";
}

function formatDate(iso: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await apiFetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function mapEnumData(payload: unknown): EnumData {
  const r = asRecord(payload) ?? {};
  const out: EnumData = {};
  Object.entries(r).forEach(([key, value]) => {
    const arr = Array.isArray(value) ? (value as unknown[]) : [];
    out[key] = arr
      .map((x) => {
        const rr = asRecord(x);
        if (!rr) return null;
        const code = pickString(rr.code, "");
        const text = pickString(rr.text, "");
        if (!code) return null;
        return { code, text };
      })
      .filter(Boolean) as EnumOption[];
  });
  return out;
}

function mapKpis(payload: unknown): Kpis {
  const r = asRecord(payload) ?? {};
  return {
    openVagas: pickNumber(r.openVagas, 0),
    cvsHoje: pickNumber(r.cvsHoje, 0),
    pendentesMatch: pickNumber(r.pendentesMatch, 0),
    aprovados7Dias: pickNumber(r.aprovados7Dias, 0),
    vagasForaSla: pickNumber(r.vagasForaSla, 0),
  };
}

function mapFunil(payload: unknown): Funil {
  const r = asRecord(payload) ?? {};
  return {
    recebidos: pickNumber(r.recebidos, 0),
    triagem: pickNumber(r.triagem, 0),
    entrevista: pickNumber(r.entrevista, 0),
    aprovados: pickNumber(r.aprovados, 0),
  };
}

function mapSeries(payload: unknown): Series {
  const r = asRecord(payload) ?? {};
  const labels = Array.isArray(r.labels) ? (r.labels as unknown[]).map((x) => pickString(x, "")) : [];
  const values = Array.isArray(r.values) ? (r.values as unknown[]).map((x) => pickNumber(x, 0)) : [];
  return { labels, values };
}

function mapVagas(payload: unknown): VagaLookup[] {
  const arr = Array.isArray(payload) ? (payload as unknown[]) : [];
  return arr
    .map((x) => {
      const r = asRecord(x) ?? {};
      const id = pickString(r.id, "");
      if (!id) return null;
      return {
        id,
        titulo: pickString(r.titulo, ""),
        codigo: pickString(r.codigo, ""),
        cidade: pickString(r.cidade, "") || null,
        uf: pickString(r.uf, "") || null,
      };
    })
    .filter(Boolean) as VagaLookup[];
}

function mapAreas(payload: unknown): AreaLookup[] {
  const arr = Array.isArray(payload) ? (payload as unknown[]) : [];
  return arr
    .map((x) => {
      const r = asRecord(x) ?? {};
      const id = pickString(r.id, "");
      if (!id) return null;
      return { id, nome: pickString(r.nome, "") };
    })
    .filter(Boolean) as AreaLookup[];
}

function mapTopMatches(payload: unknown): TopMatchRow[] {
  const arr = Array.isArray(payload) ? (payload as unknown[]) : [];
  return arr
    .map((x) => {
      const r = asRecord(x) ?? {};
      const vagaId = pickString(r.vagaId, "");
      const candidatoId = pickString(r.candidatoId, "");
      if (!vagaId || !candidatoId) return null;
      return {
        vagaId,
        vagaCodigo: pickString(r.vagaCodigo, "-"),
        vagaTitulo: pickString(r.vagaTitulo, "-"),
        candidatoId,
        candidatoNome: pickString(r.candidatoNome, "-"),
        origem: pickString(r.origem, "-"),
        matchScore: clamp(pickNumber(r.matchScore, 0), 0, 100),
        etapa: pickString(r.etapa, "Triagem"),
      };
    })
    .filter(Boolean) as TopMatchRow[];
}

function mapOpenVagas(payload: unknown): OpenVagaRow[] {
  const arr = Array.isArray(payload) ? (payload as unknown[]) : [];
  return arr
    .map((x) => {
      const r = asRecord(x) ?? {};
      const id = pickString(r.id, "");
      if (!id) return null;
      return {
        id,
        codigo: pickString(r.codigo, "-"),
        titulo: pickString(r.titulo, "-"),
        area: pickString(r.area, "-"),
        modalidade: pickString(r.modalidade, "-"),
        cidade: pickString(r.cidade, ""),
        uf: pickString(r.uf, ""),
        senioridade: pickString(r.senioridade, "-"),
        updatedAtUtc: pickString(r.updatedAtUtc, ""),
      };
    })
    .filter(Boolean) as OpenVagaRow[];
}

function BadgeEtapa({ etapa }: { etapa: string }) {
  const e = (etapa || "").toLowerCase();
  const color =
    e.includes("reprov") ? "bg-red-500/15 text-red-700" : e.includes("aprov") ? "bg-emerald-500/15 text-emerald-700" : e.includes("entrev") ? "bg-amber-500/15 text-amber-700" : e.includes("triag") ? "bg-blue-500/15 text-blue-700" : "bg-zinc-400/15 text-zinc-600";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>{etapa}</span>;
}

function OriginBadge({ origem }: { origem: string }) {
  const raw = (origem || "").trim();
  const lower = raw.toLowerCase();
  const Icon = lower === "email" ? Mail : Folder;
  const label = raw || "-";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600">
      <Icon className="size-3" />
      {label}
    </span>
  );
}

function goToVagaDetail(vagaId: string) {
  if (!vagaId) return;
  const url = new URL(`/app/vagas`, window.location.origin);
  url.searchParams.set("vagaId", vagaId);
  url.searchParams.set("open", "detail");
  window.location.href = url.toString();
}

function goToCreateVaga(payload?: {
  titulo?: string;
  area?: string;
  status?: string;
  keywords?: string;
}) {
  const url = new URL(`/app/vagas`, window.location.origin);
  url.searchParams.set("open", "create");
  if (payload?.titulo?.trim()) url.searchParams.set("titulo", payload.titulo.trim());
  if (payload?.area?.trim()) url.searchParams.set("area", payload.area.trim());
  if (payload?.status?.trim()) url.searchParams.set("status", payload.status.trim());
  if (payload?.keywords?.trim()) url.searchParams.set("keywords", payload.keywords.trim());
  window.location.href = url.toString();
}

function goToUploadCv() {
  window.location.href = "/app/entradaemailpasta";
}

function goToExecutarMatch(vagaId?: string) {
  const url = new URL("/app/matching", window.location.origin);
  if (vagaId && vagaId !== "all") url.searchParams.set("vagaId", vagaId);
  window.location.href = url.toString();
}

export default function DashboardScreen({
  initialKpis = null,
  initialFunil = null,
  initialSeries = null,
  initialVagas = null,
  initialAreas = null,
  initialTopMatches = null,
}: {
  initialKpis?: unknown;
  initialFunil?: unknown;
  initialSeries?: unknown;
  initialVagas?: unknown;
  initialAreas?: unknown;
  initialTopMatches?: unknown;
} = {}) {
  const [kpis, setKpis] = useState<Kpis>(() => mapKpis(initialKpis));
  const [funil, setFunil] = useState<Funil>(() => mapFunil(initialFunil));
  const [series, setSeries] = useState<Series>(() => mapSeries(initialSeries));
  const [vagas, setVagas] = useState<VagaLookup[]>(() => mapVagas(initialVagas));
  const [areas, setAreas] = useState<AreaLookup[]>(() => mapAreas(initialAreas));
  const [topMatches, setTopMatches] = useState<TopMatchRow[]>(() => mapTopMatches(initialTopMatches));

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  const [vagaId, setVagaId] = useState<string>("all");
  const [minMatch, setMinMatch] = useState<number>(DEFAULT_MIN_MATCH);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [quickArea, setQuickArea] = useState<string>("");

  const [enums, setEnums] = useState<EnumData>({});
  // openVagas removido — KPI navega para /vagas
  const [quickTitle, setQuickTitle] = useState("");
  const [quickStatus, setQuickStatus] = useState("");
  const [quickKeywords, setQuickKeywords] = useState("");

  /* ── Solicitações pendentes widget ── */
  type PendingItem = { id: string; tipo: string; titulo: string; solicitante: string; data: string; icon: React.ElementType; color: string; href: string };
  const [pendentes, setPendentes] = useState<PendingItem[]>([]);
  const [pendentesLoading, setPendentesLoading] = useState(true);

  useEffect(() => {
    const APIS: { api: string; tipo: string; titleKey: string; solicitanteKey: string; dateKey: string; icon: React.ElementType; color: string; href: string }[] = [
      { api: "/api/solicitacoes-vaga?status=1", tipo: "Contratação", titleKey: "titulo", solicitanteKey: "solicitanteNome", dateKey: "createdAtUtc", icon: Briefcase, color: "text-violet-600", href: "/gestao/solicitacoes?tab=aprovacoes&tipo=contratacao" },
      { api: "/api/solicitacoes-promocao?status=1", tipo: "Promoção", titleKey: "colaboradorNome", solicitanteKey: "solicitanteNome", dateKey: "createdAtUtc", icon: Briefcase, color: "text-emerald-600", href: "/gestao/solicitacoes?tab=promocoes" },
      { api: "/api/solicitacoes-desligamento?status=1", tipo: "Desligamento", titleKey: "colaboradorNome", solicitanteKey: "solicitanteNome", dateKey: "createdAtUtc", icon: Briefcase, color: "text-red-600", href: "/gestao/solicitacoes?tab=desligamentos" },
      { api: "/api/colaborador/solicitacoes-ferias?status=1", tipo: "Férias", titleKey: "colaboradorNome", solicitanteKey: "solicitanteNome", dateKey: "createdAtUtc", icon: Palmtree, color: "text-sky-600", href: "/gestao/solicitacoes?tab=aprovacoes&tipo=ferias" },
      { api: "/api/colaborador/solicitacoes-beneficio?status=1", tipo: "Benefício", titleKey: "colaboradorNome", solicitanteKey: "solicitanteNome", dateKey: "createdAtUtc", icon: Heart, color: "text-pink-600", href: "/gestao/solicitacoes?tab=aprovacoes&tipo=beneficio" },
      { api: "/api/colaborador/solicitacoes-dependente?status=1", tipo: "Dependentes", titleKey: "dependenteNome", solicitanteKey: "colaboradorNome", dateKey: "createdAtUtc", icon: Users, color: "text-indigo-600", href: "/gestao/solicitacoes?tab=aprovacoes&tipo=dependentes" },
      { api: "/api/colaborador/solicitacoes-endereco?status=1", tipo: "Endereço", titleKey: "logradouro", solicitanteKey: "colaboradorNome", dateKey: "createdAtUtc", icon: MapPin, color: "text-amber-600", href: "/gestao/solicitacoes?tab=aprovacoes&tipo=endereco" },
    ];

    void Promise.allSettled(
      APIS.map(async (cfg) => {
        try {
          const data = await fetchJson<Record<string, unknown>[]>(cfg.api);
          if (!Array.isArray(data)) return [];
          return data.map((r): PendingItem => ({
            id: pickString(r.id, ""),
            tipo: cfg.tipo,
            titulo: pickString(r[cfg.titleKey], pickString(r.titulo, "—")),
            solicitante: pickString(r[cfg.solicitanteKey], "—"),
            data: pickString(r[cfg.dateKey], ""),
            icon: cfg.icon,
            color: cfg.color,
            href: cfg.href,
          }));
        } catch {
          return [];
        }
      })
    ).then((results) => {
      const all = results.flatMap(r => r.status === "fulfilled" ? r.value : []);
      all.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
      setPendentes(all);
      setPendentesLoading(false);
    });
  }, []);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  // Auto-load data on mount when no initial props are provided (static export)
  useEffect(() => {
    if (initialKpis != null) return; // data was provided via SSR
    void Promise.all([
      fetchJson<unknown>(`/api/dashboard/kpis`),
      fetchJson<unknown>(`/api/dashboard/funil`),
      fetchJson<unknown>(`/api/dashboard/recebidos-series?days=14`),
      fetchJson<unknown>(`/api/dashboard/vagas`),
      fetchJson<unknown>(`/api/dashboard/areas`),
      fetchJson<unknown>(`/api/dashboard/top-matches?minMatch=${DEFAULT_MIN_MATCH}&take=15`),
    ])
      .then(([k, f, s, v, a, t]) => {
        setKpis(mapKpis(k));
        setFunil(mapFunil(f));
        setSeries(mapSeries(s));
        setVagas(mapVagas(v));
        setAreas(mapAreas(a));
        setTopMatches(mapTopMatches(t));
      })
      .catch(() => {
        // silent — dashboard will show zero values
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchJson<unknown>(`/api/lookup/enums`)
      .then((data) => setEnums(mapEnumData(data)))
      .catch(() => {
        // silencioso: enums só melhoram os selects; tela não deve quebrar sem eles
      });
  }, []);

  // Modal de vagas removido — KPI "Vagas abertas" navega direto para /vagas

  useEffect(() => {
    const ctx = canvasRef.current;
    if (!ctx) return;
    if (chartRef.current) {
      chartRef.current.data.labels = series.labels;
      chartRef.current.data.datasets[0]!.data = series.values;
      chartRef.current.update();
      return;
    }
    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: series.labels,
        datasets: [
          {
            label: "CVs recebidos",
            data: series.values,
            tension: 0.35,
            fill: true,
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
  }, [series.labels.join("|"), series.values.join("|")]);

  const funnelBase = funil.recebidos > 0 ? funil.recebidos : 1;
  const funnelBars = useMemo(() => {
    return {
      recebidos: 100,
      triagem: Math.round((funil.triagem / funnelBase) * 100),
      entrevista: Math.round((funil.entrevista / funnelBase) * 100),
      aprovados: Math.round((funil.aprovados / funnelBase) * 100),
    };
  }, [funil, funnelBase]);

  async function refreshAll() {
    try {
      const [k, f, s, v, a] = await Promise.all([
        fetchJson<unknown>(`/api/dashboard/kpis`),
        fetchJson<unknown>(`/api/dashboard/funil`),
        fetchJson<unknown>(`/api/dashboard/recebidos-series?days=14`),
        fetchJson<unknown>(`/api/dashboard/vagas`),
        fetchJson<unknown>(`/api/dashboard/areas`),
      ]);
      setKpis(mapKpis(k));
      setFunil(mapFunil(f));
      setSeries(mapSeries(s));
      setVagas(mapVagas(v));
      setAreas(mapAreas(a));
      toast.success("Dashboard atualizado.");
    } catch {
      toast.error("Falha ao atualizar dashboard.");
    }
  }

  async function refreshTopMatches(
    overrides?: Partial<{
      vagaId: string;
      minMatch: number;
      from: string;
      to: string;
    }>,
  ) {
    const nextVagaId = overrides?.vagaId ?? vagaId;
    const nextMinMatch = overrides?.minMatch ?? minMatch;
    const nextFrom = overrides?.from ?? from;
    const nextTo = overrides?.to ?? to;

    const params = new URLSearchParams();
    params.set("minMatch", String(clamp(nextMinMatch, 0, 100)));
    params.set("take", "15");
    if (nextVagaId && nextVagaId !== "all") params.set("vagaId", nextVagaId);
    if (nextFrom) params.set("from", new Date(`${nextFrom}T00:00:00Z`).toISOString());
    if (nextTo) params.set("to", new Date(`${nextTo}T23:59:59Z`).toISOString());
    try {
      const rows = await fetchJson<unknown>(`/api/dashboard/top-matches?${params.toString()}`);
      setTopMatches(mapTopMatches(rows));
      toast.success("Tabela atualizada.");
    } catch {
      toast.error("Falha ao carregar top matches.");
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Visão geral do recrutamento</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)}>
            Filtros
          </Button>
          <Button size="sm" onClick={() => setQuickOpen(true)}>
            Ações
          </Button>
          <Button variant="outline" size="sm" onClick={() => void refreshAll()}>
            Atualizar
          </Button>
        </div>
      </div>

      {/* ── O que fazer agora ── */}
      {(kpis.pendentesMatch > 0 || kpis.vagasForaSla > 0) && (
        <div className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="size-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-900">O que fazer agora</h2>
          </div>
          <div className="space-y-2">
            {kpis.pendentesMatch > 0 && (
              <Link href="/matching" className="flex items-center justify-between gap-2 rounded-lg bg-white/80 border border-amber-200/40 px-3 py-2 text-sm hover:bg-white transition-colors group">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 text-amber-600" />
                  <span><strong>{kpis.pendentesMatch}</strong> candidatos pendentes de matching</span>
                </div>
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Link>
            )}
            {kpis.vagasForaSla > 0 && (
              <Link href="/triagem?filter=late" className="flex items-center justify-between gap-2 rounded-lg bg-white/80 border border-red-200/40 px-3 py-2 text-sm hover:bg-white transition-colors group">
                <div className="flex items-center gap-2">
                  <AlertCircle className="size-4 text-red-600" />
                  <span><strong>{kpis.vagasForaSla}</strong> vagas fora do SLA</span>
                </div>
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
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


      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border border-border/50 bg-card shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-semibold">Resumo</div>
              <div className="text-muted-foreground text-xs">Últimos 14 dias</div>
            </div>
            <span className="inline-flex items-center rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">Tendência</span>
          </div>
          <canvas ref={canvasRef} height={110} />
        </div>

        <div className="rounded-xl border border-border/50 bg-card shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-semibold">Funil</div>
              <div className="text-muted-foreground text-xs">Pipeline</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setFiltersOpen(true)}>
              Filtros
            </Button>
          </div>

          <div className="space-y-3 mt-2">
            {[
              { key: "recebidos", label: "Recebidos", value: funil.recebidos, pct: funnelBars.recebidos },
              { key: "triagem", label: "Triagem", value: funil.triagem, pct: funnelBars.triagem },
              { key: "entrevista", label: "Entrevista", value: funil.entrevista, pct: funnelBars.entrevista },
              { key: "aprovados", label: "Aprovados", value: funil.aprovados, pct: funnelBars.aprovados },
            ].map((x) => (
              <div key={x.key}>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{x.label}</span>
                  <span className="font-semibold">{x.value}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-black/10 overflow-hidden">
                  <div className="h-full bg-[rgb(var(--lt-primary))]" style={{ width: `${clamp(x.pct, 0, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-muted-foreground text-sm">
            Dica: use filtros para ver diferentes períodos/vagas.
          </div>
        </div>
      </div>

      {/* ── Aprovações Pendentes widget ── */}
      {(pendentesLoading || pendentes.length > 0) && (
        <div className="rounded-xl border border-border/50 bg-card shadow-sm p-3">
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
            <Link href="/gestao/solicitacoes?tab=aprovacoes">
              <Button variant="ghost" size="sm" className="text-xs h-7 px-2">Ver todas →</Button>
            </Link>
          </div>
          {!pendentesLoading && pendentes.length > 0 && (
            <div className="divide-y divide-border/30">
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
                  <Link href="/gestao/solicitacoes?tab=aprovacoes" className="text-xs text-primary hover:underline">
                    +{pendentes.length - 6} mais
                  </Link>
                </div>
              )}
            </div>
          )}
          {pendentesLoading && (
            <div className="text-xs text-muted-foreground py-2">Carregando…</div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border/50 bg-card shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div className="text-sm font-semibold">Melhores matches</div>
            <div className="text-muted-foreground text-xs">Top 15 por score</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              Exportar
            </Button>
            <Button size="sm" onClick={() => goToCreateVaga()}>
              Nova vaga
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ minWidth: 220 }}>Vaga</TableHead>
                <TableHead style={{ minWidth: 200 }}>Candidato</TableHead>
                <TableHead style={{ minWidth: 170 }}>Origem</TableHead>
                <TableHead style={{ minWidth: 240 }}>Match</TableHead>
                <TableHead style={{ minWidth: 170 }}>Etapa</TableHead>
                <TableHead className="text-right" style={{ minWidth: 150 }}>
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topMatches.length ? (
                topMatches.map((x) => (
                  <TableRow key={`${x.vagaId}|${x.candidatoId}`}>
                    <TableCell>
                      <div className="font-medium text-sm">{x.vagaTitulo || "-"}</div>
                      <div className="text-muted-foreground text-xs">Código: {x.vagaCodigo || "-"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{x.candidatoNome || "-"}</div>
                    </TableCell>
                    <TableCell>
                      <OriginBadge origem={x.origem || "-"} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-black/10 overflow-hidden">
                          <div className="h-full bg-[rgb(var(--lt-primary))]" style={{ width: `${x.matchScore}%` }} />
                        </div>
                        <div className="font-bold tabular-nums font-mono w-[52px] text-right">{x.matchScore}%</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <BadgeEtapa etapa={x.etapa || "Triagem"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          goToVagaDetail(x.vagaId);
                        }}
                      >
                        Ver vaga
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum registro atende o filtro atual.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-stretch bg-black/40" role="dialog" aria-modal="true">
          <div className="ml-auto h-dvh w-full max-w-md bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Filtros e Visões</div>
                <div className="text-muted-foreground text-sm">Ajuste o dashboard para a operação do RH</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setFiltersOpen(false)}>
                Fechar
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-sm font-medium mb-2">Vaga</div>
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={vagaId} onChange={(e) => setVagaId(e.target.value)}>
                  {(enums.vagaFilterSimple?.length ? enums.vagaFilterSimple : [{ code: "all", text: "Todas" }]).map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.text}
                    </option>
                  ))}
                  {vagas
                    .slice()
                    .sort((a, b) => (a.titulo || "").localeCompare(b.titulo || "", "pt-BR"))
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.titulo || "-"} ({v.codigo || "-"})
                      </option>
                    ))}
                </select>
              </div>

              <div className="rounded-xl border border-border/50 bg-card shadow-sm p-4">
                <div className="text-sm font-medium mb-2">Período</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">De</label>
                    <input className="h-9 rounded-md border border-input bg-background px-3 text-sm" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Até</label>
                    <input className="h-9 rounded-md border border-input bg-background px-3 text-sm" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Match mínimo</div>
                <input className="w-full" type="range" min={0} max={100} value={minMatch} onChange={(e) => setMinMatch(clamp(Number(e.target.value), 0, 100))} />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
                <div className="mt-2 inline-flex items-center rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">
                  Atual: <span className="font-semibold">{minMatch}%</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMinMatch(DEFAULT_MIN_MATCH);
                  setVagaId("all");
                  setFrom("");
                  setTo("");
                  void refreshTopMatches({ minMatch: DEFAULT_MIN_MATCH, vagaId: "all", from: "", to: "" });
                }}
              >
                Limpar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  void refreshTopMatches().finally(() => setFiltersOpen(false));
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {quickOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-stretch bg-black/40" role="dialog" aria-modal="true">
          <div className="ml-auto h-dvh w-full max-w-md bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Ações rápidas</div>
                <div className="text-muted-foreground text-sm">Atalhos para operação do RH</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setQuickOpen(false)}>
                Fechar
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-border/50 bg-card shadow-sm p-4">
                <div className="text-sm font-medium mb-2">Criar vaga</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Título</label>
                    <input className="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="Ex.: Analista de Marketing Jr" value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Área</label>
                    <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={quickArea} onChange={(e) => setQuickArea(e.target.value)}>
                      <option value="">Selecionar área</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
                    <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={quickStatus} onChange={(e) => setQuickStatus(e.target.value)}>
                      <option value="">Selecionar status</option>
                      {(enums.vagaStatus ?? []).map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.text}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Palavras-chave (separadas por vírgula)</label>
                    <input className="h-9 rounded-md border border-input bg-background px-3 text-sm" placeholder="Ex.: power bi, seo, redes sociais, crm" value={quickKeywords} onChange={(e) => setQuickKeywords(e.target.value)} />
                  </div>
                </div>
                <div className="mt-3">
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => {
                      const quickAreaName = areas.find((a) => a.id === quickArea)?.nome ?? "";
                      goToCreateVaga({
                        titulo: quickTitle,
                        area: quickAreaName,
                        status: quickStatus,
                        keywords: quickKeywords,
                      });
                    }}
                  >
                    Criar vaga
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-card shadow-sm p-4">
                <div className="text-sm font-medium mb-2">Upload CV</div>
                <div className="flex flex-col gap-2">
                  <Button size="sm" onClick={goToUploadCv}>
                    Abrir entrada de currículos
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-card shadow-sm p-4">
                <div className="text-sm font-medium mb-2">Executar match</div>
                <div className="text-muted-foreground text-sm mb-2">Ajustes: pesos, obrigatórios e sinônimos por vaga.</div>
                <Button className="w-full" size="sm" onClick={() => goToExecutarMatch(vagaId)}>
                  Abrir matching
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal de vagas removido — clicar no KPI navega direto para /vagas */}
    </section>
  );
}

