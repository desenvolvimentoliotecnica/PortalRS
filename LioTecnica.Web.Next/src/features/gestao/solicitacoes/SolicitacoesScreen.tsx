"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMobileSolicitacaoFormPreferred } from "@/hooks/useMobileSolicitacaoFormPreferred";
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
    CheckCircle2,
    XCircle,
    AlertTriangle,
    CalendarDays,
    Lock,
    UserMinus,
    Activity,
    Ban,
    Copy,
    MoreHorizontal,
    Plus,
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    UserRound,
} from "lucide-react";
import { VAGAS_FONT_135X_CLASS, VAGAS_FONT_135X_STYLE } from "@/styles/vagasFont135x";
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RhAnalistaAutocomplete } from "@/components/autocomplete/RhAnalistaAutocomplete";

import SolicitacaoFormModal, { type SolicitacaoDraft } from "./SolicitacaoFormModal";
import AcompanhamentoModal, { AprovacaoStep } from "@/features/gestao/shared/AcompanhamentoModal";
import NextStepBanner from "@/components/feedback/NextStepBanner";
import {
    mapEtapasToSteps,
    mapTimelineEventosToSteps,
    mapRmPareceresToSteps,
    normalizeEtapaStatus,
    type EtapaAprovacaoResponse,
    type SolicitacaoTimelineEventoResponse,
    type RmParecerResponse,
} from "@/features/gestao/shared/etapaUtils";
import PaginationBar from "@/components/pagination/PaginationBar";
import {
    formatSolicitacaoCodigoRm,
    formatTipoSolicitacaoLabel,
    rowMatchesTipoSolicitacaoFilter,
    tipoSolicitacaoBadgeClass,
    type TipoSolicitacaoFilter,
} from "@/features/gestao/solicitacoes/rmRequisicaoFormat";
import { SolicitacaoBacklogStatusBadgeEl } from "@/features/gestao/shared/solicitacaoVagaStatusUi";

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

function detailToGridRow(d: SolicitacaoDetail): SolicitacaoGridRow {
    return {
        id: d.id,
        titulo: d.titulo,
        urgencia: d.urgencia,
        status: d.status,
        solicitanteId: d.solicitanteId,
        solicitanteNome: d.solicitanteNome,
        aprovadorId: d.aprovadorId,
        aprovadorNome: d.aprovadorNome,
        analistaRhResponsavelUserId: d.analistaRhResponsavelUserId ?? null,
        analistaRhResponsavelNome: d.analistaRhResponsavelNome ?? null,
        centroCustoNome: d.centroCustoNome,
        qtdPosicoes: d.qtdPosicoes,
        tipoSolicitacao: d.tipoSolicitacao,
        isConfidencial: d.isConfidencial,
        substituidoNome: d.substituidoNome,
        createdAtUtc: d.createdAtUtc,
        etapaPendenteLabel: null,
        etapaPendenteCom: null,
        rmRequisicaoCodigo: d.rmRequisicaoCodigo ?? null,
    };
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
    rmPareceres?: RmParecerResponse[];
    rmCodStatus?: number | string | null;
    rmUltimaStatusDescricaoRm?: string | null;
    rmStatusSyncUltimaMensagem?: string | null;
    rmUltimaSincronizacaoUtc?: string | null;
    rmRequisicaoCodigo?: string | null;
}

type StatusKey = 0 | 1 | 2 | 3 | 4 | string;
type UrgenciaKey = 0 | 1 | 2 | 3 | string;
type SolicitacaoSortKey = "codigoRm" | "titulo" | "secao" | "tipo" | "posicoes" | "urgencia" | "data" | "abertoHa" | "requisitante";

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

export default function SolicitacoesScreen() {
    return (
        <section className={`${VAGAS_FONT_135X_CLASS} space-y-4`}>
            <style>{VAGAS_FONT_135X_STYLE}</style>
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Solicitações</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                    Gerencie solicitações de vagas e substituições.
                </p>
            </div>
            <SolicitacoesVagaContent />
        </section>
    );
}

