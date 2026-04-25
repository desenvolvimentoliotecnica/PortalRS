"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
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
    ArrowRight,
    Users,
    Activity,
    Download,
    UserCheck,
    Ban,
    Copy,
    CalendarDays,
} from "lucide-react";
import { AGING_BUCKETS, type AgingBucket, matchesAgingBucket } from "@/features/shared/urgencia";
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

import PromocaoFormModal from "./PromocaoFormModal";
import AcompanhamentoModal, { AprovacaoStep } from "@/features/gestao/shared/AcompanhamentoModal";
import { mapEtapasToSteps, type EtapaAprovacaoResponse } from "@/features/gestao/shared/etapaUtils";
import { confirmDialog } from "@/lib/confirm-dialog";

/* ──────────────────────────── types ──────────────────────────── */

interface SolicitacaoPromocaoGridRow {
    id: string;
    status: number;
    solicitanteNome: string | null;
    funcionarioNome: string | null;
    novoCargoNome: string | null;
    dataEfetiva: string | null;
    createdAtUtc: string;
    etapaPendenteLabel: string | null;
    etapaPendenteCom: string | null;
    etapaPendenteIsQueue?: boolean;
    etapaPendenteCanAssume?: boolean;
}

interface SolicitacaoPromocaoResponse {
    id: string;
    status: number;
    solicitanteNome: string | null;
    funcionarioNome: string | null;
    dataEfetiva: string | null;
    cargoAtualNome: string | null;
    novoCargoNome: string | null;
    areaAtualNome: string | null;
    novaAreaNome: string | null;
    justificativa: string | null;
    observacaoAprovador: string | null;
    observacoes: string | null;
    createdAtUtc: string;
    etapas?: EtapaAprovacaoResponse[];
}

type StatusKey = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/* ──────────────────────────── helpers ──────────────────────────── */

const API = "/api/solicitacoes-promocao";

// "Ativas" = solicitações que ainda precisam de atenção
const ATIVAS = new Set(["0", "1", "4", "6"]); // Rascunho, Pendente, Ajustes, Aguarda Fila

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
    0: { label: "Rascunho",    color: "bg-zinc-400/15 text-zinc-600",   icon: FileText },
    1: { label: "Pendente",    color: "bg-amber-500/15 text-amber-700", icon: Clock },
    2: { label: "Aprovada",    color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    3: { label: "Reprovada",   color: "bg-red-500/15 text-red-700",     icon: XCircle },
    4: { label: "Ajustes",     color: "bg-orange-500/15 text-orange-700", icon: AlertTriangle },
    5: { label: "Cancelada",   color: "bg-zinc-500/15 text-zinc-500",   icon: XCircle },
    6: { label: "Aguarda Fila", color: "bg-violet-500/15 text-violet-700", icon: Users },
};

