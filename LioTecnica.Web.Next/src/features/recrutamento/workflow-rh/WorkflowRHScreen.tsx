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
  Filter,
  TrendingUp,
  UserMinus,
  Palmtree,
  CalendarDays,
  Heart,
  MapPin,
  DollarSign,
  Users,
  Download,
  Plus,
  LayoutList,
  Loader2,
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
import TodosScreen from "@/features/gestao/todos/TodosScreen";
import PromocoesScreen from "@/features/gestao/promocoes/PromocoesScreen";
import DesligamentosScreen from "@/features/gestao/desligamentos/DesligamentosScreen";
import DesligamentosTotvsList from "@/features/gestao/desligamentos/DesligamentosTotvsList";
import FeriasScreen from "@/features/gestao/ferias/FeriasScreen";

/* ─── Tab config ─────────────────────────────────────────── */

type PainelTab = "todos" | "recrutamento" | "desligamentos";

// 2026-04-26: removidas abas Dependentes/Benefícios/Endereço/Pagamento Extra
// (eram dados pessoais do colaborador — não fluxo de RH).
// 2026-04-27: removida aba Férias (Liotécnica não tem PFFERIAS sincronizado) e
//             aba Movimentação (era redundante com Desligamento — 26/28 itens
//             eram desligamentos; promoções/transferências reais são raras e
//             ficam no Perfil 360 do funcionário).
//             Tabs agora apontam pra dados RM (espelho TOTVS) em vez do fluxo
//             de Solicitação Portal que estava vazio.
const PAINEL_TABS: { id: PainelTab; label: string; icon: React.ElementType }[] = [
  { id: "todos",          label: "Todos",           icon: LayoutList  },
  { id: "recrutamento",   label: "Recrutamento",    icon: Briefcase   },
  { id: "desligamentos",  label: "Desligamento",    icon: UserMinus   },
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
  centroCustoName: string | null;
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
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchList(); fetchFilaRh(); }}
            disabled={loading}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              apiFetch("/api/workflow-rh/export")
                .then((r) => r.blob())
                .then((blob) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "recrutamento.csv"; a.click(); })
                .catch(() => toast.error("Falha ao exportar."));
            }}
          >
            <Download className="size-4" />
            <span className="hidden sm:inline">Exportar</span>
          </Button>
          <Button size="sm" onClick={() => router.push("/vagas")}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">Nova vaga</span>
          </Button>
        </div>
      </div>

      {/* Filters + Table */}
      <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h4 className="text-lg font-bold">Pipeline de Recrutamento</h4>
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
            {!loading && filteredItems.length === 0 && filaRh.length === 0 && (
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

            {/* Fila RH rows — vagas aguardando ação do RH */}
            {!loading && filaRh.map((item) => {
              const days = daysSince(item.createdAtUtc);
              const meta = urgenciaMeta(item.urgencia ?? 0);
              const isUrgent = days > 7 || item.alertaHCProvVencido;
              const hasPendente = (item.headcountPendente ?? 0) > 0;
              return (
                <TableRow
                  key={`fila-${item.id}`}
                  className={`cursor-pointer border-l-4 ${isUrgent ? "border-red-400 bg-red-50/40 hover:bg-red-50/60 dark:bg-red-900/10 dark:hover:bg-red-900/20" : "border-amber-400 bg-amber-50/40 hover:bg-amber-50/60 dark:bg-amber-900/10 dark:hover:bg-amber-900/20"}`}
                  onClick={() => router.push(`/vagas/hub?id=${encodeURIComponent(item.id)}`)}
                >
                  <TableCell className="font-medium">
                    <div className="truncate max-w-[200px]">{item.titulo}</div>
                    {item.areaName && <div className="text-xs text-muted-foreground truncate">{item.areaName}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Briefcase className="size-3.5 text-amber-600" />
                      <span className="text-amber-700 font-medium">Contratação</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      <AlertTriangle className="size-3" />
                      Aguarda RH
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground italic">—</span>
                  </TableCell>
                  <TableCell className="text-sm text-amber-700">Ação do RH necessária</TableCell>
                  <TableCell className="text-sm text-muted-foreground">—</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <span className={`text-xs font-medium ${isUrgent ? "text-red-600" : "text-muted-foreground"}`}>{days}d atrás</span>
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
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(item.createdAtUtc).toLocaleDateString("pt-BR")}
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

  function handleTabChange(tab: PainelTab) {
    setActiveTab(tab);
    router.replace(`/painel-rh?tab=${tab}`, { scroll: false });
  }

  return (
    <div className="space-y-4">
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

      {/* Tab content — todos os tabs apontam pra dados RM (espelho TOTVS) */}
      {activeTab === "todos"           && <PainelTodosRm />}
      {activeTab === "recrutamento"    && <PainelRecrutamentoRm />}
      {activeTab === "desligamentos"   && <DesligamentosTabWithToggle />}
    </div>
  );
}

/* ─── Componentes RM (espelho TOTVS) ──────────────────────── */

interface VagaRm {
  id: string;
  codigo: string;
  titulo: string;
  centroCustoNome: string | null;
  origemTipo: string | null;
  substituindoNome: string | null;
  funcaoNomeRm: string | null;
  hierarquiaDescricao: string | null;
  idReqRmOrigem: string | null;
  dataAbertura: string | null;
  createdAtUtc: string;
}
interface MovimentacaoRm {
  id: string;
  funcionarioId: string | null;
  funcionarioNome: string | null;
  chapaRm: string;
  tipoDescricao: string | null;
  statusDescricao: string | null;
  codFuncaoOrigem: string | null;
  codFuncaoDestino: string | null;
  salarioOrigem: number | null;
  salarioDestino: number | null;
  dataAbertura: string;
}
interface DesligamentoRm {
  id: string;
  funcionarioNome: string | null;
  tipoRescisaoDescricao: string | null;
  motivoRescisaoDescricao: string | null;
  statusDescricao: string | null;
  gerouSubstituicao: boolean;
  dataAbertura: string;
}

function fmtBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
}

function PainelRecrutamentoRm() {
  const router = useRouter();
  const [items, setItems] = useState<VagaRm[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOrigem, setFilterOrigem] = useState<"" | "AumentoQuadro" | "SubstituicaoDesligamento" | "SubstituicaoPromocao">("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/vagas?status=Aberta&pageSize=200")
      .then((r) => r.json())
      .then((d: { items?: VagaRm[] } | VagaRm[]) =>
        setItems(Array.isArray(d) ? d : (d.items ?? []))
      )
      .catch(() => toast.error("Falha ao carregar vagas."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let rows = items;
    if (filterOrigem) rows = rows.filter((v) => v.origemTipo === filterOrigem);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((v) =>
        (v.titulo ?? "").toLowerCase().includes(q) ||
        (v.codigo ?? "").toLowerCase().includes(q) ||
        (v.centroCustoNome ?? "").toLowerCase().includes(q) ||
        (v.substituindoNome ?? "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [items, search, filterOrigem]);

  const stats = useMemo(() => ({
    total: items.length,
    aumentoQuadro: items.filter((v) => v.origemTipo === "AumentoQuadro").length,
    substituicao: items.filter((v) => v.origemTipo === "SubstituicaoDesligamento" || v.origemTipo === "SubstituicaoPromocao").length,
  }), [items]);

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Total</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
          <div className="text-xs text-violet-700">Aumento Quadro</div>
          <div className="text-2xl font-bold text-violet-800 mt-1">{stats.aumentoQuadro}</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-xs text-blue-700">Substituição</div>
          <div className="text-2xl font-bold text-blue-800 mt-1">{stats.substituicao}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por título, código, CC, substituído..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded outline-none focus:border-blue-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterOrigem}
          onChange={(e) => setFilterOrigem(e.target.value as typeof filterOrigem)}
          className="text-sm px-3 py-1.5 border border-slate-300 rounded outline-none focus:border-blue-400"
        >
          <option value="">Todas as origens</option>
          <option value="AumentoQuadro">Aumento Quadro</option>
          <option value="SubstituicaoDesligamento">Subst. Desligamento</option>
          <option value="SubstituicaoPromocao">Subst. Promoção</option>
        </select>
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 flex items-center gap-1"
          disabled={loading}
        >
          {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Atualizar
        </button>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="max-h-[calc(100dvh-380px)] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Cód.</th>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Título / Função</th>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Centro de Custo</th>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Origem</th>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Substituindo</th>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Aberta em</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400"><Loader2 className="size-5 animate-spin mx-auto mb-2" />Carregando...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400"><Briefcase className="size-8 mx-auto mb-2 text-slate-300" />Nenhuma vaga aberta encontrada.</td></tr>
              )}
              {filtered.map((v) => (
                <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => router.push(`/vagas/hub?id=${encodeURIComponent(v.id)}`)}>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{v.codigo}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{v.titulo}</div>
                    {v.funcaoNomeRm && <div className="text-xs text-slate-500">{v.funcaoNomeRm}</div>}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{v.centroCustoNome ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {v.origemTipo === "AumentoQuadro" ? "Aumento Quadro"
                      : v.origemTipo === "SubstituicaoDesligamento" ? "Subst. Desligamento"
                      : v.origemTipo === "SubstituicaoPromocao" ? "Subst. Promoção"
                      : v.origemTipo ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{v.substituindoNome ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{fmtBR(v.dataAbertura ?? v.createdAtUtc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-3 py-2 text-xs text-slate-500 border-t border-slate-200 bg-slate-50">
            Exibindo {filtered.length} de {items.length} vagas.
          </div>
        )}
      </div>
    </div>
  );
}

function PainelMovimentacoesRm() {
  const [items, setItems] = useState<MovimentacaoRm[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch("/api/funcionarios/movimentacoes?codStatus=1&codStatus=2&codStatus=5&pageSize=200")
      .then((r) => r.json())
      .then((d: MovimentacaoRm[]) => setItems(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Falha ao carregar movimentações."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const tiposUnicos = useMemo(
    () => Array.from(new Set(items.map((m) => m.tipoDescricao).filter(Boolean) as string[])).sort(),
    [items]
  );

  const filtered = useMemo(() => {
    let rows = items;
    if (filterTipo) rows = rows.filter((m) => m.tipoDescricao === filterTipo);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((m) =>
        (m.funcionarioNome ?? "").toLowerCase().includes(q) ||
        (m.tipoDescricao ?? "").toLowerCase().includes(q) ||
        (m.chapaRm ?? "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [items, search, filterTipo]);

  const stats = useMemo(() => ({
    total: items.length,
    promocao: items.filter((m) => (m.tipoDescricao ?? "").toLowerCase().includes("promo")).length,
    salarial: items.filter((m) => /acordo|enquadra|plano|aumento/i.test(m.tipoDescricao ?? "")).length,
  }), [items]);

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Total pendentes</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</div>
        </div>
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
          <div className="text-xs text-teal-700">Promoções</div>
          <div className="text-2xl font-bold text-teal-800 mt-1">{stats.promocao}</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="text-xs text-amber-700">Mudanças salariais</div>
          <div className="text-2xl font-bold text-amber-800 mt-1">{stats.salarial}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por funcionário, chapa, tipo..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded outline-none focus:border-blue-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
          className="text-sm px-3 py-1.5 border border-slate-300 rounded outline-none focus:border-blue-400"
        >
          <option value="">Todos os tipos</option>
          {tiposUnicos.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 flex items-center gap-1"
          disabled={loading}
        >
          {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Atualizar
        </button>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="max-h-[calc(100dvh-380px)] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Funcionário</th>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Chapa</th>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Tipo</th>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Status</th>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Função (origem→destino)</th>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Salário</th>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Abertura</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400"><Loader2 className="size-5 animate-spin mx-auto mb-2" />Carregando...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-slate-400"><TrendingUp className="size-8 mx-auto mb-2 text-slate-300" />Nenhuma movimentação encontrada.</td></tr>
              )}
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{m.funcionarioNome ?? <span className="text-slate-400 italic">CHAPA não vinculada</span>}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{m.chapaRm}</td>
                  <td className="px-3 py-2 text-slate-700">{m.tipoDescricao ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{m.statusDescricao ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{m.codFuncaoOrigem ?? "—"} → {m.codFuncaoDestino ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">
                    {m.salarioOrigem != null ? `R$ ${m.salarioOrigem.toFixed(2)}` : "—"} → {m.salarioDestino != null ? `R$ ${m.salarioDestino.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{fmtBR(m.dataAbertura)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-3 py-2 text-xs text-slate-500 border-t border-slate-200 bg-slate-50">
            Exibindo {filtered.length} de {items.length} movimentações.
          </div>
        )}
      </div>
    </div>
  );
}

function PainelTodosRm() {
  const [vagas, setVagas] = useState<VagaRm[]>([]);
  const [desls, setDesls] = useState<DesligamentoRm[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState<"" | "Recrutamento" | "Desligamento">("");

  const load = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      apiFetch("/api/vagas?status=Aberta&pageSize=200").then((r) => r.json()),
      apiFetch("/api/desligamentos?codStatus=1&codStatus=2&codStatus=5&pageSize=200").then((r) => r.json()),
    ]).then(([v, d]) => {
      setVagas(v.status === "fulfilled" ? (Array.isArray(v.value) ? v.value : (v.value?.items ?? [])) : []);
      setDesls(d.status === "fulfilled" && Array.isArray(d.value) ? d.value : []);
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  type Linha = {
    id: string;
    tipo: "Recrutamento" | "Desligamento";
    descricao: string;
    detalhe: string;
    data: string;
  };

  const linhas: Linha[] = useMemo(() => {
    const out: Linha[] = [];
    for (const v of vagas) {
      const partes = [v.centroCustoNome, v.substituindoNome ? `Subst. ${v.substituindoNome}` : null].filter(Boolean) as string[];
      out.push({ id: `v-${v.id}`, tipo: "Recrutamento", descricao: `${v.codigo} · ${v.titulo}`, detalhe: partes.join(" · "), data: v.dataAbertura ?? v.createdAtUtc });
    }
    for (const d of desls) {
      const partes = [d.tipoRescisaoDescricao, d.statusDescricao, d.gerouSubstituicao ? "gera substituição" : null].filter(Boolean) as string[];
      out.push({ id: `d-${d.id}`, tipo: "Desligamento", descricao: d.funcionarioNome ?? "—", detalhe: partes.join(" · "), data: d.dataAbertura });
    }
    return out.sort((a, b) => (a.data < b.data ? 1 : -1));
  }, [vagas, desls]);

  const filtered = useMemo(() => {
    let rows = linhas;
    if (filterTipo) rows = rows.filter((l) => l.tipo === filterTipo);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((l) => l.descricao.toLowerCase().includes(q) || l.detalhe.toLowerCase().includes(q) || l.tipo.toLowerCase().includes(q));
    }
    return rows;
  }, [linhas, search, filterTipo]);

  const tipoChip = (tipo: Linha["tipo"]) => {
    const map = {
      Recrutamento: "bg-violet-500/15 text-violet-700",
      Desligamento: "bg-rose-500/15 text-rose-700",
    } as const;
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${map[tipo]}`}>{tipo}</span>;
  };

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">Total</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{linhas.length}</div>
        </div>
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
          <div className="text-xs text-violet-700">Recrutamento</div>
          <div className="text-2xl font-bold text-violet-800 mt-1">{vagas.length}</div>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
          <div className="text-xs text-rose-700">Desligamento</div>
          <div className="text-2xl font-bold text-rose-800 mt-1">{desls.length}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por descrição, detalhe..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded outline-none focus:border-blue-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value as typeof filterTipo)}
          className="text-sm px-3 py-1.5 border border-slate-300 rounded outline-none focus:border-blue-400"
        >
          <option value="">Todos os tipos</option>
          <option value="Recrutamento">Recrutamento</option>
          <option value="Desligamento">Desligamento</option>
        </select>
        <button
          onClick={load}
          className="text-xs px-3 py-1.5 border border-slate-300 rounded hover:bg-slate-50 flex items-center gap-1"
          disabled={loading}
        >
          {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Atualizar
        </button>
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="max-h-[calc(100dvh-380px)] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-slate-700 w-32">Tipo</th>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Descrição</th>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Detalhe</th>
                <th className="text-left px-3 py-2 font-medium text-slate-700">Data</th>
              </tr>
            </thead>
            <tbody>
              {loading && filtered.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-slate-400"><Loader2 className="size-5 animate-spin mx-auto mb-2" />Carregando...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-slate-400"><LayoutList className="size-8 mx-auto mb-2 text-slate-300" />Nenhum item encontrado.</td></tr>
              )}
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">{tipoChip(l.tipo)}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{l.descricao}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{l.detalhe || "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{fmtBR(l.data)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-3 py-2 text-xs text-slate-500 border-t border-slate-200 bg-slate-50">
            Exibindo {filtered.length} de {linhas.length} itens.
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Componente interno: aba "Desligamento" do Painel RH com toggle entre fonte
 * TOTVS RM (default — VREQDESLIGAMENTO sincronizado pelo worker) e Datasul
 * (SolicitacoesDesligamento — fluxo interno).
 *
 * Liotécnica usa TOTVS RM, então TOTVS é o default.
 */
function DesligamentosTabWithToggle() {
  const [fonte, setFonte] = useState<"totvs" | "datasul">("totvs");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shrink-0">
          <button
            onClick={() => setFonte("totvs")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              fonte === "totvs"
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Desligamentos sincronizados do TOTVS RM (VREQDESLIGAMENTO)"
          >
            TOTVS RM
          </button>
          <button
            onClick={() => setFonte("datasul")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              fonte === "datasul"
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Solicitações internas (SolicitacoesDesligamento — Datasul)"
          >
            Datasul
          </button>
        </div>
      </div>
      {fonte === "totvs" ? <DesligamentosTotvsList /> : <DesligamentosScreen />}
    </div>
  );
}
