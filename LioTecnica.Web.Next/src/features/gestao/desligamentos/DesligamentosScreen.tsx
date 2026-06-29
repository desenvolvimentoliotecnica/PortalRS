"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth, useHasPermission } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
    Search,
    Plus,
    RefreshCw,
    Eye,
    Pencil,
    Trash2,
    Send,
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    FileText,
    Users,
    Activity,
    Download,
    UserCheck,
    Ban,
    Copy,
    MoreHorizontal,
    Zap,
    Loader2,
    CalendarDays,
    MessageSquare,
    Filter,
} from "lucide-react";
import { AGING_BUCKETS, type AgingBucket, matchesAgingBucket } from "@/features/shared/urgencia";
import { apiFetch, gerarCartaDownload } from "@/lib/api";

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

import DesligamentoFormModal from "./DesligamentoFormModal";
import AcompanhamentoModal, { AprovacaoStep } from "@/features/gestao/shared/AcompanhamentoModal";
import { mapEtapasToSteps, type EtapaAprovacaoResponse } from "@/features/gestao/shared/etapaUtils";
import { confirmDialog } from "@/lib/confirm-dialog";
import {
    ENTREVISTA_STATUS_COLORS,
    ENTREVISTA_STATUS_LABELS,
    enviarEntrevistaSaida,
    formatRespostaValor,
    getEntrevistaSaidaDetalhe,
    normalizeEntrevistaStatus,
    reenviarEntrevistaSaida,
    type EntrevistaSaidaDetalhe,
    type EntrevistaSaidaStatusCode,
} from "./entrevistaSaidaApi";

/* ──────────────────────────── types ──────────────────────────── */

interface SolicitacaoDesligamentoGridRow {
    id: string;
    status: number;
    solicitanteNome: string | null;
    funcionarioNome: string | null;
    cargoAtualNome?: string | null;
    rmIdReq?: number | null;
    tipoDesligamento: number;
    dataDesligamento: string | null;
    createdAtUtc: string;
    etapaPendenteLabel: string | null;
    etapaPendenteCom: string | null;
    etapaPendenteIsQueue?: boolean;
    etapaPendenteCanAssume?: boolean;
    etapaPendenteCanApprove?: boolean;
    entrevistaSaidaStatus?: EntrevistaSaidaStatusCode | string | null;
    entrevistaSaidaEnviadaEmUtc?: string | null;
    entrevistaSaidaRespondidaEmUtc?: string | null;
}

interface SolicitacaoDesligamentoResponse {
    id: string;
    status: number;
    solicitanteNome: string | null;
    funcionarioNome: string | null;
    dataDesligamento: string | null;
    tipoDesligamento: number;
    motivoDesligamento: string | null;
    tipoAvisoPrevio: number;
    diasAvisoPrevio: number;
    elegivelRecontratacao: boolean;
    substituirPosicao: boolean;
    observacaoAprovador: string | null;
    observacoes: string | null;
    createdAtUtc: string;
    approvedAtUtc: string | null;
    etapas?: EtapaAprovacaoResponse[];
}

type StatusKey = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/* ──────────────────────────── helpers ──────────────────────────── */

const API = "/api/solicitacoes-desligamento";

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

const STATUS_MAP: Record<StatusKey, { label: string; color: string; icon: React.ElementType }> = {
    0: { label: "Rascunho",       color: "bg-zinc-400/15 text-zinc-600",   icon: FileText },
    1: { label: "Pendente",       color: "bg-amber-500/15 text-amber-700", icon: Clock },
    2: { label: "Aprovada",       color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    3: { label: "Reprovada",      color: "bg-red-500/15 text-red-700",     icon: XCircle },
    4: { label: "Ajustes",        color: "bg-orange-500/15 text-orange-700", icon: AlertTriangle },
    5: { label: "Cancelada",      color: "bg-zinc-500/15 text-zinc-500",   icon: XCircle },
    6: { label: "Aguarda Fila",   color: "bg-violet-500/15 text-violet-700", icon: Users },
    7: { label: "Em Integração",  color: "bg-blue-500/15 text-blue-700",   icon: Loader2 },
    8: { label: "Concluída",      color: "bg-teal-500/15 text-teal-700",   icon: CheckCircle2 },
};

const ETAPA_STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    pendente: { label: "Pendente", color: "bg-amber-500/15 text-amber-700", icon: Clock },
    aprovado: { label: "Aprovado", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    reprovado: { label: "Reprovado", color: "bg-red-500/15 text-red-700", icon: XCircle },
};

const TIPO_DESLIGAMENTO_MAP: Record<number, string> = {
    0: "Sem Justa Causa",
    1: "Pedido de Demissão",
    2: "Acordo Mútuo",
    3: "Justa Causa",
    4: "Fim de Contrato",
};

const TIPO_AVISO_PREVIO_MAP: Record<number, string> = {
    0: "Indenizado",
    1: "Trabalhado",
    2: "Dispensado",
};

function statusBadge(status: number) {
    const s = STATUS_MAP[(status ?? 0) as StatusKey] ?? STATUS_MAP[1];
    const Icon = s.icon;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.color}`}>
            <Icon className="size-3" />
            {s.label}
        </span>
    );
}

function etapaStatusBadge(status: string) {
    const key = (status ?? "pendente").toLowerCase();
    const s = ETAPA_STATUS_MAP[key] ?? ETAPA_STATUS_MAP.pendente;
    const Icon = s.icon;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.color}`}>
            <Icon className="size-3" />
            {s.label}
        </span>
    );
}

