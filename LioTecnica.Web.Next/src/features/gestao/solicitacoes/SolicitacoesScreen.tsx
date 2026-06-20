"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMobileSolicitacaoFormPreferred } from "@/hooks/useMobileSolicitacaoFormPreferred";
import { SolicitacaoVagaStatusBadgeEl } from "@/features/gestao/shared/solicitacaoVagaStatusUi";
import {
    EMPTY_SOLICITACAO_CONTAGENS,
    expandStatusKeys,
    type SolicitacaoVagaContagens,
} from "@/features/gestao/solicitacoes/solicitacaoStatusRules";
import { useAuth, useHasPermission, useIsAdminOrOwner } from "@/hooks/useAuth";
import { toast } from "sonner";
import Swal from "sweetalert2";
import {
    Search,
    RefreshCw,
    Eye,
    Pencil,
    Trash2,
    Send,
    Clock,
    CheckCircle2,
    Columns3,
    List,
    XCircle,
    AlertTriangle,
    FileText,
    Lock,
    UserMinus,
    Briefcase,
    Activity,
    Ban,
    Copy,
    Plus,
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
} from "lucide-react";
import DesligamentosScreen from "@/features/gestao/desligamentos/DesligamentosScreen";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";

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
    DialogFooter,
} from "@/components/ui/dialog";
import { RhAnalistaAutocomplete } from "@/components/autocomplete/RhAnalistaAutocomplete";

import SolicitacaoFormModal, { type SolicitacaoDraft } from "./SolicitacaoFormModal";
import AcompanhamentoModal, { AprovacaoStep } from "@/features/gestao/shared/AcompanhamentoModal";
import NextStepBanner from "@/components/feedback/NextStepBanner";
import {
    mapEtapasToSteps,
    mapTimelineEventosToSteps,
    normalizeEtapaStatus,
    type EtapaAprovacaoResponse,
    type SolicitacaoTimelineEventoResponse,
} from "@/features/gestao/shared/etapaUtils";
import PaginationBar from "@/components/pagination/PaginationBar";
import {
    formatSolicitacaoCodigoRm,
    formatTipoSolicitacaoLabel,
    tipoSolicitacaoBadgeClass,
} from "@/features/gestao/solicitacoes/rmRequisicaoFormat";

/* ──────────────────────────── types ──────────────────────────── */

interface SolicitacaoGridRow {
    id: string;
    titulo: string;
    urgencia: number | string;
    status: number | string;
    solicitanteId: string;
    solicitanteNome: string | null;
    aprovadorId: string | null;
    aprovadorNome: string | null;
    analistaRhResponsavelUserId?: string | null;
    analistaRhResponsavelNome?: string | null;
    centroCustoNome: string | null;
    qtdPosicoes: number;
    tipoSolicitacao: number | string;
    isConfidencial: boolean;
    substituidoNome: string | null;
    createdAtUtc: string;
    etapaPendenteLabel: string | null;
    etapaPendenteCom: string | null;
    /** Aprovador da etapa pendente (workflow) — melhor que `aprovadorId` legado na linha. */
    etapaPendenteAprovadorId?: string | null;
    rmIdReq?: number | null;
    rmRequisicaoCodigo?: string | null;
    rmTipoRequisicao?: string | null;
}

interface TenantConfiguracaoDto {
    requisicoesVagaOrigemRm?: boolean;
}

function isStatusDistribuivelParaAnalistaRh(status: number | string): boolean {
    const s = String(status);
    return (
        s === "PendenteAprovacaoRh"
        || s === "5"
        || s === "Aprovada"
        || s === "2"
        || s === "Concluida"
        || s === "8"
        || s === "EmIntegracao"
        || s === "7"
        || s === "PendenteTriagem"
        || s === "11"
        || s === "EmTriagem"
        || s === "12"
        || s === "DevolvidaTriagemGestor"
        || s === "13"
        || s === "PendenteIntegracaoRm"
        || s === "14"
        || s === "ErroIntegracaoRm"
        || s === "15"
        || s === "AguardandoReprocessamentoRm"
        || s === "16"
    );
}

function dedupeSolicitacoesPorId(items: SolicitacaoGridRow[]): SolicitacaoGridRow[] {
    const m = new Map<string, SolicitacaoGridRow>();
    for (const r of items) m.set(r.id, r);
    return [...m.values()];
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
    analistaRhResponsavelUserId?: string | null;
    analistaRhResponsavelNome?: string | null;
    jobPositionId: string | null;
    jobPositionName: string | null;
    centroCustoId: string | null;
    centroCustoNome: string | null;
    unitId: string | null;
    unitName: string | null;
    vagaId: string | null;
    observacaoAprovador: string | null;
    tipoSolicitacao: number;
    isConfidencial: boolean;
    substituidoFuncionarioId: string | null;
    substituidoNome: string | null;
    createdAtUtc: string;
    updatedAtUtc: string;
    approvedAtUtc: string | null;
    aprovador1Nome?: string | null;
    aprovador1Status?: number | string;
    aprovador2Nome?: string | null;
    aprovador2Status?: number | string | null;
    aprovador2Habilitado?: boolean;
    aprovador3Nome?: string | null;
    aprovador3Status?: number | string | null;
    aprovador3Habilitado?: boolean;
    etapas?: EtapaAprovacaoResponse[];
    etapasFluxo?: { ordem: number; label: string; aprovadorNome: string | null; roleNome: string | null; status: number | string; dataUtc: string | null; observacao: string | null }[];
    timelineEventos?: SolicitacaoTimelineEventoResponse[];
    rmCodStatus?: number | string | null;
    rmUltimaStatusDescricaoRm?: string | null;
    rmStatusSyncUltimaMensagem?: string | null;
    rmUltimaSincronizacaoUtc?: string | null;
    rmRequisicaoCodigo?: string | null;
}

type StatusKey = 0 | 1 | 2 | 3 | 4 | string;
type UrgenciaKey = 0 | 1 | 2 | 3 | string;
type SolicitacaoSortKey = "codigoRm" | "titulo" | "secao" | "tipo" | "posicoes" | "urgencia" | "status" | "aguardando" | "data" | "abertoHa" | "requisitante";

/* ──────────────────────────── helpers ──────────────────────────── */

const API = "/api/solicitacoes-vaga";

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

