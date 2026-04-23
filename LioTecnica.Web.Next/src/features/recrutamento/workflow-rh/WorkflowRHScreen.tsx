"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  Briefcase,
  UserCheck,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  TrendingUp,
  UserMinus,
  Palmtree,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import StepperProgress from "@/components/feedback/StepperProgress";
import type { StepperStep } from "@/components/feedback/StepperProgress";
import PromocoesScreen from "@/features/gestao/promocoes/PromocoesScreen";
import DesligamentosScreen from "@/features/gestao/desligamentos/DesligamentosScreen";
import FeriasScreen from "@/features/gestao/ferias/FeriasScreen";

/* ─── Tab config ─────────────────────────────────────────── */

type PainelTab = "recrutamento" | "movimentacoes" | "desligamentos" | "ferias";

const PAINEL_TABS: { id: PainelTab; label: string; icon: React.ElementType }[] = [
  { id: "recrutamento",  label: "Recrutamento",  icon: Briefcase  },
  { id: "movimentacoes", label: "Movimentação",  icon: TrendingUp },
  { id: "desligamentos", label: "Desligamento",  icon: UserMinus  },
  { id: "ferias",        label: "Férias",        icon: Palmtree   },
];

/* ─── Types ─────────────────────────────────────────────── */

interface WorkflowGridRow {
  id: string;
  tipoWorkflow: number;
  tipoWorkflowLabel: string;
  status: number;
  statusLabel: string;
  vagaId: string | null;
  vagaTitulo: string | null;
  preAdmissaoId: string | null;
  candidatoNome: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  totalEtapas: number;
  etapasConcluidas: number;
  etapaAtualLabel: string | null;
  slaPrazoDias: number | null;
  slaExcedido: boolean;
  createdAtUtc: string;
}

interface FilaRhItem {
  id: string;
  titulo: string;
  centroCustoName: string | null;
  urgencia?: number;
  createdAtUtc: string;
}

/* ─── Status helpers ────────────────────────────────────── */

const STATUS_MAP: Record<number, { label: string; color: string; icon: React.ElementType }> = {
  0: { label: "Não Iniciado", color: "secondary", icon: PauseCircle },
  1: { label: "Em Andamento", color: "default",   icon: PlayCircle  },
  2: { label: "Concluído",    color: "default",   icon: CheckCircle2 },
  3: { label: "Cancelado",    color: "destructive", icon: XCircle   },
};

const TIPO_MAP: Record<number, { label: string; icon: React.ElementType }> = {
  1: { label: "Triagem Vaga",   icon: Briefcase },
  2: { label: "Pós-Efetivação", icon: UserCheck },
};

const URGENCIA_MAP: Record<number, { label: string; cls: string }> = {
  0: { label: "Baixa",   cls: "text-zinc-500" },
  1: { label: "Média",   cls: "text-amber-600" },
  2: { label: "Alta",    cls: "text-orange-600" },
  3: { label: "Crítica", cls: "text-red-600 font-semibold" },
};

function StatusBadge({ status }: { status: number }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP[0];
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.color as any} className="gap-1 whitespace-nowrap">
      <Icon className="size-3" />
      {cfg.label}
    </Badge>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{done}/{total}</span>
    </div>
  );
}

