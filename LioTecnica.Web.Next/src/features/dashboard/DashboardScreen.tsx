"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Briefcase,
  Palmtree,
  Heart,
  Users,
  MapPin,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { ResponsiveGridLayout, useContainerWidth } from "react-grid-layout";

import { GRID_BREAKPOINTS, GRID_COLS } from "./dashboardLayout";
import { useDashboardLayout } from "./useDashboardLayout";
import { WidgetCatalog } from "./WidgetCatalog";
import { useAuth } from "@/hooks/useAuth";
import { WidgetShell } from "./widgets/WidgetShell";
import { KpiWidget } from "./widgets/KpiWidget";
import { OQueFazerWidget } from "./widgets/OQueFazerWidget";
import { ResumoWidget } from "./widgets/ResumoWidget";
import { FunilWidget } from "./widgets/FunilWidget";
import { AprovacoesWidget } from "./widgets/AprovacoesWidget";
import { TopMatchesWidget } from "./widgets/TopMatchesWidget";
import { SlaWidget } from "./widgets/SlaWidget";
import { ProximasAcoesWidget } from "./widgets/ProximasAcoesWidget";
import { HumorEquipeWidget } from "./widgets/HumorEquipeWidget";
import { PdiWidget } from "./widgets/PdiWidget";
import { LeaderboardWidget } from "./widgets/LeaderboardWidget";
import { InboxFeedWidget } from "./widgets/InboxFeedWidget";
import { MeuTimeWidget } from "./widgets/MeuTimeWidget";
import type {
  Kpis, Funil, Series, TopMatchRow, PendingItem,
  SlaData, UpcomingAction, MoodStats, PdiItem, LeaderboardEntry, MyBalance,
  MeuTimeData, MeuTimeMembro,
} from "./dashboardTypes";

const DEFAULT_MIN_MATCH = 70;