/** Colunas do kanban (rótulo legado; status real vem de `SolicitacaoVagaStatusBadgeEl`). */
const KANBAN_COL_META: Record<"Rascunho" | "PendenteAprovacao" | "Aprovada" | "Reprovada", { label: string; color: string; icon: React.ElementType }> = {
    "Rascunho": { label: "Rascunho", color: "bg-zinc-400/15 text-zinc-600", icon: FileText },
    "PendenteAprovacao": { label: "Em andamento", color: "bg-amber-500/15 text-amber-700", icon: Clock },
    "Aprovada": { label: "Aprovada / avançadas", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    "Reprovada": { label: "Reprovada", color: "bg-red-500/15 text-red-700", icon: XCircle },
};

const ROW_STATUS_COL_PENDENTE_LIKE = new Set<string>([
    "PendenteAprovacao", "1",
    "AjustesNecessarios", "4",
    "PendenteAprovacaoRh", "5",
    "EmIntegracao", "7",
    "PendenteAprovacaoAumentoHC", "10",
    "PendenteTriagem", "11",
    "EmTriagem", "12",
    "DevolvidaTriagemGestor", "13",
    "PendenteIntegracaoRm", "14",
    "ErroIntegracaoRm", "15",
    "AguardandoReprocessamentoRm", "16",
]);


function rowStatusMatchesKanbanCol(r: SolicitacaoGridRow, col: keyof typeof KANBAN_COL_META): boolean {
    const s = String(r.status);
    if (col === "PendenteAprovacao") return ROW_STATUS_COL_PENDENTE_LIKE.has(s);
    return s === col || (col === "Rascunho" && (s === "0" || s === "Rascunho"))
        || (col === "Aprovada" && (s === "Aprovada" || s === "2" || s === "Concluida" || s === "8"))
        || (col === "Reprovada" && (s === "Reprovada" || s === "3"))
        ;
}

const URGENCIA_MAP: Record<string, { label: string; color: string }> = {
    "Baixa": { label: "Baixa", color: "bg-sky-500/15 text-sky-700" },
    "Media": { label: "Média", color: "bg-amber-500/15 text-amber-700" },
    "Alta": { label: "Alta", color: "bg-orange-500/15 text-orange-700" },
    "Critica": { label: "Crítica", color: "bg-red-500/15 text-red-700" },
    0: { label: "Baixa", color: "bg-sky-500/15 text-sky-700" },
    1: { label: "Média", color: "bg-amber-500/15 text-amber-700" },
    2: { label: "Alta", color: "bg-orange-500/15 text-orange-700" },
    3: { label: "Crítica", color: "bg-red-500/15 text-red-700" },
};

function statusBadge(status: number | string) {
    return <SolicitacaoVagaStatusBadgeEl raw={status} />;
}

function urgenciaBadge(urgencia: number | string) {
    const u = URGENCIA_MAP[urgencia] ?? URGENCIA_MAP["Media"] ?? URGENCIA_MAP[1];
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.color}`}>
            {u.label}
        </span>
    );
}

function formatDate(iso: string | null | undefined) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    } catch {
        return "—";
    }
}

function formatOpenDays(iso: string | null | undefined) {
    if (!iso) return "—";
    const openedAt = new Date(iso).getTime();
    if (!Number.isFinite(openedAt)) return "—";

    const elapsedMs = Date.now() - openedAt;
    const days = Math.max(0, Math.floor(elapsedMs / 86_400_000));
    return days === 1 ? "1 dia" : `${days} dias`;
}

function solicitacaoCodigoRm(r: Pick<SolicitacaoGridRow, "rmIdReq" | "rmRequisicaoCodigo">): string {
    return formatSolicitacaoCodigoRm(r) || "—";
}

function truncateTitle(value: string | null | undefined, maxLength = 60) {
    const text = value?.trim() ?? "";
    if (!text) return "—";
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

async function showAnalistaRhObrigatoriaAlert() {
    const previousPointerEvents = document.body.style.pointerEvents;

    await Swal.fire({
        icon: "warning",
        title: "Selecione uma Analista de RH",
        text: "Para distribuir a solicitação, selecione uma Analista de RH.",
        confirmButtonText: "Entendi",
        didOpen: () => {
            document.body.style.pointerEvents = "auto";
            const container = Swal.getContainer();
            if (container) container.style.zIndex = "10000";
        },
        willClose: () => {
            document.body.style.pointerEvents = previousPointerEvents;
        },
    });
}

/* ──────────────────────────── component ──────────────────────────── */

/* ══════════════════════════════════════════════════════════════
   Wrapper com tabs: Vagas | Desligamentos
   ══════════════════════════════════════════════════════════════ */

type TopTab = "vagas" | "desligamentos";

const TOP_TABS: { id: TopTab; label: string; icon: React.ElementType }[] = [
    { id: "vagas", label: "Requisição de Pessoal", icon: Briefcase },
    { id: "desligamentos", label: "Desligamento", icon: UserMinus },
];

export default function SolicitacoesScreen() {
    const searchParams = useSearchParams();
    const tabParam = searchParams.get("tab");
    const initialTab: TopTab =
        tabParam === "desligamentos" ? "desligamentos" : "vagas";
    const [topTab, setTopTab] = useState<TopTab>(initialTab);

    return (
        <section className="space-y-4">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Solicitações</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                    Gerencie solicitações de vagas e desligamentos
                </p>
            </div>

            {/* ── Top-level tabs ── */}
            <div className="flex gap-1 border-b border-border/40">
                {TOP_TABS.map(tab => {
                    const Icon = tab.icon;
                    const active = topTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setTopTab(tab.id)}
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

            {topTab === "vagas" && <SolicitacoesVagaContent />}
            {topTab === "desligamentos" && <DesligamentosScreen />}
        </section>
    );
}

function SolicitacoesVagaContent() {
    const { me } = useAuth();
    const router = useRouter();
    const prefersMobileForm = useMobileSolicitacaoFormPreferred();
    const canViewRhContratacoes = useHasPermission("rh.contratacoes.view");
    const canTriagemRhContratacoes = useHasPermission("rh.contratacoes.triagem");
    const canSelecaoRhContratacoes = useHasPermission("rh.contratacoes.selecao");
    const isAdmin = me?.roles?.some((r: string) => r.toLowerCase() === "admin" || r.toLowerCase() === "administrador") ?? false;
    const isAdminOrOwner = useIsAdminOrOwner();
    const normalizedRoles = useMemo(
        () => (me?.roles ?? []).map((r: string) => r.trim().toLowerCase()),
        [me?.roles],
    );
    const isRhAnalista = normalizedRoles.some((role) => role.includes("analista") && role.includes("rh"));
    const isRhEspecialista = normalizedRoles.some((role) => role.includes("especialista") && role.includes("rh"));
    const isRhLegadoAmplo = normalizedRoles.some((role) => role === "rh" || role.startsWith("recrutador"));
    const rhListaAmpla =
        !isRhAnalista && (
            isRhEspecialista
            || isRhLegadoAmplo
            || canViewRhContratacoes
            || canTriagemRhContratacoes
            || canSelecaoRhContratacoes
        );
    const canDistribuirParaAnalistaRh = isAdminOrOwner || isRhEspecialista;

    /* ── data ── */
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<SolicitacaoGridRow[]>([]);
    const [pendingRows, setPendingRows] = useState<SolicitacaoGridRow[]>([]);
    const [contagens, setContagens] = useState<SolicitacaoVagaContagens>(EMPTY_SOLICITACAO_CONTAGENS);
    const [selectedSolicitacaoIds, setSelectedSolicitacaoIds] = useState<string[]>([]);
    const [requisicoesVagaOrigemRm, setRequisicoesVagaOrigemRm] = useState(false);

    /* ── filters ── */
    const [q, setQ] = useState("");
    // "ativas" = padrão enterprise: mostra itens em andamento no fluxo,
    // incluindo solicitações já aprovadas que ainda seguem para tratativa do RH.
    const [statusFilter, setStatusFilter] = useState("ativas");
    const [viewMode, setViewModeRaw] = useState<"list" | "kanban">(() => {
        if (typeof window === "undefined") return "list";
        return (localStorage.getItem("renderrh.solicitacoes.viewMode") as "list" | "kanban") || "list";
    });
    const setViewMode = (m: "list" | "kanban") => { setViewModeRaw(m); localStorage.setItem("renderrh.solicitacoes.viewMode", m); };
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [sortKey, setSortKey] = useState<SolicitacaoSortKey>("data");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    function handleSort(key: SolicitacaoSortKey) {
        setPage(1);
        if (sortKey === key) {
            setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
            return;
        }
        setSortKey(key);
        setSortDir(key === "data" || key === "abertoHa" ? "desc" : "asc");
    }

    function SortIcon({ col }: { col: SolicitacaoSortKey }) {
        if (sortKey !== col) return <ChevronsUpDown className="ml-1 inline size-3 text-muted-foreground/50" />;
        return sortDir === "asc"
            ? <ChevronUp className="ml-1 inline size-3" />
            : <ChevronDown className="ml-1 inline size-3" />;
    }

    /* ── form modal ── */
    const [formReloadNonce, setFormReloadNonce] = useState(0);
    const bumpFormNonce = () => setFormReloadNonce((n) => n + 1);

    const [formOpen, setFormOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [viewId, setViewId] = useState<string | null>(null);
    /** Linha da grade ao abrir "Visualizar" (ações extras no rodapé do modal, ex.: distribuir analista RH). */
    const [viewMetaRow, setViewMetaRow] = useState<SolicitacaoGridRow | null>(null);
    const [resubmit, setResubmit] = useState(false);
    const [copySourceId, setCopySourceId] = useState<string | null>(null);
    const [formInitialData, setFormInitialData] = useState<Partial<SolicitacaoDraft> | null>(null);

    /* ── vaga picker ── */
    /* ── timeline modal ── */
    const [timelineOpen, setTimelineOpen] = useState(false);
    const [timelineSteps, setTimelineSteps] = useState<AprovacaoStep[]>([]);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineStatus, setTimelineStatus] = useState<number | string | null>(null);

    const [detailAnalistaRh, setDetailAnalistaRh] = useState<{ userId: string | null; nome: string | null }>({ userId: null, nome: null });
    const [detailAssigning, setDetailAssigning] = useState(false);

    const [myFuncionarioId, setMyFuncionarioId] = useState<string | null>(null);
    const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
    const [bulkAssigning, setBulkAssigning] = useState(false);
    const [bulkAnalistaRh, setBulkAnalistaRh] = useState<{ userId: string | null; nome: string | null }>({ userId: null, nome: null });

    /* ── delete confirm ── */
    const [deleteTarget, setDeleteTarget] = useState<SolicitacaoGridRow | null>(null);


    /* ── approval actions ── */
    const [approvalObs, setApprovalObs] = useState("");

    /* ── next step banner after approval ── */
    const [lastApproved, setLastApproved] = useState<{ id: string; titulo: string } | null>(null);

    useEffect(() => {
        let cancelled = false;
        void fetchJson<TenantConfiguracaoDto>("/api/tenant-configuracao")
            .then((config) => {
                if (!cancelled) setRequisicoesVagaOrigemRm(!!config.requisicoesVagaOrigemRm);
            })
            .catch(() => {
                if (!cancelled) setRequisicoesVagaOrigemRm(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    /* ── resolve meu funcionarioId para filtrar aprovações ── */
    /** Lista: edição/cancelar/copiar só para o solicitante (admin/owner mantém tudo). Terceiros só olham + timeline. */
    const isExternoAoSolicitanteLista = useCallback(
        (r: SolicitacaoGridRow) =>
            !isAdminOrOwner &&
            !!myFuncionarioId &&
            r.solicitanteId !== myFuncionarioId,
        [isAdminOrOwner, myFuncionarioId],
    );

    /* ── data loading ── */
    const syncList = useCallback(async () => {
        // Resolver funcionarioId do user logado (para filtrar aprovações)
        let funcId = myFuncionarioId;
        if (!funcId) {
            try {
                const meRes = await fetchJson<Record<string, unknown>>("/api/me");
                if (meRes?.funcionarioId) {
                    funcId = String(meRes.funcionarioId);
                    setMyFuncionarioId(funcId);
                }
            } catch { /* ignore */ }
        }

        const [myData, allData, contagensData] = await Promise.all([
            fetchJson<SolicitacaoGridRow[]>(`${API}?apenasMeus=true&pageSize=100`),
            fetchJson<SolicitacaoGridRow[]>(`${API}?pageSize=100`).catch(() => []),
            fetchJson<SolicitacaoVagaContagens>(`${API}/contagens`).catch(() => EMPTY_SOLICITACAO_CONTAGENS),
        ]);
        const allItems = Array.isArray(allData) ? allData : [];
        const mine = Array.isArray(myData) ? myData : [];

        let nextRows: SolicitacaoGridRow[];
        if (rhListaAmpla) {
            nextRows = allItems;
        } else {
            const isPendente = (s: number | string) => s === 1 || s === "PendenteAprovacao";
            const precisoAprovar = funcId
                ? allItems.filter((r) => {
                    if (!isPendente(r.status)) return false;
                    const ep = r.etapaPendenteAprovadorId ?? r.aprovadorId;
                    return ep === funcId;
                })
                : [];
            nextRows = dedupeSolicitacoesPorId([...mine, ...allItems, ...precisoAprovar]);
        }
        setRows(nextRows);
        setContagens(contagensData ?? EMPTY_SOLICITACAO_CONTAGENS);

        const isPendente = (s: number | string) => s === 1 || s === "PendenteAprovacao";
        const pending = funcId
            ? allItems.filter((r) => {
                if (!isPendente(r.status)) return false;
                const ep = r.etapaPendenteAprovadorId ?? r.aprovadorId;
                return ep === funcId;
            })
            : allItems.filter((r) => isPendente(r.status));
        setPendingRows(pending);
    }, [myFuncionarioId, rhListaAmpla]);

    useEffect(() => {
        setSelectedSolicitacaoIds((prev) => prev.filter((id) => rows.some((row) => row.id === id)));
    }, [rows]);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        syncList()
            .catch((e) => toast.error(`Falha ao carregar solicitações: ${e instanceof Error ? e.message : "erro"}`))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [syncList]);

    const statusAtivosSet = useMemo(
        () => expandStatusKeys(contagens.statusAtivosKeys),
        [contagens.statusAtivosKeys],
    );
    const statusAprovadosSet = useMemo(
        () => expandStatusKeys(contagens.statusAprovadosKeys),
        [contagens.statusAprovadosKeys],
    );

    /* ── filtering ── */
    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        return rows.filter((r) => {
            const s = String(r.status);
            if (statusFilter === "ativas" && !statusAtivosSet.has(s)) return false;
            if (statusFilter === "aprovadas" && !statusAprovadosSet.has(s)) return false;
            if (statusFilter === "reprovadas" && s !== "Reprovada" && s !== "3") return false;
            if (statusFilter === "canceladas" && s !== "Cancelada" && s !== "6") return false;
            // "todas" — sem filtro de status
            if (!term) return true;
            const blob = [
                solicitacaoCodigoRm(r),
                r.rmRequisicaoCodigo,
                r.rmIdReq != null ? String(r.rmIdReq) : "",
                r.titulo,
                r.solicitanteNome,
                r.centroCustoNome,
            ].filter(Boolean).join(" ").toLowerCase();
            return blob.includes(term);
        });
    }, [q, rows, statusFilter, statusAtivosSet, statusAprovadosSet]);

    useEffect(() => {
        setPage(1);
    }, [q, statusFilter, pageSize]);

    const sorted = useMemo(() => {
        const getValue = (r: SolicitacaoGridRow): string | number => {
            if (sortKey === "codigoRm") return solicitacaoCodigoRm(r);
            if (sortKey === "titulo") return r.titulo ?? "";
            if (sortKey === "secao") return r.centroCustoNome ?? "";
            if (sortKey === "tipo") return String(r.tipoSolicitacao);
            if (sortKey === "posicoes") return r.qtdPosicoes ?? 0;
            if (sortKey === "urgencia") return String(r.urgencia);
            if (sortKey === "status") return String(r.status);
            if (sortKey === "aguardando") return r.etapaPendenteCom ?? r.etapaPendenteLabel ?? "";
            if (sortKey === "requisitante") return r.solicitanteNome ?? "";
            return new Date(r.createdAtUtc).getTime() || 0;
        };

        return [...filtered].sort((a, b) => {
            const av = getValue(a);
            const bv = getValue(b);
            const result = typeof av === "number" && typeof bv === "number"
                ? av - bv
                : String(av).localeCompare(String(bv), "pt-BR", { sensitivity: "base", numeric: true });
            return sortDir === "asc" ? result : -result;
        });
    }, [filtered, sortDir, sortKey]);

    const pagedRows = useMemo(() => {
        const start = (Math.max(page, 1) - 1) * pageSize;
        return sorted.slice(start, start + pageSize);
    }, [page, pageSize, sorted]);

    const filteredDistribuiveis = useMemo(
        () => pagedRows.filter((r) => isStatusDistribuivelParaAnalistaRh(r.status)),
        [pagedRows],
    );
    const allDistribuiveisSelecionados = filteredDistribuiveis.length > 0
        && filteredDistribuiveis.every((r) => selectedSolicitacaoIds.includes(r.id));

    /* ── actions ── */
    function openNovaPosicao() {
        if (requisicoesVagaOrigemRm) {
            toast.info("Este tenant recebe requisições aprovadas do RM. Criação no Portal está desativada.");
            return;
        }
        setViewId(null);
        setViewMetaRow(null);
        setEditId(null);
        setResubmit(false);
        setCopySourceId(null);
        setFormInitialData(null);
        if (prefersMobileForm) {
            router.push("/gestao/solicitacoes/nova");
            return;
        }
        bumpFormNonce();
        setFormOpen(true);
    }

    function openEdit(row: SolicitacaoGridRow) {
        if (requisicoesVagaOrigemRm) {
            toast.info("Este tenant recebe requisições aprovadas do RM. Edição no Portal está desativada.");
            return;
        }
        setViewId(null);
        setViewMetaRow(null);
        setEditId(row.id);
        setResubmit(false);
        setCopySourceId(null);
        if (prefersMobileForm) {
            router.push(`/gestao/solicitacoes/editar?id=${encodeURIComponent(row.id)}`);
            return;
        }
        bumpFormNonce();
        setFormOpen(true);
    }

    function openEditForApproval(row: SolicitacaoGridRow) {
        if (requisicoesVagaOrigemRm) {
            toast.info("Este tenant recebe requisições aprovadas do RM. Reenvio no Portal está desativado.");
            return;
        }
        setViewId(null);
        setViewMetaRow(null);
        setEditId(row.id);
        setResubmit(true);
        setCopySourceId(null);
        if (prefersMobileForm) {
            router.push(`/gestao/solicitacoes/editar?id=${encodeURIComponent(row.id)}&resubmit=1`);
            return;
        }
        bumpFormNonce();
        setFormOpen(true);
    }

    function openView(row: SolicitacaoGridRow) {
        setViewMetaRow(row);
        setViewId(row.id);
        setEditId(null);
        setResubmit(false);
        setCopySourceId(null);
        setFormInitialData(null);
        setDetailAnalistaRh({
            userId: row.analistaRhResponsavelUserId ?? null,
            nome: row.analistaRhResponsavelNome ?? null,
        });
        if (prefersMobileForm) {
            bumpFormNonce();
            setFormOpen(true);
            return;
        }
        bumpFormNonce();
        setFormOpen(true);
    }

    async function openTimeline(row: SolicitacaoGridRow) {
        setTimelineOpen(true);
        setTimelineLoading(true);
        setTimelineSteps([]);
        setTimelineStatus(null);
        try {
            const d = await fetchJson<SolicitacaoDetail>(`${API}/${row.id}`);
            setTimelineStatus(d.status);
            if (d.timelineEventos?.length) {
                setTimelineSteps(mapTimelineEventosToSteps(d.timelineEventos));
                return;
            }

            const etapas: EtapaAprovacaoResponse[] = d.etapasFluxo?.length
                ? d.etapasFluxo.map(e => ({
                    ordem: e.ordem,
                    label: e.label,
                    aprovadorId: null,
                    aprovadorNome: e.aprovadorNome,
                    roleFilaId: null,
                    roleFilaNome: e.roleNome,
                    status: normalizeEtapaStatus(e.status),
                    dataUtc: e.dataUtc,
                    observacao: e.observacao,
                }))
                : (d.etapas ?? []);
            setTimelineSteps(mapEtapasToSteps(etapas, d.solicitanteNome, d.createdAtUtc));
        } catch {
            toast.error("Falha ao carregar acompanhamento.");
            setTimelineOpen(false);
        } finally {
            setTimelineLoading(false);
        }
    }

    function toggleSolicitacaoSelection(id: string, checked: boolean) {
        setSelectedSolicitacaoIds((prev) => {
            if (checked) return prev.includes(id) ? prev : [...prev, id];
            return prev.filter((item) => item !== id);
        });
    }

    async function distribuirSolicitacoesSelecionadas() {
        if (selectedSolicitacaoIds.length === 0) {
            toast.error("Selecione ao menos uma solicitação.");
            return;
        }
        if (!bulkAnalistaRh.userId) {
            await showAnalistaRhObrigatoriaAlert();
            return;
        }

        setBulkAssigning(true);
        try {
            await fetchJson(`${API}/distribuicao/analista-rh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    solicitacaoIds: selectedSolicitacaoIds,
                    analistaRhResponsavelUserId: bulkAnalistaRh.userId,
                }),
            });
            toast.success("Solicitações distribuídas com sucesso.");
            setBulkAssignOpen(false);
            setSelectedSolicitacaoIds([]);
            await syncList();
        } catch (e) {
            toast.error(`Falha ao distribuir: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setBulkAssigning(false);
        }
    }

    async function distribuirSolicitacaoDoModal() {
        const id = viewId;
        if (!id) return;
        if (!detailAnalistaRh.userId) {
            await showAnalistaRhObrigatoriaAlert();
            return;
        }

        setDetailAssigning(true);
        try {
            const updated = await fetchJson<SolicitacaoDetail>(`${API}/${id}/analista-rh`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    analistaRhResponsavelUserId: detailAnalistaRh.userId,
                }),
            });
            setDetailAnalistaRh({
                userId: updated.analistaRhResponsavelUserId ?? null,
                nome: updated.analistaRhResponsavelNome ?? null,
            });
            setViewMetaRow((prev) => (prev && prev.id === id
                ? {
                    ...prev,
                    analistaRhResponsavelUserId: updated.analistaRhResponsavelUserId ?? null,
                    analistaRhResponsavelNome: updated.analistaRhResponsavelNome ?? null,
                }
                : prev));
            toast.success("Solicitação distribuída com sucesso.");
            await syncList();
        } catch (e) {
            toast.error(`Falha ao distribuir: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setDetailAssigning(false);
        }
    }

    async function cancelSolicitacao(id: string) {
        if (!(await confirmDialog({ title: "Cancelar solicitação", description: "Tem certeza que deseja cancelar esta solicitação? Esta ação não pode ser desfeita.", confirmText: "Cancelar solicitação", destructive: true }))) return;
        try {
            await fetchJson(`${API}/${id}/cancel`, { method: "POST" });
            toast.success("Solicitação cancelada.");
            await syncList();
            handleFormClose();
        } catch (e) {
            toast.error(`Falha ao cancelar: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function submitForApproval(id: string) {
        if (requisicoesVagaOrigemRm) {
            toast.info("Este tenant recebe requisições aprovadas do RM. Envio para aprovação no Portal está desativado.");
            return;
        }
        try {
            await fetchJson(`${API}/${id}/submit`, { method: "POST" });
            toast.success("Solicitação enviada para aprovação!");
            await syncList();
            handleFormClose();
        } catch (e) {
            toast.error(`Falha ao enviar: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function doApproval(id: string, action: "approve" | "reject" | "request-changes") {
        if (requisicoesVagaOrigemRm) {
            toast.info("Este tenant recebe requisições aprovadas do RM. Aprovação no Portal está desativada.");
            return;
        }
        const labels = { approve: "Aprovada", reject: "Reprovada", "request-changes": "Ajustes solicitados" };
        try {
            await fetchJson(`${API}/${id}/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ observacao: approvalObs || null }),
            });
            toast.success(`Solicitação: ${labels[action]}!`);
            await syncList();
            setApprovalObs("");
            handleFormClose();
            if (action === "approve") {
            }
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            await fetchJson(`${API}/${deleteTarget.id}`, { method: "DELETE" });
            toast.success("Solicitação excluída.");
            setDeleteTarget(null);
            await syncList();
        } catch (e) {
            toast.error(`Falha ao excluir: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    function handleFormClose() {
        setFormOpen(false);
        setViewId(null);
        setViewMetaRow(null);
        setResubmit(false);
        setCopySourceId(null);
        setFormInitialData(null);
    }

    function handleFormSaved() {
        setFormOpen(false);
        setViewId(null);
        setViewMetaRow(null);
        setResubmit(false);
        setFormInitialData(null);
        setCopySourceId(null);
        syncList().catch(() => { });
    }

    /* ──────────────────────────── render ──────────────────────────── */
    return (
        <div className="space-y-4">
            {!requisicoesVagaOrigemRm && (
                <div className="flex flex-wrap items-center gap-3">
                    <Button
                        size="sm"
                        data-testid="btn-nova-posicao"
                        onClick={() => openNovaPosicao()}
                    >
                        <Plus className="size-4 mr-1" />
                        Nova posição
                    </Button>
                </div>
            )}

            {/* Ao aprovar, troca direto para aba triagem */}

            {/* ── filters + table ── */}
            <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
                {/* ── Header + filtros ── */}
                <div className="mb-3 space-y-3">
                    {/* linha 1: filtros + busca + ações */}
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        {(() => {
                            const chips = [
                                { key: "ativas",     label: "Ativas",      count: contagens.ativas,     cls: "bg-amber-500/10 text-amber-700 border-amber-300 data-[active=true]:bg-amber-500 data-[active=true]:text-white data-[active=true]:border-amber-500" },
                                { key: "aprovadas",  label: "Aprovadas",   count: contagens.aprovadas,  cls: "bg-emerald-500/10 text-emerald-700 border-emerald-300 data-[active=true]:bg-emerald-600 data-[active=true]:text-white data-[active=true]:border-emerald-600" },
                                { key: "reprovadas", label: "Reprovadas",  count: contagens.reprovadas, cls: "bg-red-500/10 text-red-700 border-red-300 data-[active=true]:bg-red-600 data-[active=true]:text-white data-[active=true]:border-red-600" },
                                { key: "canceladas", label: "Canceladas",  count: contagens.canceladas, cls: "bg-zinc-500/10 text-zinc-600 border-zinc-300 data-[active=true]:bg-zinc-600 data-[active=true]:text-white data-[active=true]:border-zinc-600" },
                                { key: "todas",      label: "Todas",       count: contagens.todas,      cls: "bg-muted text-muted-foreground border-border data-[active=true]:bg-foreground data-[active=true]:text-background data-[active=true]:border-foreground" },
                            ] as const;
                            return (
                                <div className="flex flex-wrap justify-end gap-1.5">
                                    {chips.map(c => (
                                        <button
                                            key={c.key}
                                            type="button"
                                            data-active={statusFilter === c.key}
                                            onClick={() => setStatusFilter(c.key)}
                                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-medium transition-all ${c.cls}`}
                                        >
                                            {c.label}
                                            <span className="rounded-full bg-black/10 px-1.5 py-px text-[10px] font-semibold tabular-nums">{c.count}</span>
                                        </button>
                                    ))}
                                </div>
                            );
                        })()}
                        <div className="flex items-center gap-2">
                            <div className="relative min-w-[200px]">
                                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    className="pl-9 h-8"
                                    placeholder="Buscar código RM, título, área…"
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center rounded-md border border-input bg-background p-0.5">
                                <button type="button" className={`inline-flex items-center justify-center rounded-sm px-2 py-1 text-xs transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setViewMode("list")} title="Lista"><List className="size-3.5" /></button>
                                <button type="button" className={`inline-flex items-center justify-center rounded-sm px-2 py-1 text-xs transition-colors ${viewMode === "kanban" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setViewMode("kanban")} title="Kanban"><Columns3 className="size-3.5" /></button>
                            </div>
                        </div>
                        {canDistribuirParaAnalistaRh && (
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={selectedSolicitacaoIds.length === 0}
                                onClick={() => setBulkAssignOpen(true)}
                            >
                                Distribuir para Analista de RH
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setLoading(true);
                                syncList()
                                    .catch(() => toast.error("Falha ao atualizar."))
                                    .finally(() => setLoading(false));
                            }}
                        >
                            <RefreshCw className="size-4" />
                            <span className="hidden sm:inline">Atualizar</span>
                        </Button>
                    </div>
                </div>

                {viewMode === "list" ? (
                <>
                <Table>
                    <TableHeader>
                        <TableRow>
                            {canDistribuirParaAnalistaRh && (
                                <TableHead className="w-10">
                                    <input
                                        type="checkbox"
                                        aria-label="Selecionar solicitações distribuíveis"
                                        checked={allDistribuiveisSelecionados}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedSolicitacaoIds((prev) => Array.from(new Set([
                                                    ...prev,
                                                    ...filteredDistribuiveis.map((row) => row.id),
                                                ])));
                                            } else {
                                                setSelectedSolicitacaoIds((prev) =>
                                                    prev.filter((id) => !filteredDistribuiveis.some((row) => row.id === id)));
                                            }
                                        }}
                                    />
                                </TableHead>
                            )}
                            <TableHead className="w-28 cursor-pointer select-none text-center" onClick={() => handleSort("codigoRm")}>
                                Código RM<SortIcon col="codigoRm" />
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort("titulo")}>
                                Título<SortIcon col="titulo" />
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => handleSort("secao")}>
                                Seção<SortIcon col="secao" />
                            </TableHead>
                            <TableHead className="w-1 whitespace-nowrap text-center cursor-pointer select-none" onClick={() => handleSort("tipo")}>
                                Tipo<SortIcon col="tipo" />
                            </TableHead>
                            <TableHead className="w-1 whitespace-nowrap text-center cursor-pointer select-none" onClick={() => handleSort("posicoes")}>
                                Posições<SortIcon col="posicoes" />
                            </TableHead>
                            <TableHead className="w-1 whitespace-nowrap text-center cursor-pointer select-none" onClick={() => handleSort("status")}>
                                Status<SortIcon col="status" />
                            </TableHead>
                            <TableHead className="w-1 whitespace-nowrap text-center cursor-pointer select-none" onClick={() => handleSort("aguardando")}>
                                Aguardando<SortIcon col="aguardando" />
                            </TableHead>
                            <TableHead className="w-1 whitespace-nowrap text-center cursor-pointer select-none" onClick={() => handleSort("data")}>
                                Data<SortIcon col="data" />
                            </TableHead>
                            <TableHead className="w-1 whitespace-nowrap text-center cursor-pointer select-none" onClick={() => handleSort("abertoHa")}>
                                Aberto há<SortIcon col="abertoHa" />
                            </TableHead>
                            <TableHead className="w-1 whitespace-nowrap text-left cursor-pointer select-none" onClick={() => handleSort("requisitante")}>
                                Requisitante<SortIcon col="requisitante" />
                            </TableHead>
                            <TableHead className="w-1 whitespace-nowrap text-center">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={canDistribuirParaAnalistaRh ? 12 : 11} className="text-center text-muted-foreground py-8">
                                    Carregando…
                                </TableCell>
                            </TableRow>
                        ) : pagedRows.length ? (
                            pagedRows.map((r) => (
                                <TableRow
                                    key={r.id}
                                    className="cursor-pointer hover:bg-muted/40"
                                    onClick={() => openView(r)}
                                >
                                    {canDistribuirParaAnalistaRh && (
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                aria-label={`Selecionar ${r.titulo}`}
                                                checked={selectedSolicitacaoIds.includes(r.id)}
                                                disabled={!isStatusDistribuivelParaAnalistaRh(r.status)}
                                                onChange={(e) => toggleSolicitacaoSelection(r.id, e.target.checked)}
                                            />
                                        </TableCell>
                                    )}
                                    <TableCell className="whitespace-nowrap text-center font-mono text-xs text-muted-foreground">
                                        {solicitacaoCodigoRm(r) || "—"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-semibold" title={r.titulo}>{truncateTitle(r.titulo)}</span>
                                            {r.isConfidencial && (
                                                <span title="Vaga Confidencial"><Lock className="size-3.5 text-amber-600" /></span>
                                            )}
                                        </div>
                                        {r.substituidoNome && (
                                            <div className="text-muted-foreground text-xs flex items-center gap-1">
                                                <UserMinus className="size-3" /> Substituindo: {r.substituidoNome}
                                            </div>
                                        )}
                                        {r.analistaRhResponsavelNome && (
                                            <div className="text-muted-foreground text-xs">
                                                Distribuída para: <span className="font-medium text-foreground">{r.analistaRhResponsavelNome}</span>
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="max-w-[180px] truncate text-xs text-muted-foreground" title={r.centroCustoNome ?? ""}>
                                            {r.centroCustoNome ?? "—"}
                                        </div>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-center">
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tipoSolicitacaoBadgeClass(Number(r.tipoSolicitacao), r.rmTipoRequisicao)}`}>
                                            {formatTipoSolicitacaoLabel(Number(r.tipoSolicitacao), r.rmTipoRequisicao)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-center text-sm font-mono">{r.qtdPosicoes}</TableCell>
                                    <TableCell className="whitespace-nowrap text-center">{statusBadge(r.status)}</TableCell>
                                    <TableCell className="whitespace-nowrap text-center">
                                        {(r.status === 1 || r.status === "PendenteAprovacao" || r.status === 5 || r.status === "PendenteAprovacaoRh") && r.etapaPendenteLabel ? (
                                            <div className="text-xs leading-tight">
                                                <div className="text-muted-foreground">{r.etapaPendenteLabel}</div>
                                                {r.etapaPendenteCom && (
                                                    <div className="font-medium truncate max-w-[140px]" title={r.etapaPendenteCom}>{r.etapaPendenteCom}</div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-center">
                                        <span className="text-xs font-medium text-foreground">{formatDate(r.createdAtUtc)}</span>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-center">
                                        <span className="text-xs text-muted-foreground">{formatOpenDays(r.createdAtUtc)}</span>
                                    </TableCell>
                                    <TableCell className="text-left">
                                        <div className="max-w-[180px] truncate text-xs text-muted-foreground" title={r.solicitanteNome ?? ""}>
                                            {r.solicitanteNome ?? "—"}
                                        </div>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-center">
                                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                                            {isExternoAoSolicitanteLista(r) ? (
                                                <>
                                                    <Button variant="outline" size="icon-xs" title="Visualizar" onClick={() => openView(r)}>
                                                        <Eye />
                                                    </Button>
                                                    <Button variant="outline" size="icon-xs" title="Acompanhamento" onClick={() => void openTimeline(r)}>
                                                        <Activity />
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    {/* Rascunho: editar, enviar, excluir */}
                                                    {!requisicoesVagaOrigemRm && (r.status === 0 || r.status === "Rascunho") && (
                                                        <>
                                                            <Button variant="outline" size="icon-xs" title="Editar" onClick={() => openEdit(r)}>
                                                                <Pencil />
                                                            </Button>
                                                            <Button variant="outline" size="icon-xs" title="Enviar para aprovação" onClick={() => void submitForApproval(r.id)}>
                                                                <Send />
                                                            </Button>
                                                            <Button variant="destructive" size="icon-xs" title="Excluir" onClick={() => setDeleteTarget(r)}>
                                                                <Trash2 />
                                                            </Button>
                                                        </>
                                                    )}
                                                    {/* AjustesNecessarios: editar, enviar */}
                                                    {!requisicoesVagaOrigemRm && (r.status === 4 || r.status === "AjustesNecessarios") && (
                                                        <>
                                                            <Button variant="outline" size="icon-xs" title="Editar" onClick={() => openEdit(r)}>
                                                                <Pencil />
                                                            </Button>
                                                            <Button variant="outline" size="icon-xs" title="Enviar para aprovação" onClick={() => void submitForApproval(r.id)}>
                                                                <Send />
                                                            </Button>
                                                        </>
                                                    )}
                                                    {/* Pendente: editar e reenviar + cancelar */}
                                                    {!requisicoesVagaOrigemRm && (r.status === 1 || r.status === "PendenteAprovacao") && (
                                                        <>
                                                            <Button variant="outline" size="icon-xs" title="Editar e reenviar" onClick={() => openEditForApproval(r)}>
                                                                <Pencil />
                                                            </Button>
                                                            <Button variant="outline" size="icon-xs" title="Cancelar solicitação" className="hover:text-red-600 hover:border-red-300" onClick={() => void cancelSolicitacao(r.id)}>
                                                                <Ban />
                                                            </Button>
                                                        </>
                                                    )}
                                                    {/* Aprovada/Reprovada: apenas visualizar */}
                                                    {(requisicoesVagaOrigemRm ||
                                                      r.status === 2 || r.status === "Aprovada" ||
                                                      r.status === 3 || r.status === "Reprovada") && (
                                                        <Button variant="outline" size="icon-xs" title="Visualizar" onClick={() => openView(r)}>
                                                            <Eye />
                                                        </Button>
                                                    )}
                                                    {/* AguardaRH / AguardaHC: visualizar + cancelar se sem movimentação */}
                                                    {!requisicoesVagaOrigemRm && (r.status === 5 || r.status === "PendenteAprovacaoRh" ||
                                                      r.status === 10 || r.status === "PendenteAprovacaoAumentoHC") && (
                                                        <>
                                                            <Button variant="outline" size="icon-xs" title="Visualizar" onClick={() => openView(r)}>
                                                                <Eye />
                                                            </Button>
                                                            <Button variant="outline" size="icon-xs" title="Cancelar solicitação" className="hover:text-red-600 hover:border-red-300" onClick={() => void cancelSolicitacao(r.id)}>
                                                                <Ban />
                                                            </Button>
                                                        </>
                                                    )}
                                                    {/* Copiar: todas as linhas */}
                                                    {!requisicoesVagaOrigemRm && (
                                                        <Button
                                                            variant="outline"
                                                            size="icon-xs"
                                                            title="Copiar vaga"
                                                            onClick={() => {
                                                                setCopySourceId(r.id);
                                                                setEditId(null);
                                                                setViewId(null);
                                                                setViewMetaRow(null);
                                                                setResubmit(false);
                                                                setFormInitialData(null);
                                                                if (prefersMobileForm) {
                                                                    router.push(`/gestao/solicitacoes/nova?copyFrom=${encodeURIComponent(r.id)}`);
                                                                    return;
                                                                }
                                                                bumpFormNonce();
                                                                setFormOpen(true);
                                                            }}
                                                        >
                                                            <Copy className="size-3.5" />
                                                        </Button>
                                                    )}
                                                    {/* Acompanhamento: todas as linhas */}
                                                    <Button variant="outline" size="icon-xs" title="Acompanhamento" onClick={() => void openTimeline(r)}>
                                                        <Activity />
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={canDistribuirParaAnalistaRh ? 12 : 11} className="text-center text-muted-foreground py-8">
                                    {statusFilter === "ativas"
                                        ? "Nenhuma solicitação ativa. Tudo em dia! 🎉"
                                        : "Nenhuma solicitação encontrada para o filtro selecionado."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                {filtered.length > 0 && (
                    <PaginationBar
                        page={page}
                        pageSize={pageSize}
                        totalItems={filtered.length}
                        itemLabel="solicitação(ões)"
                        onPageChange={setPage}
                        onPageSizeChange={(nextPageSize) => {
                            setPageSize(nextPageSize);
                            setPage(1);
                        }}
                    />
                )}
                </>
                ) : (
                    /* ── Kanban View ── */
                    <div className="p-4 overflow-x-auto">
                        {loading ? (
                            <div className="flex gap-4">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="w-64 shrink-0 space-y-3">
                                        <div className="h-8 animate-pulse rounded-lg bg-muted" />
                                        <div className="h-20 animate-pulse rounded-lg bg-muted" />
                                        <div className="h-20 animate-pulse rounded-lg bg-muted" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex gap-4 items-start">
                                {(["Rascunho", "PendenteAprovacao", "Aprovada", "Reprovada"] as const).map((col) => {
                                    const meta = KANBAN_COL_META[col];
                                    const Icon = meta.icon;
                                    const colItems = filtered.filter((r) => rowStatusMatchesKanbanCol(r, col));
                                    return (
                                        <div key={col} className="w-64 shrink-0 flex flex-col rounded-xl border border-border/50 bg-muted/10">
                                            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/40">
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.color}`}>
                                                    <Icon className="size-3" />{meta.label}
                                                </span>
                                                <span className="text-xs text-muted-foreground ml-auto">{colItems.length}</span>
                                            </div>
                                            <div className="flex-1 space-y-2 p-2 max-h-[calc(100vh-340px)] overflow-y-auto">
                                                {colItems.length === 0 ? (
                                                    <div className="rounded-lg border border-dashed border-border/40 py-8 text-center text-xs text-muted-foreground">
                                                        Nenhuma
                                                    </div>
                                                ) : colItems.map((r) => (
                                                    <div
                                                        key={r.id}
                                                        className="rounded-lg border border-border/50 bg-card p-3 shadow-sm"
                                                    >
                                                        <div className="text-sm font-medium leading-tight truncate">{r.titulo}</div>
                                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                                            <span>{r.qtdPosicoes} pos.</span>
                                                            <span>{urgenciaBadge(r.urgencia)}</span>
                                                        </div>
                                                        <div className="mt-2 text-[10px] text-muted-foreground">
                                                            {formatDate(r.createdAtUtc)}
                                                            {r.solicitanteNome && <> · {r.solicitanteNome}</>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Form Modal ── */}
            <SolicitacaoFormModal
                open={formOpen}
                editId={viewId ?? editId}
                initialData={formInitialData}
                onClose={handleFormClose}
                onSaved={handleFormSaved}
                viewOnly={!!viewId}
                resubmitAfterSave={resubmit}
                copySourceId={copySourceId}
                reloadNonce={formReloadNonce}
                footerExtra={
                    formOpen && viewId && viewMetaRow ? (
                        <>
                            {canDistribuirParaAnalistaRh && isStatusDistribuivelParaAnalistaRh(viewMetaRow.status) && (
                                <div className="space-y-3 rounded-lg border border-border/60 p-3">
                                    <div className="text-sm font-semibold">Distribuir para Analista de RH</div>
                                    <RhAnalistaAutocomplete
                                        value={detailAnalistaRh.userId}
                                        onChange={(userId, displayName) => setDetailAnalistaRh({ userId, nome: displayName })}
                                        defaultLabel={detailAnalistaRh.nome ? { name: detailAnalistaRh.nome } : undefined}
                                        disabled={detailAssigning}
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="outline" disabled={detailAssigning} onClick={handleFormClose}>
                                            Fechar
                                        </Button>
                                        <Button
                                            size="sm"
                                            disabled={detailAssigning}
                                            onClick={() => void distribuirSolicitacaoDoModal()}
                                        >
                                            Distribuir
                                        </Button>
                                    </div>
                                </div>
                            )}
                            {!requisicoesVagaOrigemRm && (viewMetaRow.status === 1 || viewMetaRow.status === "PendenteAprovacao") && isAdmin && (
                                <div className="mt-3 space-y-3 rounded-lg border border-border/60 p-3">
                                    <div className="text-sm font-semibold">Ações de aprovação (admin)</div>
                                    <textarea
                                        className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground"
                                        rows={2}
                                        placeholder="Observação (opcional)..."
                                        value={approvalObs}
                                        onChange={(e) => setApprovalObs(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <Button size="sm" className="btn-approve" onClick={() => void doApproval(viewId, "approve")}>
                                            <CheckCircle2 className="size-4" /> Aprovar
                                        </Button>
                                        <Button size="sm" className="btn-reject" onClick={() => void doApproval(viewId, "reject")}>
                                            <XCircle className="size-4" /> Reprovar
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null
                }
            />

            {/* ── Timeline Modal ── */}
            <AcompanhamentoModal
                open={timelineOpen}
                loading={timelineLoading}
                steps={timelineSteps}
                solicitacaoStatus={timelineStatus}
                onClose={() => setTimelineOpen(false)}
            />

            <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Distribuir solicitações</DialogTitle>
                        <DialogDescription>
                            Direcione {selectedSolicitacaoIds.length} solicitação(ões) para um Analista de RH.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <RhAnalistaAutocomplete
                            value={bulkAnalistaRh.userId}
                            onChange={(userId, displayName) => setBulkAnalistaRh({ userId, nome: displayName })}
                            defaultLabel={bulkAnalistaRh.nome ? { name: bulkAnalistaRh.nome } : undefined}
                            disabled={bulkAssigning}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            disabled={bulkAssigning}
                            onClick={() => setBulkAnalistaRh({ userId: null, nome: null })}
                        >
                            Limpar
                        </Button>
                        <Button
                            disabled={bulkAssigning || selectedSolicitacaoIds.length === 0}
                            onClick={() => void distribuirSolicitacoesSelecionadas()}
                        >
                            Distribuir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirm ── */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Confirmar exclusão</DialogTitle>
                        <DialogDescription>
                            Excluir a solicitação <strong>&quot;{deleteTarget?.titulo}&quot;</strong>? Esta ação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={() => void confirmDelete()}>
                            Excluir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
