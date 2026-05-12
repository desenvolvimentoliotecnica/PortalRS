"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    Search,
    RefreshCw,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Clock,
    FileText,
    Eye,
    Briefcase,
    Palmtree,
    Heart,
    Users,
    MapPin,
    UserCheck,
    GitBranch,
    TrendingUp,
    UserMinus,
    CheckCheck,
    X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { usePendencias } from "@/contexts/PendenciasContext";
import { type EtapaAprovacaoResponse } from "@/features/gestao/shared/etapaUtils";
import {
    SolicitacaoVagaStatusBadgeEl,
    normalizeSolicitacaoStatusOrdinal,
    statusBadge as solicitacaoVagaStatusBadgeMeta,
} from "@/features/gestao/shared/solicitacaoVagaStatusUi";
import SolicitacaoForm from "@/features/gestao/solicitacoes/SolicitacaoForm";

import NextStepBanner from "@/components/feedback/NextStepBanner";
import DesligamentoFormModal from "@/features/gestao/desligamentos/DesligamentoFormModal";
import PromocaoFormModal from "@/features/gestao/promocoes/PromocaoFormModal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableHeader,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

/* ──────────────────────────── types ──────────────────────────── */

type StatusKey = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10;
type UrgenciaKey = 0 | 1 | 2 | 3;

// StatusAprovacao: 0=Pendente, 1=Aprovado, 2=Reprovado
interface EtapaFluxoInfo {
    ordem: number;
    label: string;
    aprovadorNome: string | null;
    roleNome: string | null;
    status: number;
    dataUtc: string | null;
    observacao: string | null;
}

interface SolicitacaoDetail {
    id: string;
    titulo: string;
    codFuncaoRm?: string | null;
    funcaoNomeRm?: string | null;
    justificativa: string | null;
    qtdPosicoes: number;
    urgencia: number;
    status: number | string;
    solicitanteId: string;
    solicitanteNome: string | null;
    aprovadorId: string | null;
    aprovadorNome: string | null;
    jobPositionId: string | null;
    jobPositionName: string | null;
    unitId: string | null;
    unitName: string | null;
    vagaId: string | null;
    observacaoAprovador: string | null;
    tipoSolicitacao: number;
    isConfidencial: boolean;
    substituidoNome: string | null;
    // A.RH.013
    tipoContrato: number;
    prazoDias: number | null;
    motivoRequisicao: number | null;
    cnhObrigatoria: boolean;
    disponibilidadeViagens: boolean;
    escalaTrabalho: string | null;
    empresaId: string | null;
    empresaNome: string | null;
    centroCustoId: string | null;
    centroCustoNome: string | null;
    unidadeLotacaoId: string | null;
    unidadeLotacaoNome: string | null;
    createdAtUtc: string;
    updatedAtUtc: string;
    approvedAtUtc: string | null;
    etapasFluxo: EtapaFluxoInfo[];
}

// Generic row from any API
type GenericRow = Record<string, unknown> & { id: string };

/* ──────────────────────────── helpers ──────────────────────────── */

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

function pick(row: GenericRow, key: string, fb = "—") {
    const v = row[key];
    if (v == null) return fb;
    return String(v);
}

/** RM: VREQDESLIGAMENTO também entra em FuncionarioMovimentacao (tipo 5). */
const RM_TIPO_MOVIMENTACAO_DESLIGAMENTO = 5;

function isRmDesligamentoMovimentacao(row: GenericRow): boolean {
    const t = row.tipoMovimentacao;
    const n = typeof t === "number" ? t : typeof t === "string" ? parseInt(t, 10) : NaN;
    if (n === RM_TIPO_MOVIMENTACAO_DESLIGAMENTO) return true;
    return pick(row, "tipoDescricao").toLowerCase().includes("desligamento");
}

function effectiveRmListTabId(row: GenericRow, sourceTab: "contratacao" | "promocao" | "desligamento"): "contratacao" | "promocao" | "desligamento" {
    if (sourceTab === "promocao" && isRmDesligamentoMovimentacao(row)) return "desligamento";
    return sourceTab;
}

interface PortalPendenteApi {
    solicitacaoId: string;
    tipoFluxo: string;
    tipoLabel: string;
    titulo: string;
    solicitanteNome?: string | null;
    dataCriacao: string;
    statusLabel: string;
    etapaLabel?: string | null;
    etapaPendenteIsQueue?: boolean;
}

function mapPortalPendenteToRow(p: PortalPendenteApi): GenericRow & { _tabId: string; _portalTipoFluxo: string } {
    const iso = p.dataCriacao;
    return {
        id: String(p.solicitacaoId),
        _tabId: "portal",
        _portalTipoFluxo: p.tipoFluxo,
        titulo: p.titulo,
        funcionarioNome: p.solicitanteNome ?? "—",
        tipoDescricao: p.tipoLabel,
        statusDescricao: p.statusLabel,
        etapaPendenteLabel: p.etapaLabel ?? "",
        etapaPendenteIsQueue: Boolean(p.etapaPendenteIsQueue),
        createdAtUtc: iso,
        dataAbertura: iso,
    };
}

/** Status de SolicitacaoVaga que ainda exigem ação no Portal/RH. Exclui 4 (AjustesNecessarios): volta ao solicitante, não deve aparecer em Minhas Pendências do aprovador. */
const SOLICITACAO_VAGA_STATUS_PENDENTE_GESTAO = [1, 2, 5, 7, 8, 10, 11, 12, 13, 14, 15, 16] as const;

/** Status em que o Portal aceita aprovar / reprovar / solicitar ajustes (backend valida permissão). */
function solicitacaoVagaStatusAllowsApprovalActions(statusRaw: unknown): boolean {
    const ord = normalizeSolicitacaoStatusOrdinal(statusRaw);
    return ord === 1 || ord === 5 || ord === 10;
}

function mapSolicitacaoVagaGridApiToPortalRow(r: Record<string, unknown>): GenericRow & { _tabId: string; _portalTipoFluxo: string } {
    const ord = normalizeSolicitacaoStatusOrdinal(r.status);
    const flux = ord === 10 ? "AumentoHeadcount" : "RequisicaoPessoal";
    const tipoLabel = ord === 10 ? "Aumento de Headcount" : "Requisição de Vaga";
    const iso = String(r.createdAtUtc ?? "");
    return {
        id: String(r.id ?? ""),
        _tabId: "portal",
        _portalTipoFluxo: flux,
        titulo: String(r.titulo ?? "—"),
        funcionarioNome: r.solicitanteNome != null ? String(r.solicitanteNome) : "—",
        tipoDescricao: tipoLabel,
        statusDescricao: solicitacaoVagaStatusBadgeMeta(r.status as string | number).label,
        etapaPendenteLabel: r.etapaPendenteLabel != null ? String(r.etapaPendenteLabel) : "",
        etapaPendenteIsQueue: Boolean(r.etapaPendenteIsQueue),
        createdAtUtc: iso,
        dataAbertura: iso,
        centroCustoNome: r.centroCustoNome != null ? String(r.centroCustoNome) : "",
    };
}

function isPortalRequisicaoVagaRow(row: GenericRow): boolean {
    const f = String((row as { _portalTipoFluxo?: string })._portalTipoFluxo ?? "");
    return f === "RequisicaoPessoal" || f === "AumentoHeadcount";
}

/** Pendências do fluxo Portal (exclui itens só RM: vagas/movimentações/desligamentos sincronizados). */
function isPortalPendenciaRow(row: GenericRow): boolean {
    return (row as GenericRow & { _tabId?: string })._tabId === "portal";
}

