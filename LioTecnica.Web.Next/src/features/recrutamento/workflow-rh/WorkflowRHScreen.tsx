"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
}

/* ─── Status helpers ────────────────────────────────────── */

const STATUS_MAP: Record<number, { label: string; color: string; icon: React.ElementType }> = {
  0: { label: "Não Iniciado", color: "secondary", icon: PauseCircle },
  1: { label: "Em Andamento", color: "default", icon: PlayCircle },
  2: { label: "Concluído", color: "default", icon: CheckCircle2 },
  3: { label: "Cancelado", color: "destructive", icon: XCircle },
};

const TIPO_MAP: Record<number, { label: string; icon: React.ElementType }> = {
  1: { label: "Triagem Vaga", icon: Briefcase },
  2: { label: "Pós-Efetivação", icon: UserCheck },
};

const URGENCIA_MAP: Record<number, { label: string; cls: string }> = {
  0: { label: "Baixa", cls: "text-zinc-500" },
  1: { label: "Média", cls: "text-amber-600" },
  2: { label: "Alta", cls: "text-orange-600" },
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
      <span className="text-xs text-muted-foreground">
        {done}/{total}
      </span>
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

/* ─── Component ─────────────────────────────────────────── */

export default function WorkflowRHScreen() {
  const router = useRouter();
  const [items, setItems] = useState<WorkflowGridRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tipoFilter, setTipoFilter] = useState<string>("all");

  // Fila RH
  const [filaRh, setFilaRh] = useState<FilaRhItem[]>([]);
  const [filaRhLoading, setFilaRhLoading] = useState(false);
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
    setFilaRhLoading(true);
    try {
      const res = await apiFetch("/api/vagas/pendencias-rh");
      if (res.ok) {
        const data = await res.json();
        setFilaRh(Array.isArray(data) ? data : []);
      }
    } catch {
      // silencioso
    } finally {
      setFilaRhLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
    fetchFilaRh();
  }, [fetchList, fetchFilaRh]);

  /* ── KPIs (computed client-side) ── */
  const kpis = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    return {
      aguardando: items.filter((i) => i.status === 0).length,
      emAndamento: items.filter((i) => i.status === 1).length,
      slaExcedido: items.filter((i) => i.slaExcedido && i.status !== 2 && i.status !== 3).length,
      concluidos30d: items.filter(
        (i) => i.status === 2 && new Date(i.createdAtUtc).getTime() > thirtyDaysAgo,
      ).length,
    };
  }, [items]);

  /* ── Pipeline steps (aggregate by etapaAtualLabel) ── */
  const pipelineSteps = useMemo<StepperStep[]>(() => {
    const activeItems = items.filter((i) => i.status === 0 || i.status === 1);
    if (activeItems.length === 0) return [];

    // Collect unique etapa labels in order of appearance
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

  /* ── Row click → VagaHub or workflow detail ── */
  function handleRowClick(row: WorkflowGridRow) {
    if (row.vagaId) {
      router.push(`/vagas/hub?id=${encodeURIComponent(row.vagaId)}`);
    } else {
      router.push(`/app/painel-rh/${row.id}`);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Painel RH</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            fetchList();
            fetchFilaRh();
          }}
          disabled={loading}
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* ── KPI Cards ── */}
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

      {/* ── Pipeline Visual ── */}
      {pipelineSteps.length > 0 && (
        <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Pipeline de Workflows Ativos
          </div>
          <StepperProgress steps={pipelineSteps} orientation="horizontal" />
        </div>
      )}

      {/* ── Fila de pendências RH ── */}
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
              <Badge variant="secondary" className="text-xs">
                {filaRh.length}
              </Badge>
            </div>
            {filaRhOpen ? (
              <ChevronUp className="size-4 text-amber-600" />
            ) : (
              <ChevronDown className="size-4 text-amber-600" />
            )}
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
                    onClick={() =>
                      router.push(`/vagas/hub?id=${encodeURIComponent(item.id)}`)
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{item.titulo}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {item.areaName && <span>{item.areaName}</span>}
                        {urgMeta && (
                          <span className={urgMeta.cls}>{urgMeta.label}</span>
                        )}
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por vaga ou responsável..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <select
          value={tipoFilter}
          onChange={(e) => setTipoFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">Todos os tipos</option>
          <option value="1">Triagem Vaga</option>
          <option value="2">Pós-Efetivação</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">Todos os status</option>
          <option value="0">Não Iniciado</option>
          <option value="1">Em Andamento</option>
          <option value="2">Concluído</option>
          <option value="3">Cancelado</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
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
                  <TableCell className="text-sm">
                    {row.etapaAtualLabel ?? "—"}
                  </TableCell>
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
                    ) : (
                      "—"
                    )}
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