// API serializes SolicitacaoStatus enum as strings (JsonStringEnumConverter).
// Normalize to number once at load time so all status comparisons work correctly.
const STATUS_STR_TO_NUM: Record<string, number> = {
    Rascunho: 0, PendenteAprovacao: 1, Aprovada: 2, Reprovada: 3,
    AjustesNecessarios: 4, Cancelada: 5, PendenteAprovacaoRh: 6,
    EmIntegracao: 7, Concluida: 8,
};
function normalizeStatus(s: number | string): number {
    return typeof s === "number" ? s : (STATUS_STR_TO_NUM[s] ?? 0);
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

function entrevistaBadge(status: EntrevistaSaidaStatusCode | string | null | undefined) {
    const key = normalizeEntrevistaStatus(status);
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${ENTREVISTA_STATUS_COLORS[key]}`}>
            {ENTREVISTA_STATUS_LABELS[key]}
        </span>
    );
}

/* ──────────────────────────── component ──────────────────────────── */

export default function DesligamentosScreen() {
    const { me } = useAuth();
    const canManageEntrevista = useHasPermission("folha.entrevista-saida.manage");
    const isAdmin = me?.roles?.some((r: string) => r.toLowerCase() === "admin" || r.toLowerCase() === "administrador") ?? false;
    const isRH = me?.roles?.some((r: string) => r.toLowerCase() === "rh") ?? false;
    const myFuncionarioId = (me as { funcionarioId?: string } | null)?.funcionarioId;
    const myRoles: string[] = (me?.roles ?? []) as string[];

    /* ── data ── */
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<SolicitacaoDesligamentoGridRow[]>([]);

    /* ── filters ── */
    const [q, setQ] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [agingBucket, setAgingBucket] = useState<AgingBucket>("");


    /* ── inline action dialogs ── */
    const [rejectTarget, setRejectTarget] = useState<string | null>(null);
    const [rejectObs, setRejectObs] = useState("");
    const [changesTarget, setChangesTarget] = useState<string | null>(null);
    const [changesObs, setChangesObs] = useState("");

    /* ── form modal ── */
    const [formOpen, setFormOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [viewId, setViewId] = useState<string | null>(null);
    const [resubmit, setResubmit] = useState(false);

    /* ── timeline modal ── */
    const [timelineOpen, setTimelineOpen] = useState(false);
    const [timelineSteps, setTimelineSteps] = useState<AprovacaoStep[]>([]);
    const [timelineStatus, setTimelineStatus] = useState<number | string | null>(null);
    const [timelineLoading, setTimelineLoading] = useState(false);

    /* ── detail dialog ── */
    const [detailOpen, setDetailOpen] = useState(false);
    const [detail, setDetail] = useState<SolicitacaoDesligamentoResponse | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    /* ── delete confirm ── */
    const [deleteTarget, setDeleteTarget] = useState<SolicitacaoDesligamentoGridRow | null>(null);

    /* ── entrevista de saída ── */
    const [entrevistaDetalhe, setEntrevistaDetalhe] = useState<EntrevistaSaidaDetalhe | null>(null);
    const [entrevistaDetalheOpen, setEntrevistaDetalheOpen] = useState(false);
    const [entrevistaDetalheLoading, setEntrevistaDetalheLoading] = useState(false);
    const [entrevistaFuncionario, setEntrevistaFuncionario] = useState<string | null>(null);

    /* ── approval actions ── */
    const [approvalObs, setApprovalObs] = useState("");

    /* ── data loading ── */
    const syncList = useCallback(async () => {
        const url = `${API}?pageSize=500`;
        const data = await fetchJson<SolicitacaoDesligamentoGridRow[]>(url);
        setRows(Array.isArray(data) ? data.map(r => ({ ...r, status: normalizeStatus(r.status) })) : []);
    }, []);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        syncList()
            .catch((e) => toast.error(`Falha ao carregar desligamentos: ${e instanceof Error ? e.message : "erro"}`))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [syncList]);

    /* ── filtering ── */
    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        return rows.filter((r) => {
            if (dateFrom && r.createdAtUtc && new Date(r.createdAtUtc) < new Date(dateFrom)) return false;
            if (dateTo && r.createdAtUtc && new Date(r.createdAtUtc) > new Date(`${dateTo}T23:59:59`)) return false;
            if (!matchesAgingBucket(r.createdAtUtc, agingBucket)) return false;
            if (!term) return true;
            const blob = [r.funcionarioNome, r.solicitanteNome].filter(Boolean).join(" ").toLowerCase();
            return blob.includes(term);
        });
    }, [q, rows, dateFrom, dateTo, agingBucket]);

    /* ── actions ── */
    function openNew() {
        setViewId(null);
        setEditId(null);
        setResubmit(false);
        setFormOpen(true);
    }

    function openEdit(row: SolicitacaoDesligamentoGridRow) {
        setViewId(null);
        setEditId(row.id);
        setResubmit(false);
        setFormOpen(true);
    }

    function openEditForApproval(row: SolicitacaoDesligamentoGridRow) {
        setViewId(null);
        setEditId(row.id);
        setResubmit(true);
        setFormOpen(true);
    }

    function openView(row: SolicitacaoDesligamentoGridRow) {
        setViewId(row.id);
        setEditId(null);
        setResubmit(false);
        setFormOpen(true);
    }

    async function openTimeline(row: SolicitacaoDesligamentoGridRow) {
        setTimelineOpen(true);
        setTimelineLoading(true);
        setTimelineSteps([]);
        setTimelineStatus(null);
        try {
            const d = await fetchJson<SolicitacaoDesligamentoResponse>(`${API}/${row.id}`);
            setTimelineStatus(d.status);
            setTimelineSteps(
                mapEtapasToSteps(d.etapas ?? [], d.solicitanteNome, d.createdAtUtc)
            );
        } catch {
            toast.error("Falha ao carregar acompanhamento.");
            setTimelineOpen(false);
        } finally {
            setTimelineLoading(false);
        }
    }

    async function openDetail(row: SolicitacaoDesligamentoGridRow) {
        setDetailOpen(true);
        setDetailLoading(true);
        setApprovalObs("");
        try {
            const d = await fetchJson<SolicitacaoDesligamentoResponse>(`${API}/${row.id}`);
            setDetail(d);
        } catch {
            toast.error("Falha ao carregar detalhes.");
            setDetailOpen(false);
        } finally {
            setDetailLoading(false);
        }
    }

    async function submitForApproval(id: string) {
        try {
            await fetchJson(`${API}/${id}/submit`, { method: "POST" });
            toast.success("Solicitação enviada para aprovação!");
            await syncList();
            setDetailOpen(false);
        } catch (e) {
            toast.error(`Falha ao enviar: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function assumirEtapa(id: string) {
        try {
            await fetchJson(`${API}/${id}/assumir`, { method: "POST" });
            toast.success("Etapa assumida com sucesso.");
            await syncList();
            if (detail?.id === id) {
                const d = await fetchJson<SolicitacaoDesligamentoResponse>(`${API}/${id}`);
                setDetail(d);
            }
        } catch (e) {
            toast.error(`Falha ao assumir: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function doApproval(id: string, action: "approve" | "reject" | "request-changes") {
        const labels = { approve: "Aprovada", reject: "Reprovada", "request-changes": "Ajustes solicitados" };
        try {
            await fetchJson(`${API}/${id}/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ observacao: approvalObs || null }),
            });
            toast.success(`Solicitação: ${labels[action]}!`);
            await syncList();
            setDetailOpen(false);
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

    async function cancelSolicitacao(id: string) {
        if (!(await confirmDialog({
            title: "Cancelar solicitação",
            description: "Tem certeza que deseja cancelar esta solicitação? Esta ação não pode ser desfeita.",
            confirmText: "Cancelar solicitação",
            destructive: true,
        }))) return;
        try {
            await fetchJson(`${API}/${id}/cancel`, { method: "POST" });
            toast.success("Solicitação cancelada.");
            await syncList();
        } catch (e) {
            toast.error(`Falha ao cancelar: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function copySolicitacao(id: string) {
        try {
            await fetchJson(`${API}/${id}/copy`, { method: "POST" });
            toast.success("Cópia criada como rascunho.");
            await syncList();
        } catch (e) {
            toast.error(`Falha ao copiar: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function efetivarDesligamento(id: string) {
        if (!(await confirmDialog({
            title: "Efetivar desligamento",
            description: "A solicitação de desligamento será concluída. Deseja continuar?",
            confirmText: "Efetivar",
        }))) return;
        try {
            await fetchJson(`${API}/${id}/efetivar`, { method: "POST" });
            toast.success("Desligamento concluído no Portal.");
            await syncList();
        } catch (e) {
            toast.error(`Falha ao efetivar: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function enviarEntrevista(id: string, funcionarioNome: string | null) {
        if (!(await confirmDialog({
            title: "Enviar entrevista de saída",
            description: `Enviar o questionário de entrevista de saída para ${funcionarioNome ?? "o colaborador"}? Um e-mail com link será disparado.`,
            confirmText: "Enviar entrevista",
        }))) return;
        try {
            await enviarEntrevistaSaida(id);
            toast.success("Entrevista de saída enviada por e-mail.");
            await syncList();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao enviar entrevista.");
        }
    }

    async function reenviarEntrevista(id: string) {
        try {
            await reenviarEntrevistaSaida(id);
            toast.success("Link da entrevista reenviado por e-mail.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao reenviar entrevista.");
        }
    }

    async function verRespostasEntrevista(row: SolicitacaoDesligamentoGridRow) {
        setEntrevistaDetalheOpen(true);
        setEntrevistaDetalheLoading(true);
        setEntrevistaDetalhe(null);
        setEntrevistaFuncionario(row.funcionarioNome);
        try {
            const detalhe = await getEntrevistaSaidaDetalhe(row.id);
            setEntrevistaDetalhe(detalhe);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao carregar respostas.");
            setEntrevistaDetalheOpen(false);
        } finally {
            setEntrevistaDetalheLoading(false);
        }
    }

    function canEnviarEntrevista(row: SolicitacaoDesligamentoGridRow) {
        const status = normalizeEntrevistaStatus(row.entrevistaSaidaStatus);
        return status === "NaoEnviada" || status === "Expirada" || status === "SemTemplate" || status === "SemEmail";
    }

    function canReenviarEntrevista(row: SolicitacaoDesligamentoGridRow) {
        return normalizeEntrevistaStatus(row.entrevistaSaidaStatus) === "Enviada";
    }

    function canVerRespostasEntrevista(row: SolicitacaoDesligamentoGridRow) {
        return normalizeEntrevistaStatus(row.entrevistaSaidaStatus) === "Respondida";
    }

    function canEfetivarDesligamento(row: SolicitacaoDesligamentoGridRow) {
        return row.status === 2 && canVerRespostasEntrevista(row);
    }

    function handleFormClose() {
        setFormOpen(false);
        setViewId(null);
        setResubmit(false);
    }

    function handleFormSaved() {
        setFormOpen(false);
        setViewId(null);
        setResubmit(false);
        syncList().catch(() => { });
    }

    /* ── inline quick actions ── */
    async function quickApprove(id: string) {
        try {
            await fetchJson(`${API}/${id}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ observacao: null }),
            });
            toast.success("Solicitação aprovada!");
            await syncList();
        } catch (e) {
            toast.error(`Falha ao aprovar: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function quickAssume(id: string) {
        try {
            await fetchJson(`${API}/${id}/assumir`, { method: "POST" });
            toast.success("Etapa assumida com sucesso.");
            await syncList();
        } catch (e) {
            toast.error(`Falha ao assumir: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function confirmReject() {
        if (!rejectTarget) return;
        try {
            await fetchJson(`${API}/${rejectTarget}/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ observacao: rejectObs || null }),
            });
            toast.success("Solicitação reprovada.");
            setRejectTarget(null);
            setRejectObs("");
            await syncList();
        } catch (e) {
            toast.error(`Falha ao reprovar: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function confirmChanges() {
        if (!changesTarget) return;
        try {
            await fetchJson(`${API}/${changesTarget}/request-changes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ observacao: changesObs || null }),
            });
            toast.success("Ajustes solicitados.");
            setChangesTarget(null);
            setChangesObs("");
            await syncList();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function gerarCarta(id: string) {
        try {
            await gerarCartaDownload(`${API}/${id}/carta`, `carta-desligamento-${id}.docx`);
            toast.success("Carta gerada com sucesso.");
        } catch (e) {
            toast.error(`Falha ao gerar carta: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    function exportCsv() {
        apiFetch(`${API}/export`)
            .then((res) => res.blob())
            .then((blob) => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "desligamentos.csv";
                a.click();
            })
            .catch(() => toast.error("Falha ao exportar."));
    }

    /* Determine if current user can approve the current pending step */
    const { canApprove, isQueueStep, currentEtapa } = useMemo(() => {
        if (!detail || !me) return { canApprove: false, isQueueStep: false, currentEtapa: null };
        if (detail.status !== 1 && detail.status !== 6) return { canApprove: false, isQueueStep: false, currentEtapa: null };
        if (isAdmin) return { canApprove: true, isQueueStep: false, currentEtapa: null };

        const etapas = detail.etapas;
        if (etapas && etapas.length > 0) {
            const pending = etapas.find((e) => e.status.toLowerCase() === "pendente");
            if (!pending) return { canApprove: false, isQueueStep: false, currentEtapa: null };
            const isQueue = pending.roleFilaId != null;
            if (isQueue) {
                const roleMatch = myRoles.some((r) =>
                    r.toLowerCase() === (pending.roleFilaNome ?? "").toLowerCase()
                );
                return { canApprove: roleMatch, isQueueStep: true, currentEtapa: pending };
            } else {
                const isFixed = pending.aprovadorId != null && pending.aprovadorId === myFuncionarioId;
                return { canApprove: isFixed, isQueueStep: false, currentEtapa: pending };
            }
        }

        return { canApprove: false, isQueueStep: false, currentEtapa: null };
    }, [detail, me, isAdmin, myFuncionarioId, myRoles]);

    /* ──────────────────────────── render ──────────────────────────── */
    return (
        <section className="space-y-4">
            {/* ── header ── */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-muted-foreground text-sm">Gerencie solicitações de desligamento e acompanhe aprovações</div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        onClick={() => {
                            setLoading(true);
                            syncList()
                                .catch(() => toast.error("Falha ao atualizar."))
                                .finally(() => setLoading(false));
                        }}
                    >
                        <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline">Atualizar</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportCsv}>
                        <Download className="size-4" />
                        <span className="hidden sm:inline">Exportar</span>
                    </Button>
                    <Button size="sm" onClick={openNew}>
                        <Plus className="size-4" />
                        <span className="hidden sm:inline">Nova solicitação</span>
                    </Button>
                    {canManageEntrevista && (
                        <>
                            <Button variant="outline" size="sm" asChild>
                                <Link href="/gestao/desligamentos/entrevista-template">Configurar questionário</Link>
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                                <Link href="/gestao/desligamentos/entrevistas-saida">Relatório entrevistas</Link>
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* ── filters + table ── */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                {/* Row 1: title + search */}
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <div className="font-semibold">Solicitações de desligamento</div>
                        <div className="text-muted-foreground text-sm">
                            {loading ? "Carregando…" : `${filtered.length} solicitação${filtered.length !== 1 ? "ões" : ""}`}
                        </div>
                    </div>
                    <div className="relative min-w-[220px] flex-1 max-w-md">
                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="pl-9"
                            placeholder="Buscar funcionário…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                </div>
                {/* Row 2: date range + aging + limpar filtros */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="size-3.5" />
                        <span>Criado em:</span>
                    </div>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" title="Data inicial" />
                    <span className="text-xs text-muted-foreground">–</span>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" title="Data final" />
                    <div className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3.5" />
                        <span>Aging:</span>
                    </div>
                    {AGING_BUCKETS.map((b) => (
                        <button key={b.value} type="button" onClick={() => setAgingBucket(prev => prev === b.value ? "" : b.value)} className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-colors ${agingBucket === b.value ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-muted-foreground hover:text-foreground"}`}>{b.label}</button>
                    ))}
                    {(q || dateFrom || dateTo || agingBucket) && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="ml-auto h-8"
                            onClick={() => {
                                setQ("");
                                setDateFrom("");
                                setDateTo("");
                                setAgingBucket("");
                            }}
                        >
                            <Filter className="size-3.5" />
                            Limpar Filtros
                        </Button>
                    )}
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-24 text-center">Código RM</TableHead>
                            <TableHead>Funcionário</TableHead>
                            <TableHead>Cargo Atual</TableHead>
                            <TableHead>Data Desligamento</TableHead>
                            {canManageEntrevista && <TableHead>Entrevista</TableHead>}
                            <TableHead>Data Criação</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={canManageEntrevista ? 7 : 6} className="text-center text-muted-foreground py-8">
                                    Carregando…
                                </TableCell>
                            </TableRow>
                        ) : filtered.length ? (
                            filtered.map((r) => (
                                <TableRow key={r.id} className="hover:bg-muted/40">
                                    <TableCell className="text-center font-mono text-xs font-medium">
                                        {r.rmIdReq ?? "—"}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-semibold">{r.funcionarioNome || "—"}</div>
                                        {r.solicitanteNome && (
                                            <div className="text-muted-foreground text-xs">Solicitante: {r.solicitanteNome}</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm">{r.cargoAtualNome || "—"}</TableCell>
                                    <TableCell className="text-sm">{formatDate(r.dataDesligamento)}</TableCell>
                                    {canManageEntrevista && (
                                        <TableCell>{entrevistaBadge(r.entrevistaSaidaStatus)}</TableCell>
                                    )}
                                    <TableCell className="text-sm text-muted-foreground">{formatDate(r.createdAtUtc)}</TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="icon-sm">
                                                    <MoreHorizontal className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-52">
                                                {(r.status === 2 || r.status === 3 || r.status === 7 || r.status === 8) && (
                                                    <DropdownMenuItem onClick={() => openView(r)}>
                                                        <Eye className="mr-2 size-4" />
                                                        Visualizar
                                                    </DropdownMenuItem>
                                                )}
                                                {r.status === 0 && (
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
                                                {r.status === 4 && (
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
                                                {r.status === 6 && r.etapaPendenteCanAssume && (
                                                    <DropdownMenuItem onClick={() => void quickAssume(r.id)}>
                                                        <UserCheck className="mr-2 size-4" />
                                                        Assumir
                                                    </DropdownMenuItem>
                                                )}
                                                {((r.status === 6 && r.etapaPendenteCanApprove && !r.etapaPendenteCanAssume)
                                                    || (r.status === 1 && (r.etapaPendenteCanAssume || r.etapaPendenteCanApprove))) && (
                                                    <>
                                                        <DropdownMenuItem
                                                            className="text-emerald-600 focus:text-emerald-600"
                                                            onClick={() => void quickApprove(r.id)}
                                                        >
                                                            <CheckCircle2 className="mr-2 size-4" />
                                                            Aprovar
                                                        </DropdownMenuItem>
                                                        {r.status === 1 && r.etapaPendenteIsQueue && r.etapaPendenteCanAssume && (
                                                            <DropdownMenuItem onClick={() => void quickAssume(r.id)}>
                                                                <UserCheck className="mr-2 size-4" />
                                                                Assumir
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem onClick={() => setChangesTarget(r.id)}>
                                                            <AlertTriangle className="mr-2 size-4" />
                                                            Solicitar ajustes
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => setRejectTarget(r.id)}
                                                        >
                                                            <XCircle className="mr-2 size-4" />
                                                            Reprovar
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                                {r.status === 1 && !r.etapaPendenteCanAssume && !r.etapaPendenteCanApprove && (
                                                    <DropdownMenuItem onClick={() => openEditForApproval(r)}>
                                                        <Pencil className="mr-2 size-4" />
                                                        Editar e reenviar
                                                    </DropdownMenuItem>
                                                )}
                                                {canEfetivarDesligamento(r) && (isAdmin || isRH) && (
                                                    <DropdownMenuItem onClick={() => void efetivarDesligamento(r.id)}>
                                                        <Zap className="mr-2 size-4" />
                                                        Efetivar desligamento
                                                    </DropdownMenuItem>
                                                )}
                                                {r.status === 2 && (
                                                    <DropdownMenuItem onClick={() => void gerarCarta(r.id)}>
                                                        <FileText className="mr-2 size-4" />
                                                        Gerar carta
                                                    </DropdownMenuItem>
                                                )}
                                                {canManageEntrevista && (r.status === 2 || r.status === 7 || r.status === 8) && canEnviarEntrevista(r) && (
                                                    <DropdownMenuItem onClick={() => void enviarEntrevista(r.id, r.funcionarioNome)}>
                                                        <MessageSquare className="mr-2 size-4" />
                                                        Enviar entrevista de saída
                                                    </DropdownMenuItem>
                                                )}
                                                {canManageEntrevista && canReenviarEntrevista(r) && (
                                                    <DropdownMenuItem onClick={() => void reenviarEntrevista(r.id)}>
                                                        <Send className="mr-2 size-4" />
                                                        Reenviar link
                                                    </DropdownMenuItem>
                                                )}
                                                {canManageEntrevista && canVerRespostasEntrevista(r) && (
                                                    <DropdownMenuItem onClick={() => void verRespostasEntrevista(r)}>
                                                        <Eye className="mr-2 size-4" />
                                                        Ver respostas
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem onClick={() => void copySolicitacao(r.id)}>
                                                    <Copy className="mr-2 size-4" />
                                                    Copiar solicitação
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => void openTimeline(r)}>
                                                    <Activity className="mr-2 size-4" />
                                                    Acompanhamento
                                                </DropdownMenuItem>
                                                {(r.status === 1 || r.status === 4) && (
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
                                                )}
                                                {r.status === 0 && (
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
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={canManageEntrevista ? 7 : 6} className="text-center text-muted-foreground py-8">
                                    Nenhuma solicitação encontrada.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* ── Form Modal ── */}
            <DesligamentoFormModal
                open={formOpen}
                editId={viewId ?? editId}
                onClose={handleFormClose}
                onSaved={handleFormSaved}
                viewOnly={!!viewId}
                resubmitAfterSave={resubmit}
            />

            {/* ── Timeline Modal ── */}
            <AcompanhamentoModal
                open={timelineOpen}
                loading={timelineLoading}
                steps={timelineSteps}
                solicitacaoStatus={timelineStatus}
                onClose={() => setTimelineOpen(false)}
            />

            {/* ── Detail Dialog ── */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Desligamento</DialogTitle>
                        <DialogDescription>Informações completas e ações de aprovação.</DialogDescription>
                    </DialogHeader>
                    {detailLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="border-lt-primary h-6 w-6 animate-spin rounded-full border-4 border-t-transparent" />
                        </div>
                    ) : detail ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Funcionário</div>
                                    <div className="font-semibold">{detail.funcionarioNome || "—"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Status</div>
                                    <div className="mt-0.5">{statusBadge(detail.status)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Tipo de Desligamento</div>
                                    <div className="text-sm">{TIPO_DESLIGAMENTO_MAP[detail.tipoDesligamento] ?? "—"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Data de Desligamento</div>
                                    <div className="text-sm">{formatDate(detail.dataDesligamento)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Aviso Prévio</div>
                                    <div className="text-sm">{TIPO_AVISO_PREVIO_MAP[detail.tipoAvisoPrevio] ?? "—"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Dias de Aviso</div>
                                    <div className="text-sm font-mono">{detail.diasAvisoPrevio}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Elegível p/ Recontratação</div>
                                    <div className="text-sm">{detail.elegivelRecontratacao ? "Sim" : "Não"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Substituir Posição</div>
                                    <div className="text-sm">{detail.substituirPosicao ? "Sim" : "Não"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Solicitante</div>
                                    <div className="text-sm">{detail.solicitanteNome || "—"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Data Criação</div>
                                    <div className="text-sm">{formatDate(detail.createdAtUtc)}</div>
                                </div>
                            </div>

                            {/* ── Approval chain (dynamic etapas) ── */}
                            <div className="rounded-lg border border-border/40 p-3 space-y-2">
                                <div className="text-xs font-semibold text-muted-foreground uppercase">Cadeia de Aprovação</div>
                                {detail.etapas && detail.etapas.length > 0 ? (
                                    <div className="space-y-2">
                                        {detail.etapas.map((etapa: { ordem: number; label: string; status: string; aprovadorNome?: string | null; roleFilaId?: string | null; roleFilaNome?: string | null; observacao?: string | null; dataUtc?: string | null }) => {
                                            const isPendente = etapa.status.toLowerCase() === "pendente";
                                            const isQueue = etapa.roleFilaId != null;
                                            return (
                                                <div
                                                    key={etapa.ordem}
                                                    className={`flex items-start justify-between gap-2 rounded-md p-2 ${isPendente ? "bg-amber-500/5 border border-amber-500/20" : "bg-muted/20"}`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-mono rounded-full bg-muted px-1.5 py-0.5 text-muted-foreground">{etapa.ordem}</span>
                                                            <span className="text-xs font-semibold">{etapa.label}</span>
                                                            {isQueue && (
                                                                <span className="text-[10px] rounded-full bg-violet-500/10 text-violet-600 px-1.5 py-0.5 flex items-center gap-1">
                                                                    <Users className="size-2.5" /> Fila: {etapa.roleFilaNome}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground mt-0.5">
                                                            {etapa.aprovadorNome
                                                                ? etapa.aprovadorNome
                                                                : isPendente && isQueue
                                                                    ? "Aguardando assumir…"
                                                                    : "—"}
                                                        </div>
                                                        {etapa.observacao && (
                                                            <div className="text-xs text-muted-foreground mt-0.5 italic">{etapa.observacao}</div>
                                                        )}
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        {etapaStatusBadge(etapa.status)}
                                                        {etapa.dataUtc && (
                                                            <div className="text-[10px] text-muted-foreground mt-0.5 text-right">{formatDate(etapa.dataUtc)}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : null}
                            </div>

                            {detail.motivoDesligamento && (
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Motivo</div>
                                    <div className="mt-1 text-sm rounded-md bg-muted/30 p-3">{detail.motivoDesligamento}</div>
                                </div>
                            )}

                            {detail.observacoes && (
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Observações</div>
                                    <div className="mt-1 text-sm rounded-md bg-muted/30 p-3">{detail.observacoes}</div>
                                </div>
                            )}

                            {detail.observacaoAprovador && (
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">
                                        {detail.status === 3 ? "Motivo da Recusa" : "Observação do Aprovador"}
                                    </div>
                                    <div className={`mt-1 text-sm rounded-md p-3 border ${
                                        detail.status === 3
                                            ? "bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-300"
                                            : "bg-amber-500/10 border-amber-500/20"
                                    }`}>
                                        {detail.observacaoAprovador}
                                    </div>
                                </div>
                            )}

                            {/* ── Approval actions ── */}
                            {(detail.status === 1 || detail.status === 6) && (isAdmin || canApprove) && (
                                <div className="space-y-3 rounded-lg border border-border/60 p-3">
                                    <div className="text-sm font-semibold">Ações de aprovação</div>
                                    {currentEtapa && (
                                        <div className="text-xs text-muted-foreground">
                                            Etapa atual: <strong>{currentEtapa.label}</strong>
                                            {isQueueStep && " (Fila de perfil — você irá assumir e aprovar)"}
                                        </div>
                                    )}
                                    <textarea
                                        className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground"
                                        rows={2}
                                        placeholder="Observação (opcional)..."
                                        value={approvalObs}
                                        onChange={(e) => setApprovalObs(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void doApproval(detail.id, "approve")}>
                                            <CheckCircle2 className="size-4" />
                                            {isQueueStep ? "Assumir e Aprovar" : "Aprovar"}
                                        </Button>
                                        <Button size="sm" variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => void doApproval(detail.id, "request-changes")}>
                                            <AlertTriangle className="size-4" /> Ajustes
                                        </Button>
                                        <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => void doApproval(detail.id, "reject")}>
                                            <XCircle className="size-4" /> Reprovar
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* ── Submit action ── */}
                            {(detail.status === 0 || detail.status === 4) && (
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => void submitForApproval(detail.id)}>
                                        <Send className="size-4" /> Enviar para aprovação
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => { setDetailOpen(false); setEditId(detail.id); setFormOpen(true); }}>
                                        <Pencil className="size-4" /> Editar
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* ── Reject Dialog ── */}
            <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectObs(""); } }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Reprovar solicitação</DialogTitle>
                        <DialogDescription>Informe o motivo da reprovação (opcional).</DialogDescription>
                    </DialogHeader>
                    <textarea
                        className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground"
                        rows={3}
                        placeholder="Observação…"
                        value={rejectObs}
                        onChange={(e) => setRejectObs(e.target.value)}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectObs(""); }}>Cancelar</Button>
                        <Button variant="destructive" onClick={() => void confirmReject()}>Reprovar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Request Changes Dialog ── */}
            <Dialog open={!!changesTarget} onOpenChange={(open) => { if (!open) { setChangesTarget(null); setChangesObs(""); } }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Solicitar ajustes</DialogTitle>
                        <DialogDescription>Descreva os ajustes necessários.</DialogDescription>
                    </DialogHeader>
                    <textarea
                        className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground"
                        rows={3}
                        placeholder="Observação…"
                        value={changesObs}
                        onChange={(e) => setChangesObs(e.target.value)}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setChangesTarget(null); setChangesObs(""); }}>Cancelar</Button>
                        <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => void confirmChanges()}>Solicitar ajustes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Entrevista respostas ── */}
            <Dialog open={entrevistaDetalheOpen} onOpenChange={setEntrevistaDetalheOpen}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Entrevista de saída — {entrevistaFuncionario ?? "Colaborador"}</DialogTitle>
                        <DialogDescription>
                            {entrevistaDetalhe?.respondidaEmUtc
                                ? `Respondida em ${formatDate(entrevistaDetalhe.respondidaEmUtc)}`
                                : "Respostas do questionário"}
                        </DialogDescription>
                    </DialogHeader>
                    {entrevistaDetalheLoading ? (
                        <div className="text-center text-muted-foreground py-8">Carregando…</div>
                    ) : entrevistaDetalhe?.respostas?.length ? (
                        <div className="space-y-3">
                            {entrevistaDetalhe.respostas.map((resp, idx) => (
                                <div key={idx} className="rounded-md border border-border/40 p-3">
                                    <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                                        {resp.pergunta}
                                    </div>
                                    <div className="text-sm">{formatRespostaValor(resp)}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground">Nenhuma resposta disponível.</div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirm ── */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Confirmar exclusão</DialogTitle>
                        <DialogDescription>
                            Excluir a solicitação de desligamento de <strong>&quot;{deleteTarget?.funcionarioNome}&quot;</strong>? Esta ação não pode ser desfeita.
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
        </section>
    );
}