const STATUS_MAP: Record<StatusKey, { label: string; color: string; icon: React.ElementType }> = {
    0:  { label: "Rascunho",             color: "bg-zinc-400/15 text-zinc-600",    icon: FileText },
    1:  { label: "Pendente",             color: "bg-amber-500/15 text-amber-700",  icon: Clock },
    2:  { label: "Aprovada",             color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    3:  { label: "Reprovada",            color: "bg-red-500/15 text-red-700",      icon: XCircle },
    4:  { label: "Ajustes",              color: "bg-orange-500/15 text-orange-700", icon: AlertTriangle },
    5:  { label: "Aguarda RH",           color: "bg-purple-500/15 text-purple-700", icon: Clock },
    6:  { label: "Cancelada",            color: "bg-zinc-500/15 text-zinc-500",    icon: XCircle },
    7:  { label: "Em Integração",        color: "bg-blue-500/15 text-blue-700",    icon: Clock },
    8:  { label: "Concluída",            color: "bg-emerald-600/15 text-emerald-800", icon: CheckCheck },
    10: { label: "Aguarda Aprovação HC", color: "bg-violet-500/15 text-violet-700", icon: Clock },
};

const URGENCIA_MAP: Record<UrgenciaKey, { label: string; color: string }> = {
    0: { label: "Baixa", color: "bg-sky-500/15 text-sky-700" },
    1: { label: "Média", color: "bg-amber-500/15 text-amber-700" },
    2: { label: "Alta", color: "bg-orange-500/15 text-orange-700" },
    3: { label: "Crítica", color: "bg-red-500/15 text-red-700" },
};

function statusBadge(status: number) {
    const s = STATUS_MAP[(status ?? 0) as StatusKey] ?? STATUS_MAP[0];
    const Icon = s.icon;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.color}`}>
            <Icon className="size-3" />
            {s.label}
        </span>
    );
}

function urgenciaBadge(urgencia: number) {
    const u = URGENCIA_MAP[(urgencia ?? 1) as UrgenciaKey] ?? URGENCIA_MAP[1];
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.color}`}>
            {u.label}
        </span>
    );
}

function FilaBadge() {
    return (
        <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-700 shrink-0">
            FILA
        </span>
    );
}

function formatDate(iso: string | null | undefined) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
        return "—";
    }
}

function formatDateTime(iso: string | null | undefined) {
    if (!iso) return null;
    try {
        const d = new Date(iso);
        return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
            + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
        return null;
    }
}

const APPROVAL_STATUS: Record<number, { label: string; color: string }> = {
    0: { label: "Pendente", color: "bg-amber-500/15 text-amber-700" },
    1: { label: "Aprovado", color: "bg-emerald-500/15 text-emerald-700" },
    2: { label: "Reprovado", color: "bg-red-500/15 text-red-700" },
};

function approvalChainBadge(status: number) {
    const s = APPROVAL_STATUS[status] ?? APPROVAL_STATUS[0];
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${s.color}`}>
            {s.label}
        </span>
    );
}

function DetailField({ label, value, span }: { label: string; value: React.ReactNode; span?: number }) {
    return (
        <div className={span ? `col-span-${span}` : undefined}>
            <div className="text-xs text-muted-foreground uppercase">{label}</div>
            <div className="text-sm mt-0.5">{value || "—"}</div>
        </div>
    );
}

/* ── Enum label maps (based on backend enums) ── */

const TIPO_CONTRATO_MAP: Record<number, string> = {
    0: "CLT", 1: "Estágio", 2: "Aprendiz", 3: "Temporário",
};

const MOTIVO_REQUISICAO_MAP: Record<number, string> = {
    0: "Atender Demanda", 1: "Pedido de Demissão", 2: "Deslig. Sem Justa Causa",
    3: "Cota Aprendiz", 4: "Término de Contrato", 5: "Expansão de Base",
    6: "Nova Unidade", 7: "Movimentação", 8: "Afastamento",
};

const TIPO_SOLICITACAO_MAP: Record<number, string> = {
    0: "Vaga Nova", 1: "Substituição",
};

const TIPO_DESLIGAMENTO_MAP: Record<number, string> = {
    0: "Sem Justa Causa", 1: "Pedido de Demissão", 2: "Acordo Mútuo",
    3: "Justa Causa", 4: "Fim de Contrato",
};

function BoolBadge({ value }: { value: boolean }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
            value ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-400/15 text-zinc-500"
        }`}>
            {value ? "Sim" : "Não"}
        </span>
    );
}

function SectionDivider({ title }: { title: string }) {
    return (
        <div className="col-span-full">
            <div className="flex items-center gap-2 my-1">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</span>
                <div className="flex-1 border-t border-border" />
            </div>
        </div>
    );
}

function enumLabel(map: Record<number, string>, val: number | string | null | undefined): string {
    if (val == null) return "—";
    const n = typeof val === "string" ? parseInt(val, 10) : val;
    return map[n] ?? String(val);
}

const ETAPA_STATUS_CFG = {
    0: { label: "Aguardando", color: "bg-amber-500/15 text-amber-700 border-amber-300", dot: "bg-amber-400", lineColor: "bg-border" },
    1: { label: "Aprovado", color: "bg-emerald-500/15 text-emerald-700 border-emerald-300", dot: "bg-emerald-500", lineColor: "bg-emerald-300" },
    2: { label: "Reprovado", color: "bg-red-500/15 text-red-700 border-red-300", dot: "bg-red-500", lineColor: "bg-red-300" },
} as const;