function daysSince(isoDate: string): number {
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/* ─── KPI Card ─────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3 shadow-sm">
      <div className={`flex size-10 items-center justify-center rounded-lg ${color}`}>
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

/* ─── Recrutamento tab content (Talent Pipeline) ─────────── */

function RecrutamentoContent() {
  const router = useRouter();
  const [items, setItems] = useState<WorkflowGridRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");

  const [filaRh, setFilaRh] = useState<FilaRhItem[]>([]);
  const [filaRhOpen, setFilaRhOpen] = useState(true);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (tipoFilter !== "all") params.set("tipoWorkflow", tipoFilter);
      params.set("pageSize", "50");

      const res = await apiFetch(`/api/workflow-rh?${params}`);
      if (!res.ok) throw new Error("Erro ao buscar workflows");
      const data: WorkflowGridRow[] = await res.json();
      setItems(data);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao carregar lista");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, tipoFilter]);

  const fetchFilaRh = useCallback(async () => {
    try {
      const res = await apiFetch("/api/vagas/pendencias-rh");
      if (res.ok) {
        const data = await res.json();
        setFilaRh(Array.isArray(data) ? data : []);
      }
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    fetchList();
    fetchFilaRh();
  }, [fetchList, fetchFilaRh]);

  const kpis = useMemo(() => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return {
      aguardando:   items.filter((i) => i.status === 0).length,
      emAndamento:  items.filter((i) => i.status === 1).length,
      slaExcedido:  items.filter((i) => i.slaExcedido && i.status !== 2 && i.status !== 3).length,
      concluidos30d: items.filter(
        (i) => i.status === 2 && new Date(i.createdAtUtc).getTime() > thirtyDaysAgo,
      ).length,
    };
  }, [items]);

  const pipelineSteps = useMemo<StepperStep[]>(() => {
    const activeItems = items.filter((i) => i.status === 0 || i.status === 1);
    if (activeItems.length === 0) return [];

    const etapaOrder: string[] = [];
    const etapaCounts: Record<string, number> = {};
    for (const item of activeItems) {
      const label = item.etapaAtualLabel ?? "Sem etapa";
      if (!etapaCounts[label]) {
        etapaOrder.push(label);
        etapaCounts[label] = 0;
      }
      etapaCounts[label]++;
    }

    return etapaOrder.map((label, i) => ({
      label: `${label} (${etapaCounts[label]})`,
      status: i === 0 ? ("current" as const) : ("pending" as const),
    }));
  }, [items]);

  function handleRowClick(row: WorkflowGridRow) {
    if (row.vagaId) {
      router.push(`/vagas/hub?id=${encodeURIComponent(row.vagaId)}`);
    } else {
      router.push(`/app/painel-rh/${row.id}`);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Acompanhe o pipeline de candidatos, etapas e SLA de cada vaga
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { fetchList(); fetchFilaRh(); }}
          disabled={loading}
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Aguardando Início"
          value={kpis.aguardando}
          icon={PauseCircle}
          color="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        />
        <KpiCard
          label="Em Andamento"
          value={kpis.emAndamento}
          icon={PlayCircle}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300"
        />
        <KpiCard
          label="SLA Excedido"
          value={kpis.slaExcedido}
          icon={AlertTriangle}
          color="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
        />
        <KpiCard
          label="Concluídos (30d)"
          value={kpis.concluidos30d}
          icon={CheckCircle2}
          color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
        />
      </div>

      {/* Pipeline Visual */}
      {pipelineSteps.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Pipeline de Workflows Ativos
          </div>
          <StepperProgress steps={pipelineSteps} orientation="horizontal" />
        </div>
      )}

      {/* Fila de pendências RH */}
      {filaRh.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-900/10 shadow-sm">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-left"
            onClick={() => setFilaRhOpen(!filaRhOpen)}
          >
            <div className="flex items-center gap-2">
              <Briefcase className="size-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Vagas aguardando ação do RH
              </span>
              <Badge variant="secondary" className="text-xs">{filaRh.length}</Badge>
            </div>
            {filaRhOpen
              ? <ChevronUp className="size-4 text-amber-600" />
              : <ChevronDown className="size-4 text-amber-600" />
            }
          </button>
          {filaRhOpen && (
            <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {filaRh.map((item) => {
                const days = daysSince(item.createdAtUtc);
                const urgMeta = URGENCIA_MAP[item.urgencia ?? 0];
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-amber-200/60 bg-white dark:bg-card px-3 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors cursor-pointer"
                    onClick={() => router.push(`/vagas/hub?id=${encodeURIComponent(item.id)}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{item.titulo}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {item.centroCustoName && <span>{item.centroCustoName}</span>}
                        {urgMeta && <span className={urgMeta.cls}>{urgMeta.label}</span>}
                        <span>{days}d atrás</span>
                      </div>
                    </div>
                    <ExternalLink className="size-3.5 text-muted-foreground shrink-0 ml-2" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Filters + Table */}
      <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="font-semibold">Pipeline de Recrutamento</div>
            <div className="text-muted-foreground text-sm">
              {loading ? "Carregando…" : `${items.length} workflows`}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por vaga ou responsável…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Todos os tipos</option>
              <option value="1">Triagem Vaga</option>
              <option value="2">Pós-Efetivação</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">Todos os status</option>
              <option value="0">Não Iniciado</option>
              <option value="1">Em Andamento</option>
              <option value="2">Concluído</option>
              <option value="3">Cancelado</option>
            </select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Vaga / Candidato</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progresso</TableHead>
              <TableHead>Etapa Atual</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead>Criado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Nenhum workflow encontrado.
                </TableCell>
              </TableRow>
            ) : null}
            {items.map((row) => {
              const tipo = TIPO_MAP[row.tipoWorkflow];
              const TipoIcon = tipo?.icon ?? Briefcase;
              return (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(row)}
                >
                  <TableCell className="font-medium">
                    {row.vagaTitulo ?? row.candidatoNome ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <TipoIcon className="size-3.5" />
                      {tipo?.label ?? row.tipoWorkflowLabel}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>
                    <ProgressBar done={row.etapasConcluidas} total={row.totalEtapas} />
                  </TableCell>
                  <TableCell className="text-sm">{row.etapaAtualLabel ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {row.responsavelNome ?? "Não atribuído"}
                  </TableCell>
                  <TableCell>
                    {row.slaExcedido ? (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="size-3" />
                        Excedido
                      </Badge>
                    ) : row.slaPrazoDias ? (
                      <span className="text-sm text-muted-foreground">
                        <Clock className="inline size-3 mr-1" />
                        {row.slaPrazoDias}d
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(row.createdAtUtc).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ─── Main component (tab container) ────────────────────── */

export default function WorkflowRHScreen() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PainelTab>(
    (searchParams.get("tab") as PainelTab) ?? "recrutamento"
  );

  /* ── Pending counts ── */
  const [pendingCounts, setPendingCounts] = useState<{
    desligamentos: number;
    movimentacoes: number;
    ferias: number;
  }>({ desligamentos: 0, movimentacoes: 0, ferias: 0 });

  useEffect(() => {
    const fetchCount = async (url: string): Promise<number> => {
      try {
        const res = await apiFetch(url);
        if (!res.ok) return 0;
        const data = (await res.json()) as unknown[];
        return Array.isArray(data) ? data.length : 0;
      } catch {
        return 0;
      }
    };

    Promise.all([
      fetchCount("/api/solicitacoes-desligamento?status=1&pageSize=200"),
      fetchCount("/api/solicitacoes-promocao?status=1&pageSize=200"),
      fetchCount("/api/colaborador/solicitacoes-ferias?status=1&pageSize=200"),
    ]).then(([desligamentos, movimentacoes, ferias]) => {
      setPendingCounts({ desligamentos, movimentacoes, ferias });
    }).catch(() => { });
  }, []);

  function handleTabChange(tab: PainelTab) {
    setActiveTab(tab);
    router.replace(`/painel-rh?tab=${tab}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
      {/* ── Pending counts cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Desligamentos pendentes", count: pendingCounts.desligamentos, tab: "desligamentos" as PainelTab, color: "bg-red-500/10 text-red-600", icon: UserMinus },
          { label: "Movimentações pendentes", count: pendingCounts.movimentacoes, tab: "movimentacoes" as PainelTab, color: "bg-amber-500/10 text-amber-700", icon: TrendingUp },
          { label: "Férias pendentes",        count: pendingCounts.ferias,        tab: "ferias"        as PainelTab, color: "bg-sky-500/10 text-sky-700",   icon: Palmtree  },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.tab}
              type="button"
              onClick={() => handleTabChange(c.tab)}
              className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
            >
              <div className={`flex size-9 items-center justify-center rounded-lg ${c.color}`}>
                <Icon className="size-4" />
              </div>
              <div>
                <div className="text-xl font-bold tabular-nums">{c.count}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border/40">
        {PAINEL_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-[1px] transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "recrutamento"  && <RecrutamentoContent />}
      {activeTab === "movimentacoes" && <PromocoesScreen />}
      {activeTab === "desligamentos" && <DesligamentosScreen />}
      {activeTab === "ferias"        && <FeriasScreen />}
    </div>
  );
}
