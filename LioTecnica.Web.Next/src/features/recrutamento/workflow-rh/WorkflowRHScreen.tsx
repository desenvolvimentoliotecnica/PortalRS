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
  Filter,
  ExternalLink,
  TrendingUp,
  UserMinus,
  Palmtree,
  CalendarDays,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  AGING_BUCKETS,
  type AgingBucket,
  daysSince,
  matchesAgingBucket,
  slaStatus,
  urgenciaMeta,
} from "@/features/shared/urgencia";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/ui/EmptyState";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  areaName: string | null;
  urgencia?: number;
  createdAtUtc: string;
  headcountPendente?: number;
  alertaHCProvVencido?: boolean;
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


/* ─── KPI Card ─────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  onClick,
  active,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const inner = (
    <>
      <div className={`flex size-10 items-center justify-center rounded-lg ${color}`}>
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`Filtrar por: ${label}`}
        className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 shadow-sm text-left transition-colors hover:bg-muted/40 ${
          active
            ? "border-primary bg-primary/5"
            : "border-border/40 bg-card"
        }`}
      >
        {inner}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3 shadow-sm">
      {inner}
    </div>
  );
}

/* ─── Recrutamento tab content (Talent Pipeline) ─────────── */

function RecrutamentoContent() {
  const router = useRouter();
  const [items, setItems] = useState<WorkflowGridRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [tipoFilter, setTipoFilter] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [agingBucket, setAgingBucket] = useState<AgingBucket>("");

  const [filaRh, setFilaRh] = useState<FilaRhItem[]>([]);
  const [filaRhOpen, setFilaRhOpen] = useState(true);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      // "sla" is client-side only; numeric values go to the API
      const apiStatuses = statusFilter.filter(s => s !== "sla");
      if (apiStatuses.length === 1) params.set("status", apiStatuses[0]);
      if (tipoFilter.length === 1) params.set("tipoWorkflow", tipoFilter[0]);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter.join(","), tipoFilter.join(",")]);

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

  /** Client-side refinement: date range, aging bucket, tipo multi-select, and "sla" pseudo-filter */
  const filteredItems = useMemo(() => {
    return items.filter((row) => {
      // multi-select tipo (client-side when >1 selected, since API only accepts single)
      if (tipoFilter.length > 1 && !tipoFilter.includes(String(row.tipoWorkflow))) return false;
      // "sla" is a virtual status value handled client-side
      if (statusFilter.includes("sla") && !row.slaExcedido) return false;
      // numeric status values (when multiple selected, filter client-side)
      const numericStatuses = statusFilter.filter(s => s !== "sla");
      if (numericStatuses.length > 1 && !numericStatuses.includes(String(row.status))) return false;
      const dateField = row.createdAtUtc;
      if (dateFrom && dateField && new Date(dateField) < new Date(dateFrom)) return false;
      if (dateTo && dateField && new Date(dateField) > new Date(`${dateTo}T23:59:59`)) return false;
      if (!matchesAgingBucket(dateField, agingBucket)) return false;
      return true;
    });
  }, [items, statusFilter, tipoFilter, dateFrom, dateTo, agingBucket]);

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

      {/* KPI Cards — clicáveis como atalho de filtro (J3) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Aguardando Início"
          value={kpis.aguardando}
          icon={PauseCircle}
          color="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          active={statusFilter.includes("0")}
          onClick={() => setStatusFilter(prev => prev.includes("0") ? prev.filter(s => s !== "0") : [...prev, "0"])}
        />
        <KpiCard
          label="Em Andamento"
          value={kpis.emAndamento}
          icon={PlayCircle}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300"
          active={statusFilter.includes("1")}
          onClick={() => setStatusFilter(prev => prev.includes("1") ? prev.filter(s => s !== "1") : [...prev, "1"])}
        />
        <KpiCard
          label="SLA Excedido"
          value={kpis.slaExcedido}
          icon={AlertTriangle}
          color="bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
          active={statusFilter.includes("sla")}
          onClick={() => setStatusFilter(prev => prev.includes("sla") ? prev.filter(s => s !== "sla") : [...prev, "sla"])}
        />
        <KpiCard
          label="Concluídos (30d)"
          value={kpis.concluidos30d}
          icon={CheckCircle2}
          color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300"
          active={statusFilter.includes("2")}
          onClick={() => setStatusFilter(prev => prev.includes("2") ? prev.filter(s => s !== "2") : [...prev, "2"])}
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
                const meta = urgenciaMeta(item.urgencia ?? 0);
                const isUrgent = days > 7 || item.alertaHCProvVencido;
                const hasPendente = (item.headcountPendente ?? 0) > 0;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between rounded-lg border bg-white dark:bg-card px-3 py-2.5 transition-colors cursor-pointer ${
                      isUrgent
                        ? "border-red-300/70 hover:bg-red-50 dark:hover:bg-red-900/20"
                        : "border-amber-200/60 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                    }`}
                    onClick={() => router.push(`/vagas/hub?id=${encodeURIComponent(item.id)}`)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{item.titulo}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {item.areaName && <span>{item.areaName}</span>}
                        <span className={meta.text}>{meta.label}</span>
                        <span className={isUrgent ? "text-red-600 font-medium" : ""}>{days}d atrás</span>
                        {hasPendente && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            +{item.headcountPendente} HC pend.
                          </span>
                        )}
                        {item.alertaHCProvVencido && (
                          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                            HC Prov. Vencido
                          </span>
                        )}
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
              {loading ? "Carregando…" : `${filteredItems.length} workflow(s)`}
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
            {/* Multi-select — Tipo */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Filter className="size-3.5 opacity-60" />
                  {tipoFilter.length === 0
                    ? "Todos os tipos"
                    : tipoFilter.length === 1
                      ? (tipoFilter[0] === "1" ? "Triagem Vaga" : "Pós-Efetivação")
                      : `${tipoFilter.length} tipos`}
                  <ChevronDown className="size-3.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[160px]">
                <DropdownMenuCheckboxItem checked={tipoFilter.length === 0} onCheckedChange={() => setTipoFilter([])}>
                  Todos os tipos
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {[{ value: "1", label: "Triagem Vaga" }, { value: "2", label: "Pós-Efetivação" }].map(opt => (
                  <DropdownMenuCheckboxItem
                    key={opt.value}
                    checked={tipoFilter.includes(opt.value)}
                    onCheckedChange={(checked) => setTipoFilter(prev => checked ? [...prev, opt.value] : prev.filter(t => t !== opt.value))}
                  >
                    {opt.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Multi-select — Status */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  {statusFilter.length === 0
                    ? "Todos os status"
                    : `${statusFilter.length} status`}
                  <ChevronDown className="size-3.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[170px]">
                <DropdownMenuCheckboxItem checked={statusFilter.length === 0} onCheckedChange={() => setStatusFilter([])}>
                  Todos os status
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {[
                  { value: "0",   label: "Não Iniciado" },
                  { value: "1",   label: "Em Andamento" },
                  { value: "2",   label: "Concluído"    },
                  { value: "3",   label: "Cancelado"    },
                  { value: "sla", label: "SLA Excedido" },
                ].map(opt => (
                  <DropdownMenuCheckboxItem
                    key={opt.value}
                    checked={statusFilter.includes(opt.value)}
                    onCheckedChange={(checked) => setStatusFilter(prev => checked ? [...prev, opt.value] : prev.filter(s => s !== opt.value))}
                  >
                    {opt.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* F1 — Date range filter + F2 — Aging bucket chips */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" />
            <span>Criado em:</span>
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            title="Data inicial"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            title="Data final"
          />
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Limpar
            </button>
          )}

          <div className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            <span>Aging:</span>
          </div>
          {AGING_BUCKETS.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => setAgingBucket(prev => prev === b.value ? "" : b.value)}
              className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-colors ${
                agingBucket === b.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {b.label}
            </button>
          ))}
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
            {/* J2 — Skeleton rows while loading */}
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={`skel-${i}`}>
                {Array.from({ length: 8 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 rounded" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

            {/* J2 — Rich empty state */}
            {!loading && filteredItems.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={8} className="py-4">
                  <EmptyState
                    icon={Briefcase}
                    title="Nenhum workflow encontrado"
                    description={
                      dateFrom || dateTo || agingBucket || statusFilter.length > 0 || tipoFilter.length > 0
                        ? "Nenhum resultado para os filtros aplicados. Tente ajustá-los."
                        : "Não há workflows de recrutamento em andamento no momento."
                    }
                    actions={
                      dateFrom || dateTo || agingBucket || statusFilter.length > 0 || tipoFilter.length > 0
                        ? [{ label: "Limpar filtros", onClick: () => { setSearch(""); setStatusFilter([]); setTipoFilter([]); setDateFrom(""); setDateTo(""); setAgingBucket(""); } }]
                        : []
                    }
                  />
                </TableCell>
              </TableRow>
            )}

            {/* A2 — Rows with red left-border for overdue SLA */}
            {!loading && filteredItems.map((row) => {
              const tipo = TIPO_MAP[row.tipoWorkflow];
              const TipoIcon = tipo?.icon ?? Briefcase;
              const slaSt = slaStatus(row.slaPrazoDias, row.slaExcedido);
              return (
                <TableRow
                  key={row.id}
                  className={`cursor-pointer hover:bg-muted/50 ${slaSt === "overdue" ? "border-l-4 border-red-500" : slaSt === "warning" ? "border-l-4 border-amber-400" : ""}`}
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
                  {/* A2 + A4 — SLA column with unified visual */}
                  <TableCell>
                    {slaSt === "overdue" ? (
                      <Badge variant="destructive" className="gap-1 animate-pulse">
                        <AlertTriangle className="size-3" />
                        Excedido
                      </Badge>
                    ) : slaSt === "warning" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        <Clock className="size-3" />
                        Faltam {row.slaPrazoDias}d
                      </span>
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