function WorkflowTimeline({ etapas }: { etapas: EtapaFluxoInfo[] }) {
    const pendingIndex = etapas.findIndex(e => e.status === 0);

    return (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                <GitBranch className="size-3.5" />
                Fluxo de Aprovação
            </div>
            <div className="relative ml-1 space-y-0">
                {etapas.map((etapa, idx) => {
                    const cfg = ETAPA_STATUS_CFG[etapa.status as 0 | 1 | 2] ?? ETAPA_STATUS_CFG[0];
                    const isCurrentPending = idx === pendingIndex;
                    const who = etapa.aprovadorNome ?? (etapa.roleNome ? `Fila: ${etapa.roleNome}` : null);
                    const isLast = idx === etapas.length - 1;

                    return (
                        <div key={idx} className="flex gap-3">
                            {/* Timeline spine */}
                            <div className="flex flex-col items-center">
                                <div className={`mt-1 size-2.5 rounded-full shrink-0 ring-2 ring-background ${cfg.dot}`} />
                                {!isLast && <div className={`w-px flex-1 min-h-[18px] mt-0.5 ${cfg.lineColor}`} />}
                            </div>
                            {/* Content */}
                            <div className={`pb-3 flex-1 min-w-0 ${isLast ? "pb-0" : ""}`}>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold border ${cfg.color}`}>
                                        {cfg.label}
                                    </span>
                                    <span className={`text-xs font-bold tracking-wide ${isCurrentPending ? "text-amber-700" : "text-foreground"}`}>
                                        {etapa.label}
                                    </span>
                                    {isCurrentPending && (
                                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-300">
                                            <Clock className="size-2.5" />
                                            AQUI AGORA
                                        </span>
                                    )}
                                </div>
                                {who && (
                                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                        <UserCheck className="size-3 shrink-0" />
                                        {who}
                                    </div>
                                )}
                                {etapa.dataUtc && (
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="size-3 shrink-0" />
                                        {formatDateTime(etapa.dataUtc)}
                                    </div>
                                )}
                                {etapa.observacao && (
                                    <div className="mt-1 text-xs rounded bg-muted/40 px-2 py-1 text-muted-foreground">
                                        &ldquo;{etapa.observacao}&rdquo;
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/**
 * Determines if a row is in "Fila de Perfil" mode.
 * For detail objects: checks etapasFluxo for an open (Pendente) queue step.
 * For grid rows: checks etapaPendenteIsQueue flag.
 */
function isFilaRow(row: GenericRow | SolicitacaoDetail): boolean {
    const r = row as Record<string, unknown>;
    // Detail view — check etapasFluxo for pending queue step
    if ("etapasFluxo" in r && Array.isArray(r.etapasFluxo)) {
        const etapas = r.etapasFluxo as EtapaFluxoInfo[];
        return etapas.some(e => {
            const isPendente = String(e.status).toLowerCase() === "pendente" || e.status === 0;
            return isPendente && !e.aprovadorNome && !!e.roleNome;
        });
    }
    // Grid row — check dedicated flag
    return r.etapaPendenteIsQueue === true;
}

/* ──────────────────────────── Tab definitions ──────────────────────────── */

type TabId = "contratacao" | "promocao" | "desligamento" | "_all";

interface TabDef {
    id: Exclude<TabId, "_all">;
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    api: string;
    assumirApi: string;
    columns: { key: string; label: string; render?: (row: GenericRow) => React.ReactNode }[];
}

const etapaCol = {
    key: "etapaPendenteLabel", label: "Etapa",
    render: (r: GenericRow) => {
        const v = pick(r, "etapaPendenteLabel");
        return v !== "—"
            ? <span className="inline-flex items-center rounded-full bg-amber-500/10 text-amber-700 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold">{v}</span>
            : <span className="text-muted-foreground text-xs">—</span>;
    },
};

// Tabs apontam pra dados sincronizados do TOTVS RM (visão consolidada do ERP).
// Não dependem do fluxo de Solicitação interno do Portal — isso era a versão antiga.
const TABS: TabDef[] = [
    {
        id: "contratacao", label: "Contratação", icon: Briefcase,
        color: "text-violet-600", bgColor: "bg-violet-500/15",
        // Vagas abertas (Aumento de Quadro / Substituição) sincronizadas do RM.
        api: "/api/vagas?status=Aberta&page=1&pageSize=200",
        assumirApi: "/api/vagas",
        columns: [
            { key: "codigo", label: "Cód.", render: (r) => <span className="font-mono text-xs">{pick(r, "codigo")}</span> },
            { key: "titulo", label: "Título" },
            { key: "centroCustoNome", label: "Centro de Custo", render: (r) => pick(r, "centroCustoNome") },
            { key: "origemTipo", label: "Origem", render: (r) => {
                const o = String(r.origemTipo ?? "");
                return o === "AumentoQuadro" ? "Aumento Quadro"
                    : o === "SubstituicaoDesligamento" ? "Subst. Desligamento"
                    : o === "SubstituicaoPromocao" ? "Subst. Promoção"
                    : o || "—";
            }},
            { key: "substituindoNome", label: "Substituindo", render: (r) => pick(r, "substituindoNome") },
            { key: "dataAbertura", label: "Aberta em", render: (r) => formatDate(pick(r, "dataAbertura") !== "—" ? pick(r, "dataAbertura") : pick(r, "createdAtUtc")) },
        ],
    },
    {
        id: "promocao", label: "Movimentação", icon: TrendingUp,
        color: "text-teal-600", bgColor: "bg-teal-500/15",
        // Movimentações em aberto no RM (CodStatus 1=Aberta, 2=Em análise, 5=Em andamento).
        api: "/api/funcionarios/movimentacoes?codStatus=1&codStatus=2&codStatus=5&pageSize=200",
        assumirApi: "/api/funcionarios/movimentacoes",
        columns: [
            { key: "funcionarioNome", label: "Funcionário", render: (r) => pick(r, "funcionarioNome") },
            { key: "tipoDescricao", label: "Tipo", render: (r) => pick(r, "tipoDescricao") },
            { key: "statusDescricao", label: "Status", render: (r) => pick(r, "statusDescricao") },
            { key: "codFuncaoOrigem", label: "Função (origem→destino)", render: (r) => `${pick(r, "codFuncaoOrigem")} → ${pick(r, "codFuncaoDestino")}` },
            { key: "dataAbertura", label: "Data Abertura", render: (r) => formatDate(pick(r, "dataAbertura")) },
        ],
    },
    {
        id: "desligamento", label: "Desligamento", icon: UserMinus,
        color: "text-rose-600", bgColor: "bg-rose-500/15",
        // Desligamentos em aberto no RM (CodStatus 1=Aberta, 2=Em análise, 5=Em andamento).
        api: "/api/desligamentos?codStatus=1&codStatus=2&codStatus=5&pageSize=200",
        assumirApi: "/api/desligamentos",
        columns: [
            { key: "funcionarioNome", label: "Funcionário", render: (r) => pick(r, "funcionarioNome") },
            { key: "tipoRescisaoDescricao", label: "Tipo", render: (r) => pick(r, "tipoRescisaoDescricao") },
            { key: "statusDescricao", label: "Status", render: (r) => pick(r, "statusDescricao") },
            { key: "gerouSubstituicao", label: "Subst.?", render: (r) => r.gerouSubstituicao ? "Sim" : "Não" },
            { key: "dataAbertura", label: "Data Abertura", render: (r) => formatDate(pick(r, "dataAbertura")) },
        ],
    },
];

/* ──────────────────────────── component ──────────────────────────── */

const VALID_TAB_IDS: TabId[] = ["_all", "contratacao", "promocao", "desligamento"];
const LS_TAB_KEY = "aprovacoes:activeTab";
const LS_SHOW_RM_LEGACY_KEY = "aprovacoes:showRmLegacy";

function readStoredShowRmLegacy(): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(LS_SHOW_RM_LEGACY_KEY) === "true";
}

export default function AprovacoesScreen({ initialTab }: { initialTab?: string }) {
    const pendencias = usePendencias();

    const resolvedInitial: TabId = (() => {
        if (VALID_TAB_IDS.includes(initialTab as TabId)) return initialTab as TabId;
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(LS_TAB_KEY);
            if (saved && VALID_TAB_IDS.includes(saved as TabId)) return saved as TabId;
        }
        return "_all";
    })();
    const [activeTab, setActiveTab] = useState<TabId>(resolvedInitial);

    const handleTabChange = useCallback((tab: TabId) => {
        setActiveTab(tab);
        localStorage.setItem(LS_TAB_KEY, tab);
    }, []);

    const [showRmLegacy, setShowRmLegacy] = useState(() => readStoredShowRmLegacy());
    const handleShowRmLegacyChange = useCallback((checked: boolean) => {
        setShowRmLegacy(checked);
        localStorage.setItem(LS_SHOW_RM_LEGACY_KEY, checked ? "true" : "false");
    }, []);

    const [q, setQ] = useState("");
    const [typeFilter, setTypeFilter] = useState<"todos" | "direta" | "fila">("todos");
    const [approvalObs, setApprovalObs] = useState("");
    const [acting, setActing] = useState(false);
    const [rejectTarget, setRejectTarget] = useState<{ row: GenericRow; isContratacao: boolean } | null>(null);
    const [rejectObs, setRejectObs] = useState("");

    /* ── Bulk action state ── */
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [bulkConfirmAction, setBulkConfirmAction] = useState<"approve" | "reject" | null>(null);
    const [bulkObs, setBulkObs] = useState("");
    const [bulkActing, setBulkActing] = useState(false);
    const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

    /* ── My identity (to filter nominated tasks) ── */
    const [myFuncionarioId, setMyFuncionarioId] = useState<string | null>(null);
    const [myUserId, setMyUserId] = useState<string | null>(null);
    const [meLoaded, setMeLoaded] = useState(false);

    useEffect(() => {
        fetchJson<Record<string, unknown>>("/api/me")
            .then((d) => {
                if (d?.funcionarioId) setMyFuncionarioId(String(d.funcionarioId));
                if (d?.userId) setMyUserId(String(d.userId));
            })
            .catch(() => {})
            .finally(() => setMeLoaded(true));
    }, []);

    /* ── Data per tab ── */
    const [dataMap, setDataMap] = useState<Record<TabId, GenericRow[]>>({
        _all: [], contratacao: [], promocao: [], desligamento: [],
    });
    const [loadingMap, setLoadingMap] = useState<Record<TabId, boolean>>({
        _all: true, contratacao: true, promocao: true, desligamento: true,
    });
    const [portalPendentes, setPortalPendentes] = useState<Array<GenericRow & { _tabId: string; _portalTipoFluxo: string }>>([]);
    const [solicitacaoVagaPendenciaRows, setSolicitacaoVagaPendenciaRows] = useState<Array<GenericRow & { _tabId: string; _portalTipoFluxo: string }>>([]);
    const [portalLoading, setPortalLoading] = useState(true);

    /* ── Contratação detail (real API) ── */
    const [detailOpen, setDetailOpen] = useState(false);
    const [detail, setDetail] = useState<SolicitacaoDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [lastApproved, setLastApproved] = useState<{ titulo: string } | null>(null);

    /* ── Generic detail for other types ── */
    const [genericDetailOpen, setGenericDetailOpen] = useState(false);
    const [genericDetail, setGenericDetail] = useState<GenericRow | null>(null);
    const [genericDetailKind, setGenericDetailKind] = useState<"default" | "rm_mov_timeline">("default");

    /* ── View-only modals for Desligamento and Movimentação ── */
    const [viewDesligamentoId, setViewDesligamentoId] = useState<string | null>(null);
    const [viewPromocaoId, setViewPromocaoId] = useState<string | null>(null);

    /* ── Fetch all tabs ── */
    const fetchTab = useCallback(async (tab: TabDef) => {
        try {
            const raw = await fetchJson<GenericRow[] | { items?: GenericRow[] }>(tab.api);
            // Endpoints RM: /api/vagas é paginado ({items}); desligamentos e movimentações retornam array direto.
            const rows: GenericRow[] = Array.isArray(raw)
                ? raw
                : (Array.isArray((raw as { items?: GenericRow[] })?.items) ? (raw as { items: GenericRow[] }).items : []);
            setDataMap(prev => ({ ...prev, [tab.id]: rows }));
        } catch {
            setDataMap(prev => ({ ...prev, [tab.id]: [] }));
        } finally {
            setLoadingMap(prev => ({ ...prev, [tab.id]: false }));
        }
    }, []);

    const fetchPortalPendentes = useCallback(async () => {
        setPortalLoading(true);
        try {
            const params = new URLSearchParams();
            SOLICITACAO_VAGA_STATUS_PENDENTE_GESTAO.forEach((s) => params.append("statuses", String(s)));
            params.set("pageSize", "100");
            params.set("page", "1");

            const [pendentesRaw, vagasRaw] = await Promise.all([
                fetchJson<PortalPendenteApi[]>("/api/aprovacoes/pendentes").catch(() => []),
                fetchJson<unknown>(`/api/solicitacoes-vaga?${params.toString()}`).catch(() => []),
            ]);

            const list = Array.isArray(pendentesRaw) ? pendentesRaw : [];
            setPortalPendentes(list.map(mapPortalPendenteToRow));

            const vagasArr = Array.isArray(vagasRaw) ? vagasRaw : [];
            setSolicitacaoVagaPendenciaRows(
                vagasArr
                    .filter((x): x is Record<string, unknown> => x !== null && typeof x === "object" && !Array.isArray(x))
                    .map(mapSolicitacaoVagaGridApiToPortalRow),
            );
        } catch {
            setPortalPendentes([]);
            setSolicitacaoVagaPendenciaRows([]);
        } finally {
            setPortalLoading(false);
        }
    }, []);

    const refreshAll = useCallback(() => {
        setLoadingMap({ _all: true, contratacao: true, promocao: true, desligamento: true });
        TABS.forEach(tab => void fetchTab(tab));
        void fetchPortalPendentes();
    }, [fetchTab, fetchPortalPendentes]);

    useEffect(() => { refreshAll(); }, [refreshAll]);

    /* ── Clear selection when tab changes ── */
    useEffect(() => { setSelectedIds(new Set()); }, [activeTab]);
    useEffect(() => { setSelectedIds(new Set()); }, [showRmLegacy]);

    /* ── Row relevance: show only tasks assigned to me OR open fila items ── */
    const isMyRow = useCallback((_row: GenericRow): boolean => {
        // Tela passou pra modo "visão consolidada do RM" (read-only).
        // Os filtros antigos baseados em etapa de aprovação Portal não se aplicam — mostra tudo.
        return true;
    }, []);

    /** Grid /api/solicitacoes-vaga sem duplicar o que já veio de /api/aprovacoes/pendentes (mesmo SolicitacaoId). */
    const portalExtrasDaListaVaga = useMemo(() => {
        const ids = new Set(portalPendentes.map((p) => p.id));
        return solicitacaoVagaPendenciaRows.filter((r) => !ids.has(r.id));
    }, [portalPendentes, solicitacaoVagaPendenciaRows]);

    const allMergedPortalRows = useMemo(
        () => [...portalPendentes, ...portalExtrasDaListaVaga],
        [portalPendentes, portalExtrasDaListaVaga],
    );

    const portalRequisicaoVagaCount = useMemo(
        () => allMergedPortalRows.filter(isPortalRequisicaoVagaRow).length,
        [allMergedPortalRows],
    );

    /* ── Counts (per-tab, filtered to relevant items) ── */
    const counts = useMemo(() => {
        const c: Record<TabId, number> = { _all: 0, contratacao: 0, promocao: 0, desligamento: 0 };
        const rmContratacao = showRmLegacy ? dataMap.contratacao.filter(isMyRow).length : 0;
        for (const tab of TABS) {
            if (tab.id === "promocao") {
                c.promocao = showRmLegacy
                    ? dataMap.promocao.filter(r => isMyRow(r) && !isRmDesligamentoMovimentacao(r)).length
                    : 0;
            } else if (tab.id === "desligamento") {
                c.desligamento = showRmLegacy
                    ? dataMap.desligamento.filter(isMyRow).length
                        + dataMap.promocao.filter(r => isMyRow(r) && isRmDesligamentoMovimentacao(r)).length
                    : 0;
            } else if (tab.id === "contratacao") {
                c.contratacao = rmContratacao + portalRequisicaoVagaCount;
            }
        }
        return c;
    }, [dataMap, isMyRow, portalRequisicaoVagaCount, showRmLegacy]);

    const totalPendente = showRmLegacy
        ? dataMap.contratacao.filter(isMyRow).length
            + counts.promocao
            + counts.desligamento
            + allMergedPortalRows.length
        : allMergedPortalRows.length;

    /* ── Filtered list for active tab ── */
    const isAllMode = activeTab === "_all";
    const activeTabDef = isAllMode ? TABS[0] : TABS.find(t => t.id === activeTab)!;

    const allColumns: { key: string; label: string; render?: (row: GenericRow) => React.ReactNode }[] = [
        {
            key: "_tipo", label: "Tipo", render: (row) => {
                const tabId = (row as GenericRow & { _tabId?: string })._tabId;
                if (tabId === "portal") {
                    const flux = String((row as GenericRow & { _portalTipoFluxo?: string })._portalTipoFluxo ?? "");
                    const label = pick(row, "tipoDescricao");
                    const Icon =
                        flux === "MovimentacaoPessoal" ? TrendingUp
                            : flux === "Desligamento" ? UserMinus
                            : flux === "RequisicaoPessoal" || flux === "AumentoHeadcount" ? Briefcase
                            : FileText;
                    const color =
                        flux === "MovimentacaoPessoal" ? "text-teal-600"
                            : flux === "Desligamento" ? "text-rose-600"
                            : flux === "RequisicaoPessoal" || flux === "AumentoHeadcount" ? "text-violet-600"
                            : "text-sky-600";
                    return <span className={`inline-flex items-center gap-1 rounded-full bg-card border border-border/50 px-2 py-0.5 text-[11px] font-semibold ${color}`}><Icon className="size-3" />{label}</span>;
                }
                const tab = TABS.find(t => t.id === tabId);
                // Desligamentos RM podem vir na lista de movimentações — não usar só tipoDescricao antes de tipoRescisao.
                const guessed = tab ?? (
                    pick(row, "titulo") !== "—" ? TABS.find(t => t.id === "contratacao")
                    : pick(row, "tipoRescisaoDescricao") !== "—" ? TABS.find(t => t.id === "desligamento")
                    : isRmDesligamentoMovimentacao(row) ? TABS.find(t => t.id === "desligamento")
                    : pick(row, "tipoDescricao") !== "—" ? TABS.find(t => t.id === "promocao")
                    : null
                );
                if (!guessed) return <span className="text-muted-foreground">—</span>;
                const Icon = guessed.icon;
                return <span className={`inline-flex items-center gap-1 rounded-full bg-card border border-border/50 px-2 py-0.5 text-[11px] font-semibold ${guessed.color}`}><Icon className="size-3" />{guessed.label}</span>;
            },
        },
        {
            key: "_desc", label: "Descrição", render: (row) => {
                // Identificador principal por tipo: vaga → título; movimentação/desligamento → nome do funcionário.
                const titulo = pick(row, "titulo");
                if (titulo !== "—") return <span className="font-semibold">{titulo}</span>;
                const nome = pick(row, "funcionarioNome");
                if (nome !== "—") return <span className="font-semibold">{nome}</span>;
                return <span className="text-muted-foreground font-mono text-xs">{pick(row, "id")}</span>;
            },
        },
        {
            key: "_detalhe", label: "Detalhe", render: (row) => {
                const parts: string[] = [];
                const cc = pick(row, "centroCustoNome");
                const subst = pick(row, "substituindoNome");
                const tipoDescricao = pick(row, "tipoDescricao");
                const tipoRescisao = pick(row, "tipoRescisaoDescricao");
                const status = pick(row, "statusDescricao");
                const etapa = pick(row, "etapaPendenteLabel");
                if ((row as GenericRow & { _tabId?: string })._tabId === "portal") {
                    const sol = pick(row, "funcionarioNome");
                    if (cc !== "—") parts.push(cc);
                    if (sol !== "—") parts.push(`Solicitante: ${sol}`);
                    if (etapa !== "—") parts.push(etapa);
                    if (status !== "—") parts.push(status);
                    return parts.length ? <span className="text-xs">{parts.join(" · ")}</span> : <span className="text-muted-foreground">—</span>;
                }
                if (cc !== "—") parts.push(cc);
                if (subst !== "—") parts.push(`Subst. ${subst}`);
                if (tipoDescricao !== "—") parts.push(tipoDescricao);
                if (tipoRescisao !== "—") parts.push(tipoRescisao);
                if (status !== "—") parts.push(status);
                return parts.length ? <span className="text-xs">{parts.join(" · ")}</span> : <span className="text-muted-foreground">—</span>;
            },
        },
        {
            key: "_data", label: "Data", render: (r) => {
                const da = pick(r, "dataAbertura");
                return formatDate(da !== "—" ? da : pick(r, "createdAtUtc"));
            },
        },
    ];

    const filtered = useMemo(() => {
        let rows: GenericRow[];
        if (isAllMode) {
            rows = TABS.flatMap(tab =>
                dataMap[tab.id].filter(isMyRow).map(r => ({
                    ...r,
                    _tabId: effectiveRmListTabId(r, tab.id),
                }))
            );
            rows.push(...allMergedPortalRows);
            rows.sort((a, b) => {
                const da = new Date(pick(a, "createdAtUtc", "0")).getTime();
                const db = new Date(pick(b, "createdAtUtc", "0")).getTime();
                return db - da;
            });
        } else if (activeTab === "promocao") {
            rows = dataMap.promocao.filter(r => isMyRow(r) && !isRmDesligamentoMovimentacao(r));
        } else if (activeTab === "desligamento") {
            rows = [
                ...dataMap.desligamento.filter(isMyRow).map(r => ({ ...r, _tabId: "desligamento" })),
                ...dataMap.promocao.filter(r => isMyRow(r) && isRmDesligamentoMovimentacao(r)).map(r => ({ ...r, _tabId: "desligamento" })),
            ];
            rows.sort((a, b) => {
                const da = new Date(pick(a, "createdAtUtc", "0")).getTime();
                const db = new Date(pick(b, "createdAtUtc", "0")).getTime();
                return db - da;
            });
        } else if (activeTab === "contratacao") {
            rows = [
                ...dataMap.contratacao.filter(isMyRow),
                ...allMergedPortalRows.filter(isPortalRequisicaoVagaRow),
            ];
            rows.sort((a, b) => {
                const da = new Date(pick(a, "createdAtUtc", "0")).getTime();
                const db = new Date(pick(b, "createdAtUtc", "0")).getTime();
                return db - da;
            });
        } else {
            rows = [];
        }
        if (!showRmLegacy) {
            rows = rows.filter(isPortalPendenciaRow);
        }
        if (typeFilter === "direta") rows = rows.filter(r => !r.etapaPendenteIsQueue);
        if (typeFilter === "fila")   rows = rows.filter(r => Boolean(r.etapaPendenteIsQueue));
        const term = q.trim().toLowerCase();
        if (!term) return rows;
        return rows.filter(r => {
            const blob = Object.values(r).filter(v => typeof v === "string").join(" ").toLowerCase();
            return blob.includes(term);
        });
    }, [dataMap, activeTab, q, isMyRow, isAllMode, typeFilter, allMergedPortalRows, showRmLegacy]);

    /* ── Selectable rows (non-fila items I can directly approve/reject) ── */
    const selectableRows = useMemo(() => filtered.filter(r => !isFilaRow(r)), [filtered]);
    const selectedRows = useMemo(() => selectableRows.filter(r => selectedIds.has(r.id)), [selectableRows, selectedIds]);
    const allSelectableSelected = selectableRows.length > 0 && selectableRows.every(r => selectedIds.has(r.id));
    const someSelected = selectedIds.size > 0;

    function toggleSelect(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }
    function toggleSelectAll() {
        if (allSelectableSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(selectableRows.map(r => r.id)));
    }

    /* ── Contratação detail actions ── */
    async function openContratacaoDetail(row: GenericRow) {
        setDetailOpen(true);
        setDetailLoading(true);
        setApprovalObs("");
        try {
            const d = await fetchJson<SolicitacaoDetail>(`/api/solicitacoes-vaga/${row.id}`);
            setDetail(d);
        } catch {
            toast.error("Falha ao carregar detalhes.");
            setDetailOpen(false);
        } finally {
            setDetailLoading(false);
        }
    }

    async function doContratacaoAction(id: string, action: "approve" | "reject" | "request-changes", obs?: string) {
        const labels = { approve: "Aprovada", reject: "Reprovada", "request-changes": "Ajustes solicitados" };
        setActing(true);
        try {
            await fetchJson(`/api/solicitacoes-vaga/${id}/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ observacao: obs !== undefined ? (obs || null) : (approvalObs || null) }),
            });
            toast.success(`Solicitação: ${labels[action]}!`);
            if (action === "approve" && detail) {
                setLastApproved({ titulo: detail.titulo });
            }
            setDetailOpen(false);
            pendencias.refresh();
            refreshAll();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setActing(false);
        }
    }

    /* ── Generic detail for non-contratacao types ── */
    function openGenericDetail(row: GenericRow, kind: "default" | "rm_mov_timeline" = "default") {
        setGenericDetailKind(kind);
        setGenericDetail(row);
        setGenericDetailOpen(true);
        setApprovalObs("");
    }

    function handleOpenRowDetail(row: GenericRow) {
        const portalFlux = (row as GenericRow & { _portalTipoFluxo?: string })._portalTipoFluxo;
        if (portalFlux) {
            if (portalFlux === "RequisicaoPessoal" || portalFlux === "AumentoHeadcount") {
                void openContratacaoDetail(row);
                return;
            }
            if (portalFlux === "MovimentacaoPessoal") {
                setViewPromocaoId(row.id);
                return;
            }
            if (portalFlux === "Desligamento") {
                setViewDesligamentoId(row.id);
                return;
            }
            toast.message("Painel de Solicitações", {
                description: "Esta pendência usa outro fluxo no Portal. Abra em Gestão → Painel de solicitações.",
            });
            return;
        }

        const rowTabId = isAllMode
            ? ((row as GenericRow & { _tabId?: string })._tabId ?? "contratacao")
            : activeTab;

        if (rowTabId === "contratacao") {
            void openContratacaoDetail(row);
            return;
        }
        if (rowTabId === "desligamento") {
            if (pick(row, "tipoRescisaoDescricao") !== "—") {
                setViewDesligamentoId(row.id);
                return;
            }
            openGenericDetail(row, "rm_mov_timeline");
            return;
        }
        if (rowTabId === "promocao") {
            setViewPromocaoId(row.id);
            return;
        }
        openGenericDetail(row);
    }

    async function doGenericAction(row: GenericRow, action: "approve" | "reject" | "request-changes", obs?: string) {
        const tabId = isAllMode ? ((row as GenericRow & { _tabId?: string })._tabId ?? "contratacao") : activeTab;
        const tab = TABS.find(t => t.id === tabId)!;
        const baseApi = tab.api.split("?")[0];
        const labels = { approve: "Aprovada", reject: "Reprovada", "request-changes": "Ajustes solicitados" };
        setActing(true);
        try {
            await fetchJson(`${baseApi}/${row.id}/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ observacao: obs !== undefined ? (obs || null) : (approvalObs || null) }),
            });
            toast.success(`Solicitação: ${labels[action]}!`);
            setGenericDetailOpen(false);
            pendencias.refresh();
            refreshAll();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setActing(false);
        }
    }

    /* ── Assumir (Fila de Perfil) — atomically claim the task ── */
    async function doAssumir(row: GenericRow) {
        const tabId = isAllMode ? ((row as GenericRow & { _tabId?: string })._tabId ?? "contratacao") : activeTab;
        const tab = TABS.find(t => t.id === tabId)!;
        setActing(true);
        try {
            await fetchJson(`${tab.assumirApi}/${row.id}/assumir`, { method: "POST" });
            toast.success("Tarefa assumida! Você agora é o aprovador desta solicitação.");
            setDetailOpen(false);
            setGenericDetailOpen(false);
            pendencias.refresh();
            refreshAll();
        } catch (e) {
            const msg = e instanceof Error ? e.message : "";
            // Extract the backend message from "HTTP 409: {\"message\":\"...\"}"
            let displayMsg = msg;
            try {
                const jsonPart = msg.substring(msg.indexOf("{"));
                const parsed = JSON.parse(jsonPart);
                if (parsed.message) displayMsg = parsed.message;
            } catch { /* use raw msg */ }
            if (msg.includes("409")) {
                toast.warning(displayMsg);
                refreshAll();
            } else {
                toast.error(`Falha ao assumir: ${displayMsg || "erro"}`);
            }
        } finally {
            setActing(false);
        }
    }

    /* ── Bulk action (Aprovar / Recusar selecionados) ── */
    async function doBulkAction(action: "approve" | "reject") {
        const targets = selectedRows;
        if (targets.length === 0) return;

        setBulkActing(true);
        setBulkProgress({ done: 0, total: targets.length });
        let success = 0;
        let failed = 0;

        for (let i = 0; i < targets.length; i++) {
            const row = targets[i];
            const tabId = isAllMode ? ((row as GenericRow & { _tabId?: string })._tabId ?? "contratacao") : activeTab;
            const tab = TABS.find(t => t.id === tabId)!;
            const baseApi = tab.api.split("?")[0];
            try {
                await fetchJson(`${baseApi}/${row.id}/${action}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ observacao: bulkObs || null }),
                });
                success++;
            } catch {
                failed++;
            }
            setBulkProgress({ done: i + 1, total: targets.length });
        }

        const actionLabel = action === "approve" ? "aprovada" : "recusada";
        if (success > 0) toast.success(`${success} solicitação${success > 1 ? "ões" : ""} ${actionLabel}${success > 1 ? "s" : ""}!`);
        if (failed > 0) toast.error(`${failed} falha${failed > 1 ? "s" : ""} ao processar.`);

        setBulkActing(false);
        setBulkProgress(null);
        setBulkConfirmAction(null);
        setBulkObs("");
        setSelectedIds(new Set());
        pendencias.refresh();
        refreshAll();
    }

    /* ──────────────────────────── render ──────────────────────────── */
    const isLoading = isAllMode
        ? Object.entries(loadingMap).some(([k, v]) => k !== "_all" && v) || portalLoading
        : loadingMap[activeTab];
    const displayColumns = isAllMode ? allColumns : activeTabDef.columns;

    return (
        <section className="space-y-4">
            {/* ── header ── */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Minhas Pendências</h1>
                    <div className="text-muted-foreground text-sm mt-0.5">
                        Solicitações que aguardam sua aprovação ou sua atuação no fluxo do RH
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={refreshAll}>
                    <RefreshCw className="size-4" />
                    <span className="hidden sm:inline">Atualizar</span>
                </Button>
            </div>

            {/* ── banner ── */}
            {lastApproved && (
                <NextStepBanner
                    variant="success"
                    title="Solicitação aprovada!"
                    description={`"${lastApproved.titulo}" foi aprovada. A vaga mínima foi criada automaticamente e o RH já pode prosseguir com o processo.`}
                    onDismiss={() => setLastApproved(null)}
                />
            )}

            {/* ── legend ── */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                    Direcionada a você
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-violet-500" />
                    Fila de perfil — qualquer membro pode assumir
                </span>
            </div>

            {/* ── KPI cards ── */}
            <div className="flex flex-wrap gap-2">
                {/* Total — clickable to show all */}
                <button
                    type="button"
                    onClick={() => handleTabChange("_all")}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 backdrop-blur text-left transition-all ${
                        isAllMode
                            ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                            : "border-border/40 bg-card/60 hover:bg-muted/40"
                    }`}
                >
                    <Clock className="size-3.5 text-amber-600" />
                    <span className="text-[11px] text-muted-foreground font-medium">Total</span>
                    <span className="text-sm font-bold text-amber-600">{totalPendente}</span>
                </button>
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const count = counts[tab.id];
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleTabChange(tab.id)}
                            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 backdrop-blur text-left transition-all ${
                                activeTab === tab.id
                                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                                    : "border-border/40 bg-card/60 hover:bg-muted/40"
                            }`}
                        >
                            <Icon className={`size-3.5 ${tab.color}`} />
                            <span className="text-[11px] text-muted-foreground font-medium">{tab.label}</span>
                            <span className={`text-sm font-bold ${count > 0 ? tab.color : "text-muted-foreground"}`}>
                                {loadingMap[tab.id] ? "…" : count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Tela em modo somente-leitura — fluxo de aprovação foi descontinuado.
                Os dados refletem o RM (via sync). Ações de aprovar/rejeitar acontecem no próprio RM. */}

            {/* ── Content: Mobile cards + Desktop table ── */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 backdrop-blur">
                {/* Toolbar */}
                <div className="p-4 pb-2 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="font-semibold flex items-center gap-2">
                                {isAllMode ? (
                                    <><Clock className="size-4 text-amber-600" />Todas as Pendências</>
                                ) : (() => {
                                    const Icon = activeTabDef.icon;
                                    return <><Icon className={`size-4 ${activeTabDef.color}`} />{activeTabDef.label}</>;
                                })()}
                            </div>
                            <div className="text-muted-foreground text-sm">
                                {isLoading ? "Carregando…" : `${filtered.length} pendência${filtered.length !== 1 ? "s" : ""}`}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                            <div className="flex items-center gap-2 shrink-0">
                                <input
                                    id="aprovacoes-show-rm-legacy"
                                    type="checkbox"
                                    className="size-4 rounded border-border accent-primary cursor-pointer"
                                    checked={showRmLegacy}
                                    onChange={(e) => handleShowRmLegacyChange(e.target.checked)}
                                />
                                <Label htmlFor="aprovacoes-show-rm-legacy" className="text-xs font-normal text-muted-foreground cursor-pointer whitespace-normal sm:max-w-[200px] leading-snug">
                                    Exibir requisições RM (Legado)
                                </Label>
                            </div>
                            <div className="relative w-full sm:w-[260px]">
                                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input className="w-full pl-8" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
                            </div>
                        </div>
                    </div>
                    {/* Type chips */}
                    {(() => {
                        let base = isAllMode
                            ? [
                                ...TABS.flatMap(tab =>
                                    dataMap[tab.id].filter(isMyRow).map(r => ({
                                        ...r,
                                        _tabId: effectiveRmListTabId(r, tab.id),
                                    })),
                                ),
                                ...allMergedPortalRows,
                            ]
                            : activeTab === "contratacao"
                                ? [...dataMap.contratacao.filter(isMyRow), ...allMergedPortalRows.filter(isPortalRequisicaoVagaRow)]
                                : dataMap[activeTab].filter(isMyRow);
                        if (!showRmLegacy) {
                            base = base.filter(isPortalPendenciaRow);
                        }
                        const countDireta = base.filter(r => !r.etapaPendenteIsQueue).length;
                        const countFila   = base.filter(r => Boolean(r.etapaPendenteIsQueue)).length;
                        return (
                            <div className="flex flex-wrap items-center gap-1.5">
                                {([
                                    { key: "todos",  label: "Todos",           count: base.length,   cls: "data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:border-primary/30" },
                                    { key: "direta", label: "Aprovação direta",count: countDireta,   cls: "data-[active=true]:bg-amber-500/15 data-[active=true]:text-amber-700 data-[active=true]:border-amber-400/50" },
                                    { key: "fila",   label: "Fila de aprovação",count: countFila,    cls: "data-[active=true]:bg-violet-500/15 data-[active=true]:text-violet-700 data-[active=true]:border-violet-400/50" },
                                ] as const).map(({ key, label, count, cls }) => (
                                    <button
                                        key={key}
                                        data-active={typeFilter === key}
                                        onClick={() => setTypeFilter(key)}
                                        className={`inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 ${cls}`}
                                    >
                                        {label}
                                        <span className="rounded-full bg-current/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none opacity-80">{count}</span>
                                    </button>
                                ))}
                            </div>
                        );
                    })()}
                </div>

                {/* ── Mobile card list (hidden on sm+) ── */}
                <div className="sm:hidden px-3 pb-3 space-y-2">
                    {isLoading ? (
                        <div className="text-center text-muted-foreground py-8">Carregando…</div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            {meLoaded ? "Nenhuma pendência encontrada para você." : "Carregando seus dados…"}
                        </div>
                    ) : filtered.map((row) => {
                        const isFila = isFilaRow(row);
                        const rowTabId = isAllMode ? ((row as GenericRow & { _tabId?: string })._tabId ?? "contratacao") : activeTab;
                        const tabDef = rowTabId === "portal" ? null : TABS.find(t => t.id === rowTabId) ?? TABS[0];
                        const TabIcon = tabDef?.icon ?? FileText;
                        const tabBadgeLabel = rowTabId === "portal" ? pick(row, "tipoDescricao") : tabDef?.label ?? "—";
                        const tabBadgeColor = rowTabId === "portal"
                            ? String((row as GenericRow & { _portalTipoFluxo?: string })._portalTipoFluxo ?? "").includes("Desligamento")
                                ? "text-rose-600 bg-rose-500/15"
                                : String((row as GenericRow & { _portalTipoFluxo?: string })._portalTipoFluxo ?? "").includes("Movimentacao")
                                    ? "text-teal-600 bg-teal-500/15"
                                    : "text-violet-600 bg-violet-500/15"
                            : `${tabDef?.color ?? ""} ${tabDef?.bgColor ?? ""}`;
                        // Primary label — first column value
                        const firstCol = tabDef?.columns[0];
                        const primaryLabel = rowTabId === "portal"
                            ? <span className="font-semibold">{pick(row, "titulo")}</span>
                            : firstCol?.render ? firstCol.render(row) : pick(row, firstCol?.key ?? "id");
                        const metaCols = (tabDef?.columns.slice(1, 3) ?? []).filter(c => c.key !== "etapaPendenteLabel");
                        const isSelected = selectedIds.has(row.id);

                        return (
                            <div
                                key={`${rowTabId}-${row.id}`}
                                className={`rounded-xl border p-4 space-y-3 transition-colors active:bg-muted/30 ${
                                    isFila ? "border-l-4 border-l-violet-400 bg-background" : isSelected ? "border-primary/40 bg-primary/5" : "border-border/60 bg-background"
                                }`}
                            >
                                {/* Card header */}
                                <div className="flex items-start gap-3">
                                    {!isFila && (
                                        <input
                                            type="checkbox"
                                            className="mt-0.5 size-5 rounded border-gray-300 accent-primary cursor-pointer shrink-0"
                                            checked={isSelected}
                                            onChange={() => toggleSelect(row.id)}
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                            {isAllMode && (
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tabBadgeColor}`}>
                                                    <TabIcon className="size-3" />{tabBadgeLabel}
                                                </span>
                                            )}
                                            {isFila && <FilaBadge />}
                                        </div>
                                        <div className="font-semibold text-sm leading-snug">{primaryLabel}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{formatDate(pick(row, "createdAtUtc"))}</div>
                                    </div>
                                    {/* Etapa badge */}
                                    {pick(row, "etapaPendenteLabel") !== "—" && (
                                        <span className="inline-flex items-center rounded-full bg-amber-500/10 text-amber-700 border border-amber-200 px-2 py-0.5 text-[11px] font-semibold shrink-0">
                                            {pick(row, "etapaPendenteLabel")}
                                        </span>
                                    )}
                                </div>

                                {/* Meta fields */}
                                {metaCols.length > 0 && (
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                        {metaCols.map(col => (
                                            <div key={col.key} className="text-xs">
                                                <span className="text-muted-foreground">{col.label}: </span>
                                                <span className="font-medium">{col.render ? col.render(row) : pick(row, col.key)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Apenas Ver — fluxo de aprovação descontinuado, dados refletem o RM. */}
                                <div className="flex gap-2 pt-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5"
                                        onClick={() => handleOpenRowDetail(row)}
                                    >
                                        <Eye className="size-4" />
                                        <span>Ver</span>
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ── Desktop table (hidden on mobile) ── */}
                <div className="hidden sm:block px-4 pb-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {displayColumns.map(col => (
                                    <TableHead key={col.key}>{col.label}</TableHead>
                                ))}
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={displayColumns.length + 1} className="text-center text-muted-foreground py-8">
                                        Carregando…
                                    </TableCell>
                                </TableRow>
                            ) : filtered.length ? (
                                filtered.map((row) => {
                                    const isFila = isFilaRow(row);
                                    const isSelected = selectedIds.has(row.id);
                                    const rowTabId = isAllMode ? ((row as GenericRow & { _tabId?: string })._tabId ?? "contratacao") : activeTab;
                                    const openDetail = () => handleOpenRowDetail(row);
                                    return (
                                        <TableRow
                                            key={`${rowTabId}-${row.id}`}
                                            className="cursor-pointer hover:bg-muted/40"
                                            onClick={openDetail}
                                        >
                                            {displayColumns.map((col, i) => (
                                                <TableCell key={col.key} className={i === 0 ? "font-semibold" : "text-sm"}>
                                                    {col.render ? col.render(row) : pick(row, col.key)}
                                                </TableCell>
                                            ))}
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <Button variant="outline" size="icon-xs" title="Ver detalhes" onClick={openDetail}>
                                                    <Eye />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={displayColumns.length + 1} className="text-center text-muted-foreground py-8">
                                        Nenhuma pendência encontrada.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* ── Bulk Confirmation Dialog ── */}
            <Dialog open={bulkConfirmAction !== null} onOpenChange={(open) => { if (!open && !bulkActing) setBulkConfirmAction(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {bulkConfirmAction === "approve" ? (
                                <><CheckCheck className="size-5 text-emerald-600" /> Aprovar Todos</>
                            ) : (
                                <><X className="size-5 text-red-600" /> Recusar Todos</>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {bulkConfirmAction === "approve"
                                ? `Você está prestes a aprovar ${selectedRows.length} solicitação${selectedRows.length !== 1 ? "ões" : ""} de uma vez.`
                                : `Você está prestes a recusar ${selectedRows.length} solicitação${selectedRows.length !== 1 ? "ões" : ""} de uma vez.`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-foreground mb-1.5 block">
                                Observação <span className="text-muted-foreground font-normal">(opcional — aplicada a todas)</span>
                            </label>
                            <textarea
                                className="w-full rounded-md border border-input bg-background p-2.5 text-sm placeholder:text-muted-foreground resize-none"
                                rows={3}
                                placeholder="Ex.: Aprovado conforme análise em reunião..."
                                value={bulkObs}
                                onChange={(e) => setBulkObs(e.target.value)}
                                disabled={bulkActing}
                            />
                        </div>

                        {/* Progress indicator */}
                        {bulkProgress && (
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Processando…</span>
                                    <span>{bulkProgress.done} / {bulkProgress.total}</span>
                                </div>
                                <div className="h-2 rounded-full bg-muted overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-primary transition-all duration-300"
                                        style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-1">
                            <Button
                                variant="outline"
                                onClick={() => setBulkConfirmAction(null)}
                                disabled={bulkActing}
                            >
                                Cancelar
                            </Button>
                            <Button
                                disabled={bulkActing}
                                className={bulkConfirmAction === "approve"
                                    ? "bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                                    : "bg-red-600 hover:bg-red-700 gap-1.5"}
                                onClick={() => void doBulkAction(bulkConfirmAction!)}
                            >
                                {bulkConfirmAction === "approve"
                                    ? <><CheckCheck className="size-4" />{bulkActing ? "Aprovando…" : `Aprovar ${selectedRows.length}`}</>
                                    : <><X className="size-4" />{bulkActing ? "Recusando…" : `Recusar ${selectedRows.length}`}</>
                                }
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Contratação Detail Dialog ── */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="flex h-[90vh] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
                    <div className="shrink-0 border-b bg-background px-6 pt-6 pb-4 pr-14">
                        <DialogHeader className="space-y-2 text-left">
                            <DialogTitle className="flex items-center gap-2">
                                Analisar Solicitação de Contratação
                                {detail && isFilaRow(detail) && <FilaBadge />}
                            </DialogTitle>
                            <DialogDescription>Revise os detalhes e tome uma ação.</DialogDescription>
                        </DialogHeader>
                    </div>

                    {detailLoading ? (
                        <div className="flex min-h-0 flex-1 items-center justify-center py-12">
                            <div className="border-lt-primary h-6 w-6 animate-spin rounded-full border-4 border-t-transparent" />
                        </div>
                    ) : detail ? (
                        <>
                            <div className="min-h-0 flex-1 overflow-hidden px-6 py-4">
                                <SolicitacaoForm
                                    key={detail.id}
                                    active={detailOpen}
                                    editId={detail.id}
                                    onCancel={() => {}}
                                    onSuccess={() => {}}
                                    viewOnly
                                    hideFooter
                                />
                            </div>

                            {solicitacaoVagaStatusAllowsApprovalActions(detail.status) && (
                                <div className="shrink-0 space-y-3 border-t bg-background px-6 py-4">
                                    <div className="text-sm font-semibold">Ações de aprovação</div>
                                    <textarea
                                        className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground"
                                        rows={2}
                                        placeholder="Observação (opcional)…"
                                        value={approvalObs}
                                        onChange={(e) => setApprovalObs(e.target.value)}
                                        disabled={acting}
                                    />
                                    <div className="flex flex-wrap justify-end gap-2">
                                        <Button
                                            size="sm"
                                            className="bg-emerald-600 hover:bg-emerald-700"
                                            disabled={acting}
                                            onClick={() => void doContratacaoAction(detail.id, "approve")}
                                        >
                                            <CheckCircle2 className="size-4" />
                                            Aprovar
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-orange-300 text-orange-600 hover:bg-orange-50"
                                            disabled={acting}
                                            onClick={() => void doContratacaoAction(detail.id, "request-changes")}
                                        >
                                            <AlertTriangle className="size-4" />
                                            Solicitar ajustes
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-red-300 text-red-600 hover:bg-red-50"
                                            disabled={acting}
                                            onClick={() => setRejectTarget({ row: { id: detail.id } as GenericRow, isContratacao: true })}
                                        >
                                            <XCircle className="size-4" />
                                            Reprovar
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* ── Desligamento view-only modal ── */}
            <DesligamentoFormModal
                open={viewDesligamentoId !== null}
                editId={viewDesligamentoId}
                onClose={() => setViewDesligamentoId(null)}
                onSaved={() => setViewDesligamentoId(null)}
                viewOnly
            />

            {/* ── Movimentação view-only modal ── */}
            <PromocaoFormModal
                open={viewPromocaoId !== null}
                editId={viewPromocaoId}
                onClose={() => setViewPromocaoId(null)}
                onSaved={() => setViewPromocaoId(null)}
                viewOnly
            />

            {/* ── Generic Detail Dialog ── */}
            <Dialog open={genericDetailOpen} onOpenChange={(o) => {
                setGenericDetailOpen(o);
                if (!o) setGenericDetailKind("default");
            }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {genericDetailKind === "rm_mov_timeline"
                                ? "Desligamento (espelho RM)"
                                : `Analisar Solicitação de ${activeTabDef.label}`}
                        </DialogTitle>
                        <DialogDescription>
                            {genericDetailKind === "rm_mov_timeline"
                                ? "Registro sincronizado da linha do tempo do colaborador. Aprovação efetiva ocorre no TOTVS RM."
                                : "Revise os detalhes e tome uma ação."}
                        </DialogDescription>
                    </DialogHeader>
                    {genericDetail && genericDetailKind === "rm_mov_timeline" && (
                        <div className="grid grid-cols-2 gap-3">
                            <DetailField label="Funcionário" value={pick(genericDetail, "funcionarioNome")} />
                            <DetailField label="CHAPA" value={pick(genericDetail, "chapaRm")} />
                            <DetailField label="ID requisição RM" value={pick(genericDetail, "idReqRm")} />
                            <DetailField label="Tipo" value={pick(genericDetail, "tipoDescricao")} />
                            <DetailField label="Status" value={pick(genericDetail, "statusDescricao")} />
                            <DetailField label="Abertura" value={formatDate(pick(genericDetail, "dataAbertura"))} />
                        </div>
                    )}
                    {genericDetail && genericDetailKind === "default" && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                {activeTabDef.columns.map(col => (
                                    <DetailField
                                        key={col.key}
                                        label={col.label}
                                        value={col.render ? col.render(genericDetail) : pick(genericDetail, col.key)}
                                    />
                                ))}
                                <DetailField label="Status" value={statusBadge(Number(genericDetail.status ?? 1))} />
                            </div>
                            {/* Approval chain via etapas */}
                            {Array.isArray(genericDetail.etapas) && (genericDetail.etapas as EtapaAprovacaoResponse[]).length > 0 && (
                                <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                                    <div className="text-sm font-semibold text-primary">Cadeia de Aprovação</div>
                                    <div className="space-y-1.5">
                                        {(genericDetail.etapas as EtapaAprovacaoResponse[]).map((e) => {
                                            const etapaStatusNum = e.status?.toLowerCase() === "aprovado" ? 1
                                                : e.status?.toLowerCase() === "reprovado" ? 2 : 0;
                                            return (
                                                <div key={e.ordem} className="flex items-center justify-between text-sm">
                                                    <span className="font-medium">{e.label}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span>{e.aprovadorNome ?? e.roleFilaNome ?? "Aguardando"}</span>
                                                        {etapaStatusNum > 0 && approvalChainBadge(etapaStatusNum)}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {/* Sem ações — visualização espelha o RM. Aprovação acontece no próprio TOTVS. */}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            {/* ── Reject reason dialog (quick-action buttons) ── */}
            <Dialog open={rejectTarget !== null} onOpenChange={(open) => { if (!open) setRejectTarget(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <XCircle className="size-5" /> Recusar Solicitação
                        </DialogTitle>
                        <DialogDescription>
                            Informe o motivo da recusa. Ele ficará visível para o solicitante.
                        </DialogDescription>
                    </DialogHeader>
                    <textarea
                        className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground"
                        rows={3}
                        placeholder="Motivo da recusa (opcional)..."
                        value={rejectObs}
                        onChange={(e) => setRejectObs(e.target.value)}
                        autoFocus
                    />
                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="outline" size="sm" onClick={() => setRejectTarget(null)}>
                            Cancelar
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            disabled={acting}
                            onClick={() => {
                                if (!rejectTarget) return;
                                const target = rejectTarget;
                                setRejectTarget(null);
                                if (target.isContratacao) {
                                    void doContratacaoAction(target.row.id, "reject", rejectObs);
                                } else {
                                    void doGenericAction(target.row, "reject", rejectObs);
                                }
                            }}
                        >
                            <XCircle className="size-4" />
                            {acting ? "Recusando…" : "Confirmar recusa"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    );
}