function SolicitacoesVagaContent() {
    const { me } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const viewFromUrlHandled = useRef(false);
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
        isRhAnalista
        || isRhEspecialista
        || isRhLegadoAmplo
        || canViewRhContratacoes
        || canTriagemRhContratacoes
        || canSelecaoRhContratacoes;
    const canDistribuirParaAnalistaRh = isAdminOrOwner || isRhEspecialista;

    /* ── data ── */
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<SolicitacaoGridRow[]>([]);
    const [pendingRows, setPendingRows] = useState<SolicitacaoGridRow[]>([]);
    const [selectedSolicitacaoIds, setSelectedSolicitacaoIds] = useState<string[]>([]);
    const [requisicoesVagaOrigemRm, setRequisicoesVagaOrigemRm] = useState(false);

    /* ── filters ── */
    const [q, setQ] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [tipoFilter, setTipoFilter] = useState<TipoSolicitacaoFilter>("todas");
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

        const [myData, allData] = await Promise.all([
            fetchJson<SolicitacaoGridRow[]>(`${API}?apenasMeus=true&pageSize=500`),
            fetchJson<SolicitacaoGridRow[]>(`${API}?pageSize=500`).catch(() => []),
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

    /* ── filtering ── */
    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        return rows.filter((r) => {
            if (dateFrom && r.createdAtUtc && new Date(r.createdAtUtc) < new Date(dateFrom)) return false;
            if (dateTo && r.createdAtUtc && new Date(r.createdAtUtc) > new Date(`${dateTo}T23:59:59`)) return false;
            if (!rowMatchesTipoSolicitacaoFilter(r, tipoFilter)) return false;
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
    }, [q, rows, dateFrom, dateTo, tipoFilter]);

    useEffect(() => {
        setPage(1);
    }, [q, dateFrom, dateTo, tipoFilter, pageSize]);

    const sorted = useMemo(() => {
        const getValue = (r: SolicitacaoGridRow): string | number => {
            if (sortKey === "codigoRm") return solicitacaoCodigoRm(r);
            if (sortKey === "titulo") return r.titulo ?? "";
            if (sortKey === "secao") return r.centroCustoNome ?? "";
            if (sortKey === "tipo") return String(r.tipoSolicitacao);
            if (sortKey === "posicoes") return r.qtdPosicoes ?? 0;
            if (sortKey === "urgencia") return String(r.urgencia);
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

    useEffect(() => {
        if (loading || viewFromUrlHandled.current) return;
        const viewIdParam = searchParams.get("view")?.trim();
        if (!viewIdParam) return;

        viewFromUrlHandled.current = true;

        void (async () => {
            const existing = rows.find((r) => r.id === viewIdParam);
            if (existing) {
                openView(existing);
            } else {
                try {
                    const detail = await fetchJson<SolicitacaoDetail>(`${API}/${encodeURIComponent(viewIdParam)}`);
                    openView(detailToGridRow(detail));
                } catch {
                    toast.error("Requisição não encontrada.");
                }
            }
            router.replace("/app/gestao/solicitacoes", { scroll: false });
        })();
    }, [loading, rows, searchParams, router]);

    function openCopyFromRow(row: SolicitacaoGridRow) {
        setCopySourceId(row.id);
        setEditId(null);
        setViewId(null);
        setViewMetaRow(null);
        setResubmit(false);
        setFormInitialData(null);
        if (prefersMobileForm) {
            router.push(`/gestao/solicitacoes/nova?copyFrom=${encodeURIComponent(row.id)}`);
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

            const rmPareceres = Array.isArray(d.rmPareceres) ? d.rmPareceres : [];
            if (rmPareceres.length > 0) {
                setTimelineSteps(mapRmPareceresToSteps(rmPareceres));
                return;
            }

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
            <div className="rounded-xl border border-border/40 bg-card shadow-sm">
                <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mr-auto">
                        <CalendarDays className="size-3.5" />
                        <span>Criado em:</span>
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" title="Data inicial" />
                        <span>–</span>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" title="Data final" />
                        {(dateFrom || dateTo) && (
                            <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-muted-foreground hover:text-foreground underline">Limpar</button>
                        )}
                    </div>
                    <select
                        value={tipoFilter}
                        onChange={(e) => setTipoFilter(e.target.value as TipoSolicitacaoFilter)}
                        className="rounded-md border border-input bg-background px-3 text-sm"
                        aria-label="Filtrar por tipo de requisição"
                    >
                        <option value="todas">Todas</option>
                        <option value="aumento_quadro">Aumento de Quadro</option>
                        <option value="substituicao">Substituição</option>
                    </select>
                    <div className="relative min-w-[180px] flex-1 max-w-sm">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="pl-8 h-8 text-sm"
                            placeholder="Buscar código RM, título, área…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
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
                            <TableHead className="w-1 whitespace-nowrap text-center cursor-pointer select-none" onClick={() => handleSort("data")}>
                                Data<SortIcon col="data" />
                            </TableHead>
                            <TableHead className="w-1 whitespace-nowrap text-center cursor-pointer select-none" onClick={() => handleSort("abertoHa")}>
                                Aberto há<SortIcon col="abertoHa" />
                            </TableHead>
                            <TableHead className="w-1 whitespace-nowrap text-left cursor-pointer select-none" onClick={() => handleSort("requisitante")}>
                                Requisitante<SortIcon col="requisitante" />
                            </TableHead>
                            <TableHead className="w-1 whitespace-nowrap text-center">Status</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={canDistribuirParaAnalistaRh ? 11 : 10} className="text-center text-muted-foreground py-8">
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
                                        <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                                            <span title={r.titulo}>{truncateTitle(r.titulo)}</span>
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
                                        <div className="max-w-[220px] truncate text-xs text-muted-foreground" title={r.centroCustoNome ?? ""}>
                                            {r.centroCustoNome ?? "—"}
                                        </div>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-center">
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tipoSolicitacaoBadgeClass(Number(r.tipoSolicitacao), r.rmTipoRequisicao)}`}>
                                            {formatTipoSolicitacaoLabel(Number(r.tipoSolicitacao), r.rmTipoRequisicao)}
                                        </span>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-center text-sm font-mono">{r.qtdPosicoes}</TableCell>
                                    <TableCell className="whitespace-nowrap text-center text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground">{formatDate(r.createdAtUtc)}</span>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-center text-xs text-muted-foreground">
                                        {formatOpenDays(r.createdAtUtc)}
                                    </TableCell>
                                    <TableCell className="text-left">
                                        <div className="max-w-[180px] truncate text-xs text-muted-foreground" title={r.solicitanteNome ?? ""}>
                                            {r.solicitanteNome ?? "—"}
                                        </div>
                                    </TableCell>
                                    <TableCell className="whitespace-nowrap text-center">
                                        <SolicitacaoBacklogStatusBadgeEl raw={r.status} />
                                    </TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="icon-sm">
                                                    <MoreHorizontal className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-52">
                                                {isExternoAoSolicitanteLista(r) ? (
                                                    <>
                                                        <DropdownMenuItem onClick={() => openView(r)}>
                                                            <Eye className="mr-2 size-4" />
                                                            Visualizar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => void openTimeline(r)}>
                                                            <Activity className="mr-2 size-4" />
                                                            Acompanhamento
                                                        </DropdownMenuItem>
                                                    </>
                                                ) : (
                                                    <>
                                                        {(requisicoesVagaOrigemRm
                                                            || r.status === 2 || r.status === "Aprovada"
                                                            || r.status === 3 || r.status === "Reprovada"
                                                            || r.status === 5 || r.status === "PendenteAprovacaoRh"
                                                            || r.status === 10 || r.status === "PendenteAprovacaoAumentoHC") && (
                                                            <DropdownMenuItem onClick={() => openView(r)}>
                                                                <Eye className="mr-2 size-4" />
                                                                Visualizar
                                                            </DropdownMenuItem>
                                                        )}
                                                        {!requisicoesVagaOrigemRm && (r.status === 0 || r.status === "Rascunho") && (
                                                            <>
                                                                <DropdownMenuItem onClick={() => openEdit(r)}>
                                                                    <Pencil className="mr-2 size-4" />
                                                                    Editar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => void submitForApproval(r.id)}>
                                                                    <Send className="mr-2 size-4" />
                                                                    Enviar para aprovação
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                        {!requisicoesVagaOrigemRm && (r.status === 4 || r.status === "AjustesNecessarios") && (
                                                            <>
                                                                <DropdownMenuItem onClick={() => openEdit(r)}>
                                                                    <Pencil className="mr-2 size-4" />
                                                                    Editar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => void submitForApproval(r.id)}>
                                                                    <Send className="mr-2 size-4" />
                                                                    Enviar para aprovação
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                        {!requisicoesVagaOrigemRm && (r.status === 1 || r.status === "PendenteAprovacao") && (
                                                            <DropdownMenuItem onClick={() => openEditForApproval(r)}>
                                                                <Pencil className="mr-2 size-4" />
                                                                Editar e reenviar
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem onClick={() => void openTimeline(r)}>
                                                            <Activity className="mr-2 size-4" />
                                                            Acompanhamento
                                                        </DropdownMenuItem>
                                                        {!requisicoesVagaOrigemRm && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => openCopyFromRow(r)}>
                                                                    <Copy className="mr-2 size-4" />
                                                                    Copiar vaga
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                        {!requisicoesVagaOrigemRm && (
                                                            (r.status === 1 || r.status === "PendenteAprovacao"
                                                                || r.status === 5 || r.status === "PendenteAprovacaoRh"
                                                                || r.status === 10 || r.status === "PendenteAprovacaoAumentoHC") && (
                                                                <>
                                                                    <DropdownMenuSeparator />
                                                                    <DropdownMenuItem
                                                                        className="text-orange-600 focus:text-orange-600"
                                                                        onClick={() => void cancelSolicitacao(r.id)}
                                                                    >
                                                                        <Ban className="mr-2 size-4" />
                                                                        Cancelar solicitação
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )
                                                        )}
                                                        {!requisicoesVagaOrigemRm && (r.status === 0 || r.status === "Rascunho") && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="text-destructive focus:text-destructive"
                                                                    onClick={() => setDeleteTarget(r)}
                                                                >
                                                                    <Trash2 className="mr-2 size-4" />
                                                                    Excluir
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={canDistribuirParaAnalistaRh ? 11 : 10} className="text-center text-muted-foreground py-8">
                                    Nenhuma solicitação encontrada para os filtros selecionados.
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
                                <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                                    <div className="flex items-start gap-3">
                                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                            <UserRound className="size-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-semibold">Distribuir para Analista de RH</div>
                                            <p className="text-xs text-muted-foreground">
                                                Selecione quem irá conduzir esta requisição
                                            </p>
                                        </div>
                                    </div>
                                    <RhAnalistaAutocomplete
                                        value={detailAnalistaRh.userId}
                                        onChange={(userId, displayName) => setDetailAnalistaRh({ userId, nome: displayName })}
                                        defaultLabel={detailAnalistaRh.nome ? { name: detailAnalistaRh.nome } : undefined}
                                        disabled={detailAssigning}
                                        placeholder="Buscar analista por nome ou e-mail…"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="outline" disabled={detailAssigning} onClick={handleFormClose}>
                                            Fechar
                                        </Button>
                                        <Button
                                            size="sm"
                                            disabled={detailAssigning || !detailAnalistaRh.userId}
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
                            listMaxHeightClassName="max-h-56"
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
