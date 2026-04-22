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

import NextStepBanner from "@/components/feedback/NextStepBanner";
import DesligamentoFormModal from "@/features/gestao/desligamentos/DesligamentoFormModal";
import PromocaoFormModal from "@/features/gestao/promocoes/PromocaoFormModal";
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";

/* ──────────────────────────── types ──────────────────────────── */

type StatusKey = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
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
    areaId: string | null;
    areaName: string | null;
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
    9:  { label: "Aguarda Decisão RH",   color: "bg-amber-600/15 text-amber-800",  icon: AlertTriangle },
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
function isAguardandoDecisaoRH(status: unknown): boolean {
    return status === 9 || status === "AguardandoDecisaoRH";
}

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

type TabId = "contratacao" | "ferias" | "beneficio" | "dependentes" | "endereco" | "promocao" | "desligamento" | "_all";

interface TabDef {
    id: TabId;
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

const TABS: TabDef[] = [
    {
        id: "contratacao", label: "Contratação", icon: Briefcase,
        color: "text-violet-600", bgColor: "bg-violet-500/15",
        api: "/api/solicitacoes-vaga?statuses=1&statuses=5&statuses=9&statuses=10",
        assumirApi: "/api/solicitacoes-vaga",
        columns: [
            { key: "titulo", label: "Título" },
            { key: "solicitanteNome", label: "Solicitante" },
            etapaCol,
            { key: "urgencia", label: "Urgência", render: (r) => urgenciaBadge(Number(r.urgencia ?? 0)) },
            { key: "createdAtUtc", label: "Data", render: (r) => formatDate(pick(r, "createdAtUtc")) },
        ],
    },
    {
        id: "promocao", label: "Movimentação", icon: TrendingUp,
        color: "text-teal-600", bgColor: "bg-teal-500/15",
        api: "/api/solicitacoes-promocao?statuses=1&statuses=6",
        assumirApi: "/api/solicitacoes-promocao",
        columns: [
            { key: "funcionarioNome", label: "Funcionário" },
            { key: "novoCargoNome", label: "Novo Cargo" },
            etapaCol,
            { key: "dataEfetiva", label: "Data Efetiva", render: (r) => formatDate(pick(r, "dataEfetiva")) },
            { key: "createdAtUtc", label: "Data Solic.", render: (r) => formatDate(pick(r, "createdAtUtc")) },
        ],
    },
    {
        id: "desligamento", label: "Desligamento", icon: UserMinus,
        color: "text-rose-600", bgColor: "bg-rose-500/15",
        api: "/api/solicitacoes-desligamento?statuses=1&statuses=6",
        assumirApi: "/api/solicitacoes-desligamento",
        columns: [
            { key: "funcionarioNome", label: "Funcionário" },
            { key: "tipoDesligamento", label: "Tipo", render: (r) => TIPO_DESLIGAMENTO_MAP[Number(r.tipoDesligamento)] ?? String(r.tipoDesligamento ?? "—") },
            etapaCol,
            { key: "dataDesligamento", label: "Data Desligamento", render: (r) => formatDate(pick(r, "dataDesligamento")) },
            { key: "createdAtUtc", label: "Data Solic.", render: (r) => formatDate(pick(r, "createdAtUtc")) },
        ],
    },
    {
        id: "ferias", label: "Férias", icon: Palmtree,
        color: "text-sky-600", bgColor: "bg-sky-500/15",
        api: "/api/colaborador/solicitacoes-ferias?statuses=1&statuses=6",
        assumirApi: "/api/colaborador/solicitacoes-ferias",
        columns: [
            { key: "colaboradorNome", label: "Colaborador", render: (r) => pick(r, "colaboradorNome", pick(r, "solicitanteNome", "—")) },
            etapaCol,
            { key: "dataInicio", label: "Início", render: (r) => formatDate(pick(r, "dataInicio")) },
            { key: "dataFim", label: "Fim", render: (r) => formatDate(pick(r, "dataFim")) },
            { key: "dias", label: "Dias" },
            { key: "createdAtUtc", label: "Data Solic.", render: (r) => formatDate(pick(r, "createdAtUtc")) },
        ],
    },
    {
        id: "beneficio", label: "Benefício", icon: Heart,
        color: "text-pink-600", bgColor: "bg-pink-500/15",
        api: "/api/colaborador/solicitacoes-beneficio?statuses=1&statuses=6",
        assumirApi: "/api/colaborador/solicitacoes-beneficio",
        columns: [
            { key: "colaboradorNome", label: "Colaborador", render: (r) => pick(r, "colaboradorNome", pick(r, "solicitanteNome", "—")) },
            { key: "tipoBeneficio", label: "Tipo" },
            etapaCol,
            { key: "createdAtUtc", label: "Data Solic.", render: (r) => formatDate(pick(r, "createdAtUtc")) },
        ],
    },
    {
        id: "dependentes", label: "Dependentes", icon: Users,
        color: "text-indigo-600", bgColor: "bg-indigo-500/15",
        api: "/api/colaborador/solicitacoes-dependente?statuses=1&statuses=6",
        assumirApi: "/api/colaborador/solicitacoes-dependente",
        columns: [
            { key: "colaboradorNome", label: "Colaborador", render: (r) => pick(r, "colaboradorNome", pick(r, "solicitanteNome", "—")) },
            { key: "dependenteNome", label: "Dependente", render: (r) => pick(r, "dependenteNome", pick(r, "nome", "—")) },
            { key: "parentesco", label: "Parentesco" },
            etapaCol,
            { key: "createdAtUtc", label: "Data Solic.", render: (r) => formatDate(pick(r, "createdAtUtc")) },
        ],
    },
    {
        id: "endereco", label: "Endereço", icon: MapPin,
        color: "text-amber-600", bgColor: "bg-amber-500/15",
        api: "/api/colaborador/solicitacoes-endereco?statuses=1&statuses=6",
        assumirApi: "/api/colaborador/solicitacoes-endereco",
        columns: [
            { key: "colaboradorNome", label: "Colaborador", render: (r) => pick(r, "colaboradorNome", pick(r, "solicitanteNome", "—")) },
            { key: "logradouro", label: "Logradouro" },
            { key: "cidade", label: "Cidade" },
            etapaCol,
            { key: "createdAtUtc", label: "Data Solic.", render: (r) => formatDate(pick(r, "createdAtUtc")) },
        ],
    },
];

/* ──────────────────────────── component ──────────────────────────── */

const VALID_TAB_IDS: TabId[] = ["_all", "contratacao", "ferias", "beneficio", "dependentes", "endereco", "promocao", "desligamento"];
const LS_TAB_KEY = "aprovacoes:activeTab";

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
        _all: [], contratacao: [], ferias: [], beneficio: [], dependentes: [], endereco: [],
        promocao: [], desligamento: [],
    });
    const [loadingMap, setLoadingMap] = useState<Record<TabId, boolean>>({
        _all: true, contratacao: true, ferias: true, beneficio: true, dependentes: true, endereco: true,
        promocao: true, desligamento: true,
    });

    /* ── Contratação detail (real API) ── */
    const [detailOpen, setDetailOpen] = useState(false);
    const [detail, setDetail] = useState<SolicitacaoDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [lastApproved, setLastApproved] = useState<{ id: string; titulo: string } | null>(null);

    /* ── Decisão RH (AguardandoDecisaoRH) inline ── */
    const [decisaoRH, setDecisaoRH] = useState<"1" | "2" | "3" | "">("");
    const [prazoUnidade, setPrazoUnidade] = useState<"dias" | "meses">("meses");
    const [prazoValor, setPrazoValor] = useState(3);
    const [savingDecisao, setSavingDecisao] = useState(false);

    /* ── Generic detail for other types ── */
    const [genericDetailOpen, setGenericDetailOpen] = useState(false);
    const [genericDetail, setGenericDetail] = useState<GenericRow | null>(null);

    /* ── View-only modals for Desligamento and Movimentação ── */
    const [viewDesligamentoId, setViewDesligamentoId] = useState<string | null>(null);
    const [viewPromocaoId, setViewPromocaoId] = useState<string | null>(null);

    /* ── Fetch all tabs ── */
    const fetchTab = useCallback(async (tab: TabDef) => {
        try {
            const data = await fetchJson<GenericRow[]>(tab.api);
            setDataMap(prev => ({ ...prev, [tab.id]: Array.isArray(data) ? data : [] }));
        } catch {
            setDataMap(prev => ({ ...prev, [tab.id]: [] }));
        } finally {
            setLoadingMap(prev => ({ ...prev, [tab.id]: false }));
        }
    }, []);

    const refreshAll = useCallback(() => {
        setLoadingMap({ _all: true, contratacao: true, ferias: true, beneficio: true, dependentes: true, endereco: true, promocao: true, desligamento: true });
        TABS.forEach(tab => void fetchTab(tab));
    }, [fetchTab]);

    useEffect(() => { refreshAll(); }, [refreshAll]);

    /* ── Clear selection when tab changes ── */
    useEffect(() => { setSelectedIds(new Set()); }, [activeTab]);

    /* ── Row relevance: show only tasks assigned to me OR open fila items ── */
    const isMyRow = useCallback((row: GenericRow): boolean => {
        // Never show my own requests as pendências for me
        if (myFuncionarioId && row.solicitanteId === myFuncionarioId) return false;
        // Fila de perfil — unclaimed AND current user belongs to the role
        // etapaPendenteCanAssume is computed server-side based on user's role membership
        if (row.etapaPendenteCanAssume === true) return true;
        // Assumed by me directly (admin without Funcionario link)
        if (myUserId && row.etapaPendenteAssumedByUserId === myUserId) return true;
        // Nominated directly to me via Funcionario
        if (myFuncionarioId) {
            return row.etapaPendenteAprovadorId === myFuncionarioId;
        }
        // While me data is still loading, show everything
        return !meLoaded;
    }, [myFuncionarioId, myUserId, meLoaded]);

    /* ── Counts (per-tab, filtered to relevant items) ── */
    const counts = useMemo(() => {
        const c: Record<TabId, number> = { _all: 0, contratacao: 0, ferias: 0, beneficio: 0, dependentes: 0, endereco: 0, promocao: 0, desligamento: 0 };
        for (const tab of TABS) {
            c[tab.id] = dataMap[tab.id].filter(isMyRow).length;
        }
        return c;
    }, [dataMap, isMyRow]);

    const totalPendente = Object.values(counts).reduce((a, b) => a + b, 0);

    /* ── Filtered list for active tab ── */
    const isAllMode = activeTab === "_all";
    const activeTabDef = isAllMode ? TABS[0] : TABS.find(t => t.id === activeTab)!;

    const allColumns: { key: string; label: string; render?: (row: GenericRow) => React.ReactNode }[] = [
        { key: "_tipo", label: "Tipo", render: (row) => {
            const tabId = (row as GenericRow & { _tabId?: string })._tabId;
            const tab = TABS.find(t => t.id === tabId);
            if (!tab) return "—";
            const Icon = tab.icon;
            return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tab.color}`}><Icon className="size-3" />{tab.label}</span>;
        }},
        { key: "_desc", label: "Descrição", render: (row) => {
            const tabId = (row as GenericRow & { _tabId?: string })._tabId;
            const tab = TABS.find(t => t.id === tabId);
            if (!tab) return "—";
            const firstCol = tab.columns[0];
            return firstCol?.render ? firstCol.render(row) : pick(row, firstCol?.key ?? "id");
        }},
        { key: "createdAtUtc", label: "Data", render: (r) => formatDate(pick(r, "createdAtUtc")) },
    ];

    const filtered = useMemo(() => {
        let rows: GenericRow[];
        if (isAllMode) {
            // Merge all tabs, tagging each row with its source tab
            rows = TABS.flatMap(tab =>
                dataMap[tab.id].filter(isMyRow).map(r => ({ ...r, _tabId: tab.id }))
            );
            // Sort by date desc
            rows.sort((a, b) => {
                const da = new Date(pick(a, "createdAtUtc", "0")).getTime();
                const db = new Date(pick(b, "createdAtUtc", "0")).getTime();
                return db - da;
            });
        } else {
            rows = dataMap[activeTab].filter(isMyRow);
        }
        // Type filter: differentiate direct approver vs queue steps
        if (typeFilter === "direta") rows = rows.filter(r => !r.etapaPendenteIsQueue);
        if (typeFilter === "fila")   rows = rows.filter(r => Boolean(r.etapaPendenteIsQueue));
        const term = q.trim().toLowerCase();
        if (!term) return rows;
        return rows.filter(r => {
            const blob = Object.values(r).filter(v => typeof v === "string").join(" ").toLowerCase();
            return blob.includes(term);
        });
    }, [dataMap, activeTab, q, isMyRow, isAllMode, typeFilter]);

    /* ── Selectable rows (non-fila items I can directly approve/reject) ── */
    const selectableRows = useMemo(() => filtered.filter(r => !isFilaRow(r) && !isAguardandoDecisaoRH(r.status)), [filtered]);
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
        setDecisaoRH("");
        setPrazoUnidade("meses");
        setPrazoValor(3);
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

    async function handleCancelarDecisaoRH() {
        if (!detail) return;
        setSavingDecisao(true);
        try {
            await fetchJson(`/api/solicitacoes-vaga/${detail.id}/cancel`, { method: "POST" });
            toast.success("Solicitação cancelada.");
            setDetailOpen(false);
            pendencias.refresh();
            refreshAll();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSavingDecisao(false);
        }
    }

    async function handleDecisaoRH() {
        if (!detail || !decisaoRH) return;
        if (decisaoRH === "1" && prazoValor < 1) { toast.error("Informe um prazo válido."); return; }
        setSavingDecisao(true);
        try {
            const prazoMeses = decisaoRH === "1" && prazoUnidade === "meses" ? prazoValor : null;
            const prazoDataAlvo = decisaoRH === "1" && prazoUnidade === "dias"
                ? new Date(Date.now() + prazoValor * 86_400_000).toISOString()
                : null;
            await fetchJson(`/api/solicitacoes-vaga/${detail.id}/decisao-rh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ decisao: Number(decisaoRH), prazoMeses, prazoDataAlvo }),
            });
            toast.success("Decisão de headcount registrada com sucesso!");
            setDetailOpen(false);
            pendencias.refresh();
            refreshAll();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSavingDecisao(false);
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
                setLastApproved({ id: detail.id, titulo: detail.titulo });
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
    function openGenericDetail(row: GenericRow) {
        setGenericDetail(row);
        setGenericDetailOpen(true);
        setApprovalObs("");
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
    const isLoading = isAllMode ? Object.entries(loadingMap).some(([k, v]) => k !== "_all" && v) : loadingMap[activeTab];
    const displayColumns = isAllMode ? allColumns : activeTabDef.columns;

    return (
        <section className="space-y-4">
            {/* ── header ── */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Minhas Pendências</h1>
                    <div className="text-muted-foreground text-sm mt-0.5">
                        Solicitações que aguardam sua aprovação
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
                    description={`"${lastApproved.titulo}" foi aprovada. Crie a vaga para iniciar o recrutamento.`}
                    actions={[
                        { label: "Criar Vaga", href: `/vagas?newFromSolicitacao=${encodeURIComponent(lastApproved.id)}` },
                    ]}
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

            {/* ── Bulk action bar ── */}
            {!isLoading && selectableRows.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 bg-muted/40 px-4 py-3">
                    {/* Select all toggle */}
                    <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
                        <input
                            type="checkbox"
                            className="size-4 rounded border-gray-300 accent-primary cursor-pointer"
                            checked={allSelectableSelected}
                            onChange={toggleSelectAll}
                        />
                        <span className="text-sm font-medium text-foreground">
                            {someSelected
                                ? `${selectedIds.size} selecionada${selectedIds.size > 1 ? "s" : ""}`
                                : "Selecionar todas"}
                        </span>
                        {someSelected && (
                            <span className="text-xs text-muted-foreground">
                                de {selectableRows.length}
                            </span>
                        )}
                    </label>

                    <div className="flex-1" />

                    <div className="flex gap-2 shrink-0">
                        <Button
                            size="sm"
                            disabled={!someSelected}
                            className="bg-emerald-600 hover:bg-emerald-700 gap-1.5 disabled:opacity-40"
                            onClick={() => { setBulkObs(""); setBulkConfirmAction("approve"); }}
                        >
                            <CheckCheck className="size-4" />
                            <span>Aprovar{someSelected ? ` (${selectedIds.size})` : ""}</span>
                        </Button>
                        <Button
                            size="sm"
                            disabled={!someSelected}
                            variant="outline"
                            className="text-red-600 border-red-300 hover:bg-red-50 gap-1.5 disabled:opacity-40"
                            onClick={() => { setBulkObs(""); setBulkConfirmAction("reject"); }}
                        >
                            <X className="size-4" />
                            <span>Recusar{someSelected ? ` (${selectedIds.size})` : ""}</span>
                        </Button>
                    </div>
                </div>
            )}

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
                        <div className="relative w-full sm:w-auto">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-full sm:w-[260px] pl-8" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                    </div>
                    {/* Type chips */}
                    {(() => {
                        const base = isAllMode
                            ? TABS.flatMap(tab => dataMap[tab.id].filter(isMyRow))
                            : dataMap[activeTab].filter(isMyRow);
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
                        const tabDef = TABS.find(t => t.id === rowTabId) ?? TABS[0];
                        const TabIcon = tabDef.icon;
                        const isContratacao = rowTabId === "contratacao";
                        const isDesligamento = rowTabId === "desligamento";
                        const isPromocao = rowTabId === "promocao";
                        const openDetail = () => {
                            if (isContratacao) void openContratacaoDetail(row);
                            else if (isDesligamento) setViewDesligamentoId(row.id);
                            else if (isPromocao) setViewPromocaoId(row.id);
                            else openGenericDetail(row);
                        };
                        // Primary label — first column value
                        const firstCol = tabDef.columns[0];
                        const primaryLabel = firstCol?.render ? firstCol.render(row) : pick(row, firstCol?.key ?? "id");
                        // Secondary meta — next 1-2 columns
                        const metaCols = tabDef.columns.slice(1, 3).filter(c => c.key !== "etapaPendenteLabel");
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
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tabDef.color} ${tabDef.bgColor}`}>
                                                    <TabIcon className="size-3" />{tabDef.label}
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

                                {/* Action buttons — large, full-width touch targets */}
                                <div className="flex gap-2 pt-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-1.5 shrink-0"
                                        onClick={openDetail}
                                    >
                                        <Eye className="size-4" />
                                        <span>Ver</span>
                                    </Button>
                                    {isFila ? (
                                        <Button
                                            size="sm"
                                            disabled={acting}
                                            className="flex-1 bg-violet-600 hover:bg-violet-700 gap-1.5"
                                            onClick={() => void doAssumir(row)}
                                        >
                                            <UserCheck className="size-4" />
                                            Assumir
                                        </Button>
                                    ) : isAguardandoDecisaoRH(row.status) ? (
                                        <Button
                                            size="sm"
                                            className="flex-1 bg-amber-600 hover:bg-amber-700 gap-1.5"
                                            onClick={openDetail}
                                        >
                                            <AlertTriangle className="size-4" />
                                            Decidir HC
                                        </Button>
                                    ) : (
                                        <>
                                            <Button
                                                size="sm"
                                                disabled={acting}
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                                                onClick={() => {
                                                    setApprovalObs("");
                                                    if (isContratacao) void doContratacaoAction(row.id, "approve");
                                                    else void doGenericAction(row, "approve");
                                                }}
                                            >
                                                <CheckCircle2 className="size-4" />
                                                Aprovar
                                            </Button>
                                            <Button
                                                size="sm"
                                                disabled={acting}
                                                variant="destructive"
                                                className="flex-1 gap-1.5"
                                                onClick={() => {
                                                    setRejectObs("");
                                                    setRejectTarget({ row, isContratacao });
                                                }}
                                            >
                                                <XCircle className="size-4" />
                                                Recusar
                                            </Button>
                                        </>
                                    )}
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
                                <TableHead className="w-10">
                                    {selectableRows.length > 0 && (
                                        <input
                                            type="checkbox"
                                            className="size-4 rounded border-gray-300 accent-primary cursor-pointer"
                                            checked={allSelectableSelected}
                                            onChange={toggleSelectAll}
                                            title="Selecionar todas"
                                        />
                                    )}
                                </TableHead>
                                {displayColumns.map(col => (
                                    <TableHead key={col.key}>{col.label}</TableHead>
                                ))}
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={displayColumns.length + 2} className="text-center text-muted-foreground py-8">
                                        Carregando…
                                    </TableCell>
                                </TableRow>
                            ) : filtered.length ? (
                                filtered.map((row) => {
                                    const isFila = isFilaRow(row);
                                    const isSelected = selectedIds.has(row.id);
                                    const rowTabId = isAllMode ? ((row as GenericRow & { _tabId?: string })._tabId ?? "contratacao") : activeTab;
                                    const isContratacao = rowTabId === "contratacao";
                                    const isDesligamento = rowTabId === "desligamento";
                                    const isPromocao = rowTabId === "promocao";
                                    const openDetail = () => {
                                        if (isContratacao) void openContratacaoDetail(row);
                                        else if (isDesligamento) setViewDesligamentoId(row.id);
                                        else if (isPromocao) setViewPromocaoId(row.id);
                                        else openGenericDetail(row);
                                    };
                                    return (
                                        <TableRow
                                            key={`${rowTabId}-${row.id}`}
                                            className={`cursor-pointer hover:bg-muted/40 ${isFila ? "border-l-[3px] border-l-violet-400" : ""} ${isSelected ? "bg-primary/5" : ""}`}
                                            onClick={openDetail}
                                        >
                                            <TableCell onClick={(e) => e.stopPropagation()} className="w-10">
                                                {!isFila && (
                                                    <input
                                                        type="checkbox"
                                                        className="size-4 rounded border-gray-300 accent-primary cursor-pointer"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelect(row.id)}
                                                    />
                                                )}
                                            </TableCell>
                                            {displayColumns.map((col, i) => (
                                                <TableCell key={col.key} className={i === 0 ? "font-semibold" : "text-sm"}>
                                                    {i === 0 ? (
                                                        <div>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span>{col.render ? col.render(row) : pick(row, col.key)}</span>
                                                                {isFila && !isAllMode && <FilaBadge />}
                                                            </div>
                                                            <button
                                                                className="text-[10px] font-mono text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                                                                title={`ID: ${row.id} — clique para copiar`}
                                                                onClick={(e) => { e.stopPropagation(); void navigator.clipboard.writeText(row.id); }}
                                                            >
                                                                {row.id}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        col.render ? col.render(row) : pick(row, col.key)
                                                    )}
                                                </TableCell>
                                            ))}
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="outline"
                                                        size="icon-xs"
                                                        title="Ver detalhes"
                                                        onClick={openDetail}
                                                    >
                                                        <Eye />
                                                    </Button>
                                                    {isFila ? (
                                                        /* Fila de Perfil: only Assumir available */
                                                        <Button
                                                            size="sm"
                                                            disabled={acting}
                                                            className="bg-violet-600 hover:bg-violet-700 gap-1"
                                                            onClick={() => void doAssumir(row)}
                                                            title="Assumir esta tarefa como aprovador"
                                                        >
                                                            <UserCheck className="size-3" />
                                                            <span className="hidden sm:inline">Assumir</span>
                                                        </Button>
                                                    ) : isAguardandoDecisaoRH(row.status) ? (
                                                        /* AguardandoDecisaoRH: abre dialog com UI de decisão inline */
                                                        <Button
                                                            size="sm"
                                                            className="bg-amber-600 hover:bg-amber-700 gap-1"
                                                            title="Registrar decisão de headcount"
                                                            onClick={openDetail}
                                                        >
                                                            <AlertTriangle className="size-3" />
                                                            <span className="hidden sm:inline">Decidir HC</span>
                                                        </Button>
                                                    ) : (
                                                        /* Nominated: Approve / Reject inline */
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                className="bg-emerald-600 hover:bg-emerald-700"
                                                                title="Aprovar"
                                                                onClick={() => {
                                                                    setApprovalObs("");
                                                                    if (isContratacao) void doContratacaoAction(row.id, "approve");
                                                                    else void doGenericAction(row, "approve");
                                                                }}
                                                            >
                                                                <CheckCircle2 className="size-3" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                title="Reprovar"
                                                                onClick={() => {
                                                                    setRejectObs("");
                                                                    setRejectTarget({ row, isContratacao });
                                                                }}
                                                            >
                                                                <XCircle className="size-3" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={displayColumns.length + 2} className="text-center text-muted-foreground py-8">
                                        {meLoaded
                                            ? "Nenhuma pendência encontrada para você."
                                            : "Carregando seus dados…"}
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
                <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Analisar Solicitação de Contratação
                            {detail && isFilaRow(detail) && <FilaBadge />}
                        </DialogTitle>
                        <DialogDescription>Revise os detalhes e tome uma ação.</DialogDescription>
                    </DialogHeader>
                    {detailLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="border-lt-primary h-6 w-6 animate-spin rounded-full border-4 border-t-transparent" />
                        </div>
                    ) : detail ? (
                        <div className="space-y-4">
                            <Tabs defaultValue="identificacao">
                                <TabsList>
                                    <TabsTrigger value="identificacao">Identificação</TabsTrigger>
                                    <TabsTrigger value="aprovacao">Aprovação</TabsTrigger>
                                </TabsList>

                                {/* ── Tab: Identificação ── */}
                                <TabsContent value="identificacao" className="mt-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3">
                                        <SectionDivider title="Identificação" />
                                        <div className="sm:col-span-2"><DetailField label="Empresa" value={detail.empresaNome} /></div>
                                        <DetailField label="Tipo de Contrato" value={enumLabel(TIPO_CONTRATO_MAP, detail.tipoContrato)} />
                                        <div className="sm:col-span-2"><DetailField label="Local (Unidade)" value={detail.unitName} /></div>
                                        <DetailField label="Prazo (dias)" value={detail.tipoContrato !== 0 && detail.prazoDias ? `${detail.prazoDias} dias` : "—"} />
                                        <div className="sm:col-span-2"><DetailField label="Centro de Custo" value={detail.centroCustoNome} /></div>
                                        <DetailField label="Qtd. Posições" value={<span className="font-mono font-semibold">{detail.qtdPosicoes}</span>} />
                                        <div className="sm:col-span-2"><DetailField label="Lotação" value={detail.unidadeLotacaoNome} /></div>
                                        <DetailField label="Urgência" value={urgenciaBadge(detail.urgencia)} />

                                        <SectionDivider title="Dados da Vaga" />
                                        <div className="sm:col-span-3"><DetailField label="Título da Vaga" value={<span className="font-semibold">{detail.titulo}</span>} /></div>
                                        <DetailField label="Cargo" value={detail.jobPositionName} />
                                        <DetailField label="Tipo de Solicitação" value={enumLabel(TIPO_SOLICITACAO_MAP, detail.tipoSolicitacao)} />
                                        <DetailField label="Substituído" value={detail.tipoSolicitacao === 1 ? detail.substituidoNome : "—"} />
                                        <div className="sm:col-span-3"><DetailField label="Motivo da Requisição" value={enumLabel(MOTIVO_REQUISICAO_MAP, detail.motivoRequisicao)} /></div>
                                        <div className="sm:col-span-3 flex flex-wrap items-center gap-4">
                                            <div className="flex items-center gap-1.5 text-xs"><span className="text-muted-foreground">CNH obrigatória:</span> <BoolBadge value={detail.cnhObrigatoria} /></div>
                                            <div className="flex items-center gap-1.5 text-xs"><span className="text-muted-foreground">Disp. viagens:</span> <BoolBadge value={detail.disponibilidadeViagens} /></div>
                                            <div className="flex items-center gap-1.5 text-xs"><span className="text-muted-foreground">Confidencial:</span> <BoolBadge value={detail.isConfidencial} /></div>
                                        </div>
                                        {detail.justificativa && (
                                            <div className="sm:col-span-3">
                                                <div className="text-xs text-muted-foreground uppercase">Justificativa</div>
                                                <div className="mt-1 text-sm rounded-md bg-muted/30 p-3">{detail.justificativa}</div>
                                            </div>
                                        )}

                                        <SectionDivider title="Informações Gerais" />
                                        <DetailField label="Solicitante" value={detail.solicitanteNome} />
                                        <DetailField label="Área" value={detail.areaName} />
                                        <DetailField label="Data criação" value={formatDate(detail.createdAtUtc)} />
                                        <DetailField label="Status" value={statusBadge(Number(detail.status))} />
                                    </div>
                                </TabsContent>

                                {/* ── Tab: Aprovação ── */}
                                <TabsContent value="aprovacao" className="mt-4 space-y-4">
                                    {detail.etapasFluxo && detail.etapasFluxo.length > 0 && (
                                        <WorkflowTimeline etapas={detail.etapasFluxo} />
                                    )}
                                    {detail.observacaoAprovador && (
                                        <div>
                                            <div className="text-xs text-muted-foreground uppercase">Observação do aprovador</div>
                                            <div className="mt-1 text-sm rounded-md bg-muted/30 p-3">{detail.observacaoAprovador}</div>
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>

                            {/* Actions — always visible */}
                            {isAguardandoDecisaoRH(detail.status) && (
                                <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-4 space-y-3">
                                    <div>
                                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                            ⚠ Decisão de Headcount pendente
                                        </p>
                                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                                            Esta solicitação foi aprovada pelo fluxo de gestores e aguarda definição do RH antes de ser publicada.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="flex items-start gap-2 cursor-pointer">
                                            <input type="radio" name="decisaoRHApr" value="1" checked={decisaoRH === "1"} onChange={() => setDecisaoRH("1")} className="mt-0.5" />
                                            <span className="text-sm text-amber-800 dark:text-amber-200">
                                                <strong>Substituição provisória</strong> — alguém está saindo; define prazo estimado de revisão
                                            </span>
                                        </label>
                                        {decisaoRH === "1" && (
                                            <div className="ml-5 flex items-center gap-2 flex-wrap">
                                                <span className="text-xs text-amber-700 font-medium">Prazo:</span>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={prazoValor}
                                                    onChange={(e) => setPrazoValor(Math.max(1, Number(e.target.value)))}
                                                    className="w-16 rounded border border-amber-300 bg-white px-2 py-0.5 text-sm text-center"
                                                />
                                                <select
                                                    value={prazoUnidade}
                                                    onChange={(e) => setPrazoUnidade(e.target.value as "dias" | "meses")}
                                                    className="rounded border border-amber-300 bg-white px-2 py-0.5 text-sm"
                                                >
                                                    <option value="dias">dias</option>
                                                    <option value="meses">meses</option>
                                                </select>
                                            </div>
                                        )}
                                        <label className="flex items-start gap-2 cursor-pointer">
                                            <input type="radio" name="decisaoRHApr" value="2" checked={decisaoRH === "2"} onChange={() => setDecisaoRH("2")} className="mt-0.5" />
                                            <span className="text-sm text-amber-800 dark:text-amber-200">
                                                <strong>Aumento definitivo de headcount</strong> — encaminha para aprovação da Diretoria
                                            </span>
                                        </label>
                                        <label className="flex items-start gap-2 cursor-pointer">
                                            <input type="radio" name="decisaoRHApr" value="3" checked={decisaoRH === "3"} onChange={() => setDecisaoRH("3")} className="mt-0.5" />
                                            <span className="text-sm text-amber-800 dark:text-amber-200">
                                                <strong>Consumir headcount disponível</strong> — utiliza posições existentes sem aumentar o headcount
                                            </span>
                                        </label>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            size="sm"
                                            disabled={!decisaoRH || savingDecisao}
                                            onClick={() => void handleDecisaoRH()}
                                            className="bg-amber-600 hover:bg-amber-700 text-white"
                                        >
                                            {savingDecisao ? "Registrando…" : "Confirmar decisão"}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={savingDecisao}
                                            onClick={() => void handleCancelarDecisaoRH()}
                                            className="text-red-600 border-red-300 hover:bg-red-50"
                                        >
                                            <XCircle className="size-4 mr-1" />
                                            Cancelar fluxo
                                        </Button>
                                    </div>
                                </div>
                            )}
                            {(detail.status === 1 || detail.status === "PendenteAprovacao") && (
                                isFilaRow(detail) ? (
                                    <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
                                        <div className="text-sm font-semibold text-violet-700 flex items-center gap-2">
                                            <FilaBadge />
                                            Fila de Perfil
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                                            Esta solicitação está na fila e pode ser assumida por qualquer membro do perfil configurado.
                                            Ao assumir, você se torna o aprovador designado e poderá aprovar ou reprovar.
                                        </p>
                                        <Button
                                            size="sm"
                                            disabled={acting}
                                            className="mt-3 bg-violet-600 hover:bg-violet-700 gap-1.5"
                                            onClick={() => void doAssumir(detail as unknown as GenericRow)}
                                        >
                                            <UserCheck className="size-4" />
                                            {acting ? "Assumindo…" : "Assumir tarefa"}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                                        <div className="text-sm font-semibold text-amber-700">Sua decisão</div>
                                        <textarea
                                            className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground"
                                            rows={2}
                                            placeholder="Observação (opcional)..."
                                            value={approvalObs}
                                            onChange={(e) => setApprovalObs(e.target.value)}
                                        />
                                        <div className="flex flex-wrap gap-2">
                                            <Button size="sm" disabled={acting} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void doContratacaoAction(detail.id, "approve")}>
                                                <CheckCircle2 className="size-4" /> Aprovar
                                            </Button>
                                            <Button size="sm" variant="outline" disabled={acting} className="text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => void doContratacaoAction(detail.id, "request-changes")}>
                                                <AlertTriangle className="size-4" /> Pedir Ajustes
                                            </Button>
                                            <Button size="sm" variant="outline" disabled={acting} className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => void doContratacaoAction(detail.id, "reject")}>
                                                <XCircle className="size-4" /> Reprovar
                                            </Button>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
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
            <Dialog open={genericDetailOpen} onOpenChange={setGenericDetailOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Analisar Solicitação de {activeTabDef.label}</DialogTitle>
                        <DialogDescription>Revise os detalhes e tome uma ação.</DialogDescription>
                    </DialogHeader>
                    {genericDetail && (
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
                            {/* Actions */}
                            {isFilaRow(genericDetail) ? (
                                /* Fila de Perfil — Assumir */
                                <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
                                    <div className="text-sm font-semibold text-violet-700 flex items-center gap-2">
                                        <FilaBadge />
                                        Fila de Perfil
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                                        Esta solicitação está na fila e pode ser assumida por qualquer membro do perfil configurado.
                                    </p>
                                    <Button
                                        size="sm"
                                        disabled={acting}
                                        className="mt-3 bg-violet-600 hover:bg-violet-700 gap-1.5"
                                        onClick={() => void doAssumir(genericDetail)}
                                    >
                                        <UserCheck className="size-4" />
                                        {acting ? "Assumindo…" : "Assumir tarefa"}
                                    </Button>
                                </div>
                            ) : (
                                /* Nominated — normal approval */
                                <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                                    <div className="text-sm font-semibold text-amber-700">Sua decisão</div>
                                    <textarea
                                        className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground"
                                        rows={2}
                                        placeholder="Observação (opcional)..."
                                        value={approvalObs}
                                        onChange={(e) => setApprovalObs(e.target.value)}
                                    />
                                    <div className="flex flex-wrap gap-2">
                                        <Button size="sm" disabled={acting} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void doGenericAction(genericDetail, "approve")}>
                                            <CheckCircle2 className="size-4" /> Aprovar
                                        </Button>
                                        <Button size="sm" variant="outline" disabled={acting} className="text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => void doGenericAction(genericDetail, "request-changes")}>
                                            <AlertTriangle className="size-4" /> Pedir Ajustes
                                        </Button>
                                        <Button size="sm" variant="outline" disabled={acting} className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => void doGenericAction(genericDetail, "reject")}>
                                            <XCircle className="size-4" /> Reprovar
                                        </Button>
                                    </div>
                                </div>
                            )}
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