type VagaLookup = { id: string; titulo: string; codigo: string; cidade?: string | null; uf?: string | null };
type AreaLookup = { id: string; nome: string };

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
  const [catalogOpen, setCatalogOpen] = useState(false);

  const [vagaId, setVagaId] = useState<string>("all");
  const [minMatch, setMinMatch] = useState<number>(DEFAULT_MIN_MATCH);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [quickArea, setQuickArea] = useState<string>("");

  const [enums, setEnums] = useState<EnumData>({});
  const [quickTitle, setQuickTitle] = useState("");
  const [quickStatus, setQuickStatus] = useState("");
  const [quickKeywords, setQuickKeywords] = useState("");

  /* ── Solicitações pendentes widget ── */
  const [pendentes, setPendentes] = useState<PendingItem[]>([]);
  const [pendentesLoading, setPendentesLoading] = useState(true);

  /* ── Novos widgets ── */
  const [slaData, setSlaData] = useState<SlaData | null>(null);
  const [slaLoading, setSlaLoading] = useState(false);

  const [proximasAcoes, setProximasAcoes] = useState<UpcomingAction[]>([]);
  const [proximasLoading, setProximasLoading] = useState(false);

  const [moodStats, setMoodStats] = useState<MoodStats | null>(null);
  const [moodLoading, setMoodLoading] = useState(false);

  const [pdis, setPdis] = useState<PdiItem[]>([]);
  const [pdiLoading, setPdiLoading] = useState(false);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [myBalance, setMyBalance] = useState<MyBalance | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  const [meuTime, setMeuTime] = useState<MeuTimeData | null>(null);
  const [meuTimeLoading, setMeuTimeLoading] = useState(false);

  const { me } = useAuth();
  const tenantId = me?.tenantId ?? "";

  const {
    isEditMode,
    setIsEditMode,
    layouts,
    visibleWidgets,
    isLoaded,
    handleLayoutChange,
    toggleWidget,
    resetLayout,
  } = useDashboardLayout();

  const { width: containerWidth, containerRef, mounted: containerMounted } = useContainerWidth();

  useEffect(() => {
    const APIS: {
      api: string;
      tipo: string;
      titleKey: string;
      solicitanteKey: string;
      dateKey: string;
      icon: React.ElementType;
      color: string;
      href: string;
    }[] = [
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
      const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
      all.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
      setPendentes(all);
      setPendentesLoading(false);
    });
  }, []);

  // Auto-load data on mount when no initial props are provided (static export)
  useEffect(() => {
    if (initialKpis != null) return;
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
        // silencioso
      });
  }, []);

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

  // Suppress unused var warning (mapOpenVagas kept for potential future use)
  void mapOpenVagas;

  // ── Load new widget data on demand when widget becomes visible ──
  useEffect(() => {
    if (!visibleWidgets.includes("sla") || slaData !== null) return;
    setSlaLoading(true);
    void fetchJson<unknown>("/api/sla/vagas")
      .then((raw) => {
        const r = asRecord(raw) ?? {};
        const kpis = asRecord(r.kpis) ?? {};
        const vagasArr = Array.isArray(r.vagas) ? (r.vagas as unknown[]) : [];
        setSlaData({
          kpis: {
            total: pickNumber(kpis.total, 0),
            noPrazo: pickNumber(kpis.noPrazo, 0),
            critica: pickNumber(kpis.critica, 0),
            atrasada: pickNumber(kpis.atrasada, 0),
          },
          vagas: vagasArr.map((x) => {
            const v = asRecord(x) ?? {};
            return {
              id: pickString(v.id),
              titulo: pickString(v.titulo, "—"),
              status: pickString(v.status),
              prioridade: pickString(v.prioridade),
              diasAberto: pickNumber(v.diasAberto, 0),
              metaDias: pickNumber(v.metaDias, 0),
              percentualConsumido: pickNumber(v.percentualConsumido, 0),
              slaStatus: (["no_prazo", "critica", "atrasada"].includes(pickString(v.slaStatus))
                ? pickString(v.slaStatus)
                : "no_prazo") as "no_prazo" | "critica" | "atrasada",
            };
          }),
        });
      })
      .catch(() => { /* silent */ })
      .finally(() => setSlaLoading(false));
  }, [visibleWidgets, slaData]);

  useEffect(() => {
    if (!visibleWidgets.includes("proximasAcoes") || proximasAcoes.length > 0) return;
    setProximasLoading(true);
    void fetchJson<unknown>("/api/gestao/dashboard/upcoming-actions?take=8")
      .then((raw) => {
        const arr = Array.isArray(raw) ? (raw as unknown[]) : [];
        setProximasAcoes(arr.map((x) => {
          const r = asRecord(x) ?? {};
          return {
            id: pickString(r.id),
            type: pickString(r.type),
            description: pickString(r.description, "—"),
            dueAtUtc: pickString(r.dueAtUtc),
          };
        }));
      })
      .catch(() => { /* silent */ })
      .finally(() => setProximasLoading(false));
  }, [visibleWidgets, proximasAcoes.length]);

  useEffect(() => {
    if (!visibleWidgets.includes("humor") || moodStats !== null) return;
    setMoodLoading(true);
    void fetchJson<unknown>("/api/gestao/humor/stats")
      .then((raw) => {
        const r = asRecord(raw) ?? {};
        const dist = Array.isArray(r.distribution) ? (r.distribution as unknown[]) : [];
        setMoodStats({
          averageMood: pickString(r.averageMood),
          totalResponses: pickNumber(r.totalResponses, 0),
          distribution: dist.map((x) => {
            const d = asRecord(x) ?? {};
            return {
              mood: pickString(d.mood),
              count: pickNumber(d.count, 0),
              percentage: pickNumber(d.percentage, 0),
            };
          }),
        });
      })
      .catch(() => { /* silent */ })
      .finally(() => setMoodLoading(false));
  }, [visibleWidgets, moodStats]);

  useEffect(() => {
    if (!visibleWidgets.includes("pdi") || pdis.length > 0) return;
    setPdiLoading(true);
    void fetchJson<unknown>("/api/gestao/planos")
      .then((raw) => {
        const arr = Array.isArray(raw) ? (raw as unknown[]) : [];
        setPdis(arr.map((x) => {
          const r = asRecord(x) ?? {};
          return {
            id: pickString(r.id),
            title: pickString(r.title, "—"),
            responsibleName: pickString(r.responsibleName, "—"),
            status: pickString(r.status, "pending"),
            dueDate: pickString(r.dueDate),
            progress: pickNumber(r.progress, 0),
          };
        }));
      })
      .catch(() => { /* silent */ })
      .finally(() => setPdiLoading(false));
  }, [visibleWidgets, pdis.length]);

  useEffect(() => {
    if (!visibleWidgets.includes("leaderboard") || leaderboard.length > 0) return;
    setLeaderboardLoading(true);
    void Promise.all([
      fetchJson<unknown>("/api/feedback/gamification/leaderboard?page=1&pageSize=7"),
      fetchJson<unknown>("/api/feedback/gamification/my-balance"),
    ])
      .then(([lbRaw, balRaw]) => {
        const lb = asRecord(lbRaw) ?? {};
        const items = Array.isArray(lb.items) ? (lb.items as unknown[]) : (Array.isArray(lbRaw) ? (lbRaw as unknown[]) : []);
        setLeaderboard(items.map((x) => {
          const e = asRecord(x) ?? {};
          return {
            userId: pickString(e.userId),
            fullName: pickString(e.fullName, "—"),
            balance: pickNumber(e.balance, 0),
            rank: pickNumber(e.rank, 0),
          };
        }));
        const bal = asRecord(balRaw) ?? {};
        setMyBalance({
          userId: pickString(bal.userId),
          balance: pickNumber(bal.balance, 0),
        });
      })
      .catch(() => { /* silent */ })
      .finally(() => setLeaderboardLoading(false));
  }, [visibleWidgets, leaderboard.length]);

  useEffect(() => {
    if (!visibleWidgets.includes("meuTime") || meuTime !== null) return;
    setMeuTimeLoading(true);
    void Promise.all([
      fetchJson<{ funcionarioId?: string }>("/api/me").catch(() => ({} as { funcionarioId?: string })),
      fetchJson<{ lotacoes: { funcionarios: { id: string; nome: string; gestorDiretoId: string | null }[] }[]; semLotacao: { id: string; nome: string; gestorDiretoId: string | null }[] }>("/api/organograma/estrutura").catch(() => ({ lotacoes: [], semLotacao: [] })),
      fetchJson<unknown>("/api/funcionarios?pageSize=500&status=Active").catch(() => null),
    ])
      .then(([meRes, orgRes, funcsRes]) => {
        const myFuncId = meRes?.funcionarioId ?? null;
        const allOrg = [
          ...orgRes.lotacoes.flatMap((l) => l.funcionarios),
          ...orgRes.semLotacao,
        ];

        // Build func detail map for cargo/area
        const funcMap = new Map<string, { cargo: string; area: string; status: string }>();
        const funcsArr = Array.isArray((funcsRes as Record<string, unknown>)?.items)
          ? ((funcsRes as Record<string, unknown>).items as unknown[])
          : Array.isArray(funcsRes) ? (funcsRes as unknown[]) : [];
        for (const f of funcsArr) {
          const r = asRecord(f) ?? {};
          const id = pickString(r.id);
          if (id) funcMap.set(id, {
            cargo: pickString(r.jobPositionName ?? r.cargo),
            area: pickString(r.areaName ?? r.area),
            status: pickString(r.status, "Active"),
          });
        }

        if (!myFuncId) {
          // No manager link — show all direct employees if admin
          const membros: MeuTimeMembro[] = allOrg.slice(0, 30).map((f) => ({
            id: f.id,
            nome: f.nome,
            ...funcMap.get(f.id) ?? { cargo: "", area: "", status: "Active" },
            tipo: "direto" as const,
          }));
          setMeuTime({ membros, totalDiretos: membros.length, totalIndiretos: 0 });
          return;
        }

        // BFS: collect direct and indirect reports
        const diretos = new Set<string>();
        const indiretos = new Set<string>();
        const queue = [{ id: myFuncId, depth: 0 }];
        const visited = new Set<string>([myFuncId]);
        while (queue.length > 0) {
          const { id: cur, depth } = queue.shift()!;
          for (const f of allOrg) {
            if (f.gestorDiretoId === cur && !visited.has(f.id)) {
              visited.add(f.id);
              if (depth === 0) diretos.add(f.id); else indiretos.add(f.id);
              queue.push({ id: f.id, depth: depth + 1 });
            }
          }
        }

        const toMembro = (id: string, tipo: "direto" | "indireto"): MeuTimeMembro => {
          const org = allOrg.find((f) => f.id === id);
          return {
            id,
            nome: org?.nome ?? id,
            ...funcMap.get(id) ?? { cargo: "", area: "", status: "Active" },
            tipo,
          };
        };

        const membros: MeuTimeMembro[] = [
          ...Array.from(diretos).map((id) => toMembro(id, "direto")),
          ...Array.from(indiretos).map((id) => toMembro(id, "indireto")),
        ].sort((a, b) => {
          if (a.tipo !== b.tipo) return a.tipo === "direto" ? -1 : 1;
          return a.nome.localeCompare(b.nome, "pt-BR");
        });

        setMeuTime({
          membros,
          totalDiretos: diretos.size,
          totalIndiretos: indiretos.size,
        });
      })
      .catch(() => { /* silent */ })
      .finally(() => setMeuTimeLoading(false));
  }, [visibleWidgets, meuTime]);

  return (
    <section className="space-y-3">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Visão geral do recrutamento</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { if (!isEditMode) setFiltersOpen(true); }} disabled={isEditMode}>
            Filtros
          </Button>
          <Button size="sm" onClick={() => { if (!isEditMode) setQuickOpen(true); }} disabled={isEditMode}>
            Ações
          </Button>
          <Button variant="outline" size="sm" onClick={() => { if (!isEditMode) void refreshAll(); }} disabled={isEditMode}>
            Atualizar
          </Button>
          {isEditMode ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setCatalogOpen(true)}>
                Widgets
              </Button>
              <Button size="sm" onClick={() => setIsEditMode(false)}>
                Concluir
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => setIsEditMode(true)}
            >
              <LayoutDashboard className="size-3.5" />
              Personalizar
            </Button>
          )}
        </div>
      </div>

      {/* ── Edit mode banner ── */}
      {isEditMode && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-primary flex items-center gap-2">
          <LayoutDashboard className="size-4 shrink-0" />
          <span>
            Modo de edição — arraste os widgets pelo handle para reorganizar, ou redimensione pelas bordas. Clique em{" "}
            <strong>Widgets</strong> para mostrar/ocultar seções.
          </span>
        </div>
      )}

      {/* ── Grid ── */}
      <div ref={containerRef}>
      {isLoaded && containerMounted && (
        <ResponsiveGridLayout
          width={containerWidth}
          className="layout"
          layouts={layouts}
          breakpoints={GRID_BREAKPOINTS}
          cols={GRID_COLS}
          rowHeight={60}
          margin={[10, 10] as [number, number]}
          dragConfig={{
            enabled: isEditMode,
            handle: ".drag-handle",
            bounded: false,
            threshold: 3,
          }}
          resizeConfig={{
            enabled: isEditMode,
            handles: ["se", "sw"],
          }}
          onLayoutChange={handleLayoutChange}
        >
          {visibleWidgets.includes("oQueFazer") && (
            <div key="oQueFazer">
              <WidgetShell
                label="O que fazer agora"
                isEditMode={isEditMode}
                removable={true}
                onRemove={() => toggleWidget("oQueFazer", false)}
              >
                <OQueFazerWidget
                  pendentesMatch={kpis.pendentesMatch}
                  vagasForaSla={kpis.vagasForaSla}
                />
              </WidgetShell>
            </div>
          )}

          {visibleWidgets.includes("kpis") && (
            <div key="kpis">
              <WidgetShell label="KPIs" isEditMode={isEditMode} removable={false}>
                <KpiWidget kpis={kpis} />
              </WidgetShell>
            </div>
          )}

          {visibleWidgets.includes("resumo") && (
            <div key="resumo">
              <WidgetShell
                label="Resumo"
                isEditMode={isEditMode}
                removable={true}
                onRemove={() => toggleWidget("resumo", false)}
              >
                <ResumoWidget series={series} />
              </WidgetShell>
            </div>
          )}

          {visibleWidgets.includes("funil") && (
            <div key="funil">
              <WidgetShell
                label="Funil"
                isEditMode={isEditMode}
                removable={true}
                onRemove={() => toggleWidget("funil", false)}
              >
                <FunilWidget funil={funil} onOpenFilters={() => setFiltersOpen(true)} />
              </WidgetShell>
            </div>
          )}

          {visibleWidgets.includes("aprovacoes") && (
            <div key="aprovacoes">
              <WidgetShell
                label="Aprovações Pendentes"
                isEditMode={isEditMode}
                removable={true}
                onRemove={() => toggleWidget("aprovacoes", false)}
              >
                <AprovacoesWidget pendentes={pendentes} pendentesLoading={pendentesLoading} />
              </WidgetShell>
            </div>
          )}

          {visibleWidgets.includes("topMatches") && (
            <div key="topMatches">
              <WidgetShell
                label="Melhores Matches"
                isEditMode={isEditMode}
                removable={true}
                onRemove={() => toggleWidget("topMatches", false)}
              >
                <TopMatchesWidget topMatches={topMatches} />
              </WidgetShell>
            </div>
          )}

          {visibleWidgets.includes("sla") && (
            <div key="sla">
              <WidgetShell
                label="SLA de Vagas"
                isEditMode={isEditMode}
                removable={true}
                onRemove={() => toggleWidget("sla", false)}
              >
                <SlaWidget data={slaData} loading={slaLoading} />
              </WidgetShell>
            </div>
          )}

          {visibleWidgets.includes("proximasAcoes") && (
            <div key="proximasAcoes">
              <WidgetShell
                label="Próximas Ações"
                isEditMode={isEditMode}
                removable={true}
                onRemove={() => toggleWidget("proximasAcoes", false)}
              >
                <ProximasAcoesWidget actions={proximasAcoes} loading={proximasLoading} />
              </WidgetShell>
            </div>
          )}

          {visibleWidgets.includes("humor") && (
            <div key="humor">
              <WidgetShell
                label="Humor da Equipe"
                isEditMode={isEditMode}
                removable={true}
                onRemove={() => toggleWidget("humor", false)}
              >
                <HumorEquipeWidget stats={moodStats} loading={moodLoading} />
              </WidgetShell>
            </div>
          )}

          {visibleWidgets.includes("pdi") && (
            <div key="pdi">
              <WidgetShell
                label="Planos de Desenvolvimento"
                isEditMode={isEditMode}
                removable={true}
                onRemove={() => toggleWidget("pdi", false)}
              >
                <PdiWidget pdis={pdis} loading={pdiLoading} />
              </WidgetShell>
            </div>
          )}

          {visibleWidgets.includes("leaderboard") && (
            <div key="leaderboard">
              <WidgetShell
                label="Leaderboard"
                isEditMode={isEditMode}
                removable={true}
                onRemove={() => toggleWidget("leaderboard", false)}
              >
                <LeaderboardWidget entries={leaderboard} myBalance={myBalance} loading={leaderboardLoading} />
              </WidgetShell>
            </div>
          )}

          {visibleWidgets.includes("inboxFeed") && (
            <div key="inboxFeed">
              <WidgetShell
                label="Feed de CVs"
                isEditMode={isEditMode}
                removable={true}
                onRemove={() => toggleWidget("inboxFeed", false)}
              >
                <InboxFeedWidget tenantId={tenantId} />
              </WidgetShell>
            </div>
          )}

          {visibleWidgets.includes("meuTime") && (
            <div key="meuTime">
              <WidgetShell
                label="Meu Time"
                isEditMode={isEditMode}
                removable={true}
                onRemove={() => toggleWidget("meuTime", false)}
              >
                <MeuTimeWidget data={meuTime} loading={meuTimeLoading} />
              </WidgetShell>
            </div>
          )}
        </ResponsiveGridLayout>
      )}
      </div>

      {/* ── Filtros drawer ── */}
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
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={vagaId}
                  onChange={(e) => setVagaId(e.target.value)}
                >
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
                    <input
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Até</label>
                    <input
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Match mínimo</div>
                <input
                  className="w-full"
                  type="range"
                  min={0}
                  max={100}
                  value={minMatch}
                  onChange={(e) => setMinMatch(clamp(Number(e.target.value), 0, 100))}
                />
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

      {/* ── Ações rápidas drawer ── */}
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
                    <input
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      placeholder="Ex.: Analista de Marketing Jr"
                      value={quickTitle}
                      onChange={(e) => setQuickTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Área</label>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={quickArea}
                      onChange={(e) => setQuickArea(e.target.value)}
                    >
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
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={quickStatus}
                      onChange={(e) => setQuickStatus(e.target.value)}
                    >
                      <option value="">Selecionar status</option>
                      {(enums.vagaStatus ?? []).map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.text}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-muted-foreground block mb-1">
                      Palavras-chave (separadas por vírgula)
                    </label>
                    <input
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      placeholder="Ex.: power bi, seo, redes sociais, crm"
                      value={quickKeywords}
                      onChange={(e) => setQuickKeywords(e.target.value)}
                    />
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
                <div className="text-muted-foreground text-sm mb-2">
                  Ajustes: pesos, obrigatórios e sinônimos por vaga.
                </div>
                <Button className="w-full" size="sm" onClick={() => goToExecutarMatch(vagaId)}>
                  Abrir matching
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Widget catalog panel ── */}
      <WidgetCatalog
        open={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        visibleWidgets={visibleWidgets}
        onToggle={toggleWidget}
        onReset={resetLayout}
      />
    </section>
  );
}