const ETAPA_STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    pendente: { label: "Pendente", color: "bg-amber-500/15 text-amber-700", icon: Clock },
    aprovado: { label: "Aprovado", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    reprovado: { label: "Reprovado", color: "bg-red-500/15 text-red-700", icon: XCircle },
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

/* ──────────────────────────── component ──────────────────────────── */

export default function PromocoesScreen() {
    const { me } = useAuth();
    const isAdmin = me?.roles?.some((r: string) => r.toLowerCase() === "admin" || r.toLowerCase() === "administrador") ?? false;
    const myFuncionarioId = (me as { funcionarioId?: string } | null)?.funcionarioId;
    const myRoles: string[] = (me?.roles ?? []) as string[];

    /* ── data ── */
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<SolicitacaoPromocaoGridRow[]>([]);

    /* ── filters ── */
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("ativas");
    const [centroCustoFilter, setCentroCustoFilter] = useState("all");
    const [centrosCusto, setCentrosCusto] = useState<{ id: string; code: string; description: string; displayLabel?: string }[]>([]);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [agingBucket, setAgingBucket] = useState<AgingBucket>("");

    /* ── bulk selection ── */
    const [selected, setSelected] = useState<Set<string>>(new Set());

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
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineStatus, setTimelineStatus] = useState<number | string | null>(null);

    /* ── detail dialog ── */
    const [detailOpen, setDetailOpen] = useState(false);
    const [detail, setDetail] = useState<SolicitacaoPromocaoResponse | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    /* ── delete confirm ── */
    const [deleteTarget, setDeleteTarget] = useState<SolicitacaoPromocaoGridRow | null>(null);

    /* ── approval actions ── */
    const [approvalObs, setApprovalObs] = useState("");

    /* ── data loading ── */
    const syncList = useCallback(async () => {
        const params = new URLSearchParams();
        if (centroCustoFilter !== "all") params.set("centroCustoId", centroCustoFilter);
        const url = params.toString() ? `${API}?${params.toString()}` : API;
        const data = await fetchJson<SolicitacaoPromocaoGridRow[]>(url);
        setRows(Array.isArray(data) ? data.map(r => ({ ...r, status: normalizeStatus(r.status) })) : []);
        setSelected(new Set());
    }, [centroCustoFilter]);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        syncList()
            .catch((e) => toast.error(`Falha ao carregar promoções: ${e instanceof Error ? e.message : "erro"}`))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [syncList]);

    /* ── fetch centros de custo for filter ── */
    useEffect(() => {
        apiFetch("/api/centros-custo/lookup")
            .then((r) => r.json())
            .then((d: { id: string; code: string; description: string; displayLabel?: string }[]) => setCentrosCusto(Array.isArray(d) ? d : []))
            .catch(() => { });
    }, []);

    /* ── filtering ── */
    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        return rows.filter((r) => {
            const s = String(r.status);
            if (statusFilter === "ativas" && !ATIVAS.has(s)) return false;
            if (statusFilter === "aprovadas" && s !== "2") return false;
            if (statusFilter === "reprovadas" && s !== "3") return false;
            if (statusFilter === "canceladas" && s !== "5") return false;
            if (dateFrom && r.createdAtUtc && new Date(r.createdAtUtc) < new Date(dateFrom)) return false;
            if (dateTo && r.createdAtUtc && new Date(r.createdAtUtc) > new Date(`${dateTo}T23:59:59`)) return false;
            if (!matchesAgingBucket(r.createdAtUtc, agingBucket)) return false;
            if (!term) return true;
            const blob = [r.funcionarioNome, r.solicitanteNome, r.novoCargoNome].filter(Boolean).join(" ").toLowerCase();
            return blob.includes(term);
        });
    }, [q, rows, statusFilter, dateFrom, dateTo, agingBucket]);

    /* ── KPIs ── */
    const kpis = useMemo(() => {
        const total = rows.length;
        const pendentes = rows.filter((r) => r.status === 1 || r.status === 6).length;
        const aprovadas = rows.filter((r) => r.status === 2).length;
        const reprovadas = rows.filter((r) => r.status === 3).length;
        return { total, pendentes, aprovadas, reprovadas };
    }, [rows]);

    /* ── actions ── */
    function openNew() {
        setViewId(null);
        setEditId(null);
        setResubmit(false);
        setFormOpen(true);
    }

    function openEdit(row: SolicitacaoPromocaoGridRow) {
        setViewId(null);
        setEditId(row.id);
        setResubmit(false);
        setFormOpen(true);
    }

    function openEditForApproval(row: SolicitacaoPromocaoGridRow) {
        setViewId(null);
        setEditId(row.id);
        setResubmit(true);
        setFormOpen(true);
    }

    function openView(row: SolicitacaoPromocaoGridRow) {
        setViewId(row.id);
        setEditId(null);
        setResubmit(false);
        setFormOpen(true);
    }

    async function openTimeline(row: SolicitacaoPromocaoGridRow) {
        setTimelineOpen(true);
        setTimelineLoading(true);
        setTimelineSteps([]);
        setTimelineStatus(null);
        try {
            const d = await fetchJson<SolicitacaoPromocaoResponse>(`${API}/${row.id}`);
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

    async function openDetail(row: SolicitacaoPromocaoGridRow) {
        setDetailOpen(true);
        setDetailLoading(true);
        setApprovalObs("");
        try {
            const d = await fetchJson<SolicitacaoPromocaoResponse>(`${API}/${row.id}`);
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
                const d = await fetchJson<SolicitacaoPromocaoResponse>(`${API}/${id}`);
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

    async function bulkApprove() {
        const ids = [...selected];
        await Promise.all(ids.map((id) => quickApprove(id)));
        setSelected(new Set());
        await syncList();
    }

    async function gerarCarta(id: string) {
        try {
            const res = await fetchJson<{ url: string }>(`${API}/${id}/carta`, { method: "POST" });
            window.open(res.url, "_blank");
        } catch (e) {
            toast.error(`Falha ao gerar carta: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    function exportCsv() {
        const params = new URLSearchParams();
        if (centroCustoFilter !== "all") params.set("centroCustoId", centroCustoFilter);
        if (statusFilter !== "all") params.set("status", statusFilter);
        apiFetch(`${API}/export?${params.toString()}`)
            .then((res) => res.blob())
            .then((blob) => {
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "movimentacoes.csv";
                a.click();
            })
            .catch(() => toast.error("Falha ao exportar."));
    }

    /* Determine if current user can approve the current pending step */
    const { canApprove, isQueueStep, currentEtapa } = useMemo(() => {
        if (!detail || !me) return { canApprove: false, isQueueStep: false, currentEtapa: null };
        if (detail.status !== 1 && detail.status !== 6) return { canApprove: false, isQueueStep: false, currentEtapa: null };
        if (isAdmin) return { canApprove: true, isQueueStep: false, currentEtapa: null };

        // Use etapas array if available
        const etapas = detail.etapas;
        if (etapas && etapas.length > 0) {
            const pending = etapas.find((e) => e.status.toLowerCase() === "pendente");
            if (!pending) return { canApprove: false, isQueueStep: false, currentEtapa: null };
            const isQueue = pending.roleFilaId != null;
            if (isQueue) {
                // Check if user's roles include the queue role name
                const roleMatch = myRoles.some((r) =>
                    r.toLowerCase() === (pending.roleFilaNome ?? "").toLowerCase()
                );
                return { canApprove: roleMatch, isQueueStep: true, currentEtapa: pending };
            } else {
                // Fixed approver check
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
                <div className="text-muted-foreground text-sm">Gerencie solicitações de promoção e acompanhe aprovações</div>
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
                </div>
            </div>

            {/* ── filters + table ── */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                {/* Row 1: title + search + area */}
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <div className="font-semibold">Solicitações de promoção</div>
                        <div className="text-muted-foreground text-sm">
                            {loading ? "Carregando…" : `${filtered.length} solicitação${filtered.length !== 1 ? "ões" : ""}`}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[220px] flex-1">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="pl-9"
                                placeholder="Buscar funcionário, cargo…"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                            />
                        </div>
                        {centrosCusto.length > 0 && (
                            <select
                                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                                value={centroCustoFilter}
                                onChange={(e) => setCentroCustoFilter(e.target.value)}
                            >
                                <option value="all">Todos centros de custo</option>
                                {centrosCusto.map((c) => (
                                    <option key={c.id} value={c.id}>{c.displayLabel || `${c.code} — ${c.description}`}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
                {/* Row 2: status chips */}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    {([
                        { key: "ativas",    label: "Ativas",     count: rows.filter(r => ATIVAS.has(String(r.status))).length,           cls: "data-[active=true]:bg-amber-500/15 data-[active=true]:text-amber-700 data-[active=true]:border-amber-400/50" },
                        { key: "aprovadas", label: "Aprovadas",  count: rows.filter(r => r.status === 2).length,                          cls: "data-[active=true]:bg-emerald-500/15 data-[active=true]:text-emerald-700 data-[active=true]:border-emerald-400/50" },
                        { key: "reprovadas",label: "Reprovadas", count: rows.filter(r => r.status === 3).length,                          cls: "data-[active=true]:bg-red-500/15 data-[active=true]:text-red-700 data-[active=true]:border-red-400/50" },
                        { key: "canceladas",label: "Canceladas", count: rows.filter(r => r.status === 5).length,                          cls: "data-[active=true]:bg-zinc-500/15 data-[active=true]:text-zinc-600 data-[active=true]:border-zinc-400/50" },
                        { key: "all",       label: "Todas",      count: rows.length,                                                      cls: "data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:border-primary/30" },
                    ] as const).map(({ key, label, count, cls }) => (
                        <button
                            key={key}
                            data-active={statusFilter === key}
                            onClick={() => setStatusFilter(key)}
                            className={`inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 ${cls}`}
                        >
                            {label}
                            <span className="rounded-full bg-current/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none opacity-80">{count}</span>
                        </button>
                    ))}
                </div>
                {/* Row 3: date range + aging */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="size-3.5" />
                        <span>Criado em:</span>
                    </div>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" title="Data inicial" />
                    <span className="text-xs text-muted-foreground">–</span>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" title="Data final" />
                    {(dateFrom || dateTo) && (
                        <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-muted-foreground hover:text-foreground underline">Limpar</button>
                    )}
                    <div className="ml-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="size-3.5" />
                        <span>Aging:</span>
                    </div>
                    {AGING_BUCKETS.map((b) => (
                        <button key={b.value} type="button" onClick={() => setAgingBucket(prev => prev === b.value ? "" : b.value)} className={`inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-colors ${agingBucket === b.value ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-muted-foreground hover:text-foreground"}`}>{b.label}</button>
                    ))}
                </div>

                {selected.size > 0 && (
                    <div className="mb-3 flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 px-4 py-2">
                        <span className="text-sm font-medium">{selected.size} selecionada(s)</span>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 px-3 text-xs" onClick={() => void bulkApprove()}>
                            <CheckCircle2 className="size-3 mr-1" /> Aprovar todas
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => setSelected(new Set())}>
                            Limpar seleção
                        </Button>
                    </div>
                )}

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-10">
                                <input
                                    type="checkbox"
                                    className="rounded border-border"
                                    checked={selected.size > 0 && filtered.filter(r => r.etapaPendenteCanAssume).every(r => selected.has(r.id))}
                                    onChange={(e) => {
                                        const eligible = filtered.filter(r => r.etapaPendenteCanAssume).map(r => r.id);
                                        setSelected(e.target.checked ? new Set(eligible) : new Set());
                                    }}
                                />
                            </TableHead>
                            <TableHead>Funcionário</TableHead>
                            <TableHead>Cargo Atual → Novo Cargo</TableHead>
                            <TableHead>Data Efetiva</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Aguardando</TableHead>
                            <TableHead>Data Criação</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                    Carregando…
                                </TableCell>
                            </TableRow>
                        ) : filtered.length ? (
                            filtered.map((r) => (
                                <TableRow key={r.id} className="hover:bg-muted/40">
                                    <TableCell>
                                        {r.etapaPendenteCanAssume ? (
                                            <input
                                                type="checkbox"
                                                className="rounded border-border"
                                                checked={selected.has(r.id)}
                                                onChange={(e) => {
                                                    const next = new Set(selected);
                                                    if (e.target.checked) next.add(r.id); else next.delete(r.id);
                                                    setSelected(next);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : null}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-semibold">{r.funcionarioNome || "—"}</div>
                                        {r.solicitanteNome && (
                                            <div className="text-muted-foreground text-xs">Solicitante: {r.solicitanteNome}</div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 text-sm">
                                            <span className="text-muted-foreground">—</span>
                                            <ArrowRight className="size-3 text-muted-foreground" />
                                            <span className="font-medium">{r.novoCargoNome || "—"}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-sm">{formatDate(r.dataEfetiva)}</TableCell>
                                    <TableCell>{statusBadge(r.status)}</TableCell>
                                    <TableCell>
                                        {(r.status === 1 || r.status === 6) && r.etapaPendenteLabel ? (
                                            <div className="text-xs leading-tight">
                                                <div className="text-muted-foreground">{r.etapaPendenteLabel}</div>
                                                {r.etapaPendenteCom ? (
                                                    <div className="font-medium truncate max-w-[140px]" title={r.etapaPendenteCom}>{r.etapaPendenteCom}</div>
                                                ) : (
                                                    <div className="font-medium">{
                                                        r.etapaPendenteIsQueue ? "Aguardando consenso" : "Aguardando"
                                                    }</div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{formatDate(r.createdAtUtc)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                            {/* Rascunho: editar, enviar, excluir */}
                                            {r.status === 0 && (
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
                                            {r.status === 4 && (
                                                <>
                                                    <Button variant="outline" size="icon-xs" title="Editar" onClick={() => openEdit(r)}>
                                                        <Pencil />
                                                    </Button>
                                                    <Button variant="outline" size="icon-xs" title="Enviar para aprovação" onClick={() => void submitForApproval(r.id)}>
                                                        <Send />
                                                    </Button>
                                                </>
                                            )}
                                            {/* Pendente: ações inline se pode aprovar, senão editar */}
                                            {r.status === 1 && r.etapaPendenteCanAssume ? (
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    <Button size="sm" variant="outline"
                                                        className="h-7 px-2 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                                        onClick={(e) => { e.stopPropagation(); void quickApprove(r.id); }}>
                                                        <CheckCircle2 className="size-3 mr-1" /> Aprovar
                                                    </Button>
                                                    {r.etapaPendenteIsQueue && (
                                                        <Button size="sm" variant="outline"
                                                            className="h-7 px-2 text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
                                                            onClick={(e) => { e.stopPropagation(); void quickAssume(r.id); }}>
                                                            <UserCheck className="size-3 mr-1" /> Assumir
                                                        </Button>
                                                    )}
                                                    <Button size="sm" variant="outline"
                                                        className="h-7 px-2 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                                                        onClick={(e) => { e.stopPropagation(); setChangesTarget(r.id); }}>
                                                        <AlertTriangle className="size-3 mr-1" /> Ajustes
                                                    </Button>
                                                    <Button size="sm" variant="outline"
                                                        className="h-7 px-2 text-xs text-red-700 border-red-300 hover:bg-red-50"
                                                        onClick={(e) => { e.stopPropagation(); setRejectTarget(r.id); }}>
                                                        <XCircle className="size-3 mr-1" /> Reprovar
                                                    </Button>
                                                </div>
                                            ) : r.status === 1 ? (
                                                <Button variant="outline" size="icon-xs" title="Editar e reenviar" onClick={() => openEditForApproval(r)}>
                                                    <Pencil />
                                                </Button>
                                            ) : null}
                                            {/* Aprovada: visualizar + gerar carta */}
                                            {r.status === 2 && (
                                                <>
                                                    <Button variant="outline" size="icon-xs" title="Visualizar" onClick={() => openView(r)}>
                                                        <Eye />
                                                    </Button>
                                                    <Button variant="outline" size="icon-xs" title="Gerar carta" onClick={() => void gerarCarta(r.id)}>
                                                        <FileText />
                                                    </Button>
                                                </>
                                            )}
                                            {/* Reprovada: visualizar */}
                                            {r.status === 3 && (
                                                <Button variant="outline" size="icon-xs" title="Visualizar" onClick={() => openView(r)}>
                                                    <Eye />
                                                </Button>
                                            )}
                                            {/* Cancelar: pendente ou ajustes */}
                                            {(r.status === 1 || r.status === 4) && (
                                                <Button variant="outline" size="icon-xs" title="Cancelar solicitação"
                                                    className="hover:text-red-600 hover:border-red-300"
                                                    onClick={(e) => { e.stopPropagation(); void cancelSolicitacao(r.id); }}>
                                                    <Ban />
                                                </Button>
                                            )}
                                            {/* Copiar: todos os status */}
                                            <Button variant="outline" size="icon-xs" title="Copiar solicitação"
                                                onClick={(e) => { e.stopPropagation(); void copySolicitacao(r.id); }}>
                                                <Copy />
                                            </Button>
                                            {/* Acompanhamento: todas as linhas */}
                                            <Button variant="outline" size="icon-xs" title="Acompanhamento" onClick={() => void openTimeline(r)}>
                                                <Activity />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                    {statusFilter === "ativas"
                                ? "Nenhuma solicitação ativa. Tudo em dia! 🎉"
                                : "Nenhuma solicitação encontrada."}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* ── Form Modal ── */}
            <PromocaoFormModal
                open={formOpen}
                editId={viewId ?? editId}
                onClose={handleFormClose}
                onSaved={handleFormSaved}
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
                        <DialogTitle>Detalhes da Promoção</DialogTitle>
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
                                    <div className="text-xs text-muted-foreground uppercase">Cargo Atual</div>
                                    <div className="text-sm">{detail.cargoAtualNome || "—"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Novo Cargo</div>
                                    <div className="text-sm font-medium">{detail.novoCargoNome || "—"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Área Atual</div>
                                    <div className="text-sm">{detail.areaAtualNome || "—"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Nova Área</div>
                                    <div className="text-sm">{detail.novaAreaNome || "—"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Data Efetiva</div>
                                    <div className="text-sm">{formatDate(detail.dataEfetiva)}</div>
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
                                        {detail.etapas.map((etapa) => {
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

                            {detail.justificativa && (
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Justificativa</div>
                                    <div className="mt-1 text-sm rounded-md bg-muted/30 p-3">{detail.justificativa}</div>
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
                                    <div className="text-xs text-muted-foreground uppercase">Observação do Aprovador</div>
                                    <div className="mt-1 text-sm rounded-md bg-amber-500/10 p-3 border border-amber-500/20">
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

            {/* ── Delete Confirm ── */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Confirmar exclusão</DialogTitle>
                        <DialogDescription>
                            Excluir a solicitação de promoção de <strong>&quot;{deleteTarget?.funcionarioNome}&quot;</strong>? Esta ação não pode ser desfeita.
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
