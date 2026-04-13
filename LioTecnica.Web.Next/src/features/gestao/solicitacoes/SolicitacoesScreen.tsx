"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
    Columns3,
    List,
    XCircle,
    AlertTriangle,
    FileText,
    Lock,
    UserMinus,
    Briefcase,
    TrendingUp,
    Activity,
    Ban,
    Copy,
} from "lucide-react";
import PromocoesScreen from "@/features/gestao/promocoes/PromocoesScreen";
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

import SolicitacaoFormModal from "./SolicitacaoFormModal";
import AcompanhamentoModal, { AprovacaoStep } from "@/features/gestao/shared/AcompanhamentoModal";
import NextStepBanner from "@/components/feedback/NextStepBanner";
import { mapEtapasToSteps, type EtapaAprovacaoResponse } from "@/features/gestao/shared/etapaUtils";

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
    areaName: string | null;
    qtdPosicoes: number;
    tipoSolicitacao: number | string;
    isConfidencial: boolean;
    substituidoNome: string | null;
    createdAtUtc: string;
    etapaPendenteLabel: string | null;
    etapaPendenteCom: string | null;
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
    etapasFluxo?: { ordem: number; label: string; aprovadorNome: string | null; roleNome: string | null; status: number; dataUtc: string | null; observacao: string | null }[];
}

type StatusKey = 0 | 1 | 2 | 3 | 4 | string;
type UrgenciaKey = 0 | 1 | 2 | 3 | string;

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

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    "Rascunho": { label: "Rascunho", color: "bg-zinc-400/15 text-zinc-600", icon: FileText },
    "PendenteAprovacao": { label: "Pendente", color: "bg-amber-500/15 text-amber-700", icon: Clock },
    "Aprovada": { label: "Aprovada", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    "Reprovada": { label: "Reprovada", color: "bg-red-500/15 text-red-700", icon: XCircle },
    "AjustesNecessarios": { label: "Ajustes", color: "bg-orange-500/15 text-orange-700", icon: AlertTriangle },
    "PendenteAprovacaoRh": { label: "Aguarda RH", color: "bg-purple-500/15 text-purple-700", icon: Clock },
    "Cancelada": { label: "Cancelada", color: "bg-zinc-500/15 text-zinc-500", icon: XCircle },
    // fallback numérico para compatibilidade
    0: { label: "Rascunho", color: "bg-zinc-400/15 text-zinc-600", icon: FileText },
    1: { label: "Pendente", color: "bg-amber-500/15 text-amber-700", icon: Clock },
    2: { label: "Aprovada", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    3: { label: "Reprovada", color: "bg-red-500/15 text-red-700", icon: XCircle },
    4: { label: "Ajustes", color: "bg-orange-500/15 text-orange-700", icon: AlertTriangle },
    5: { label: "Aguarda RH", color: "bg-purple-500/15 text-purple-700", icon: Clock },
    6: { label: "Cancelada", color: "bg-zinc-500/15 text-zinc-500", icon: XCircle },
};

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
    const s = STATUS_MAP[status] ?? STATUS_MAP["Rascunho"];
    const Icon = s.icon;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.color}`}>
            <Icon className="size-3" />
            {s.label}
        </span>
    );
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

/* ──────────────────────────── component ──────────────────────────── */

/* ══════════════════════════════════════════════════════════════
   Wrapper com tabs: Vagas | Promoções | Desligamentos
   ══════════════════════════════════════════════════════════════ */

type TopTab = "vagas" | "promocoes" | "desligamentos";

const TOP_TABS: { id: TopTab; label: string; icon: React.ElementType }[] = [
    { id: "vagas", label: "Requisição de Pessoal", icon: Briefcase },
    { id: "promocoes", label: "Movimentação de Pessoal", icon: TrendingUp },
    { id: "desligamentos", label: "Desligamento", icon: UserMinus },
];

export default function SolicitacoesScreen() {
    const searchParams = useSearchParams();
    const initialTab = (searchParams.get("tab") as TopTab | null) ?? "vagas";
    const validTabs: TopTab[] = ["vagas", "promocoes", "desligamentos"];
    const [topTab, setTopTab] = useState<TopTab>(validTabs.includes(initialTab) ? initialTab : "vagas");

    return (
        <section className="space-y-4">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">Solicitações</h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                    Gerencie solicitações de vagas, promoções e desligamentos
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
            {topTab === "promocoes" && <PromocoesScreen />}
            {topTab === "desligamentos" && <DesligamentosScreen />}
        </section>
    );
}

function SolicitacoesVagaContent() {
    const { me } = useAuth();
    const router = useRouter();
    const isAdmin = me?.roles?.some((r: string) => r.toLowerCase() === "admin" || r.toLowerCase() === "administrador") ?? false;

    /* ── data ── */
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<SolicitacaoGridRow[]>([]);
    const [pendingRows, setPendingRows] = useState<SolicitacaoGridRow[]>([]);

    /* ── filters ── */
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [viewMode, setViewModeRaw] = useState<"list" | "kanban">(() => {
        if (typeof window === "undefined") return "list";
        return (localStorage.getItem("renderrh.solicitacoes.viewMode") as "list" | "kanban") || "list";
    });
    const setViewMode = (m: "list" | "kanban") => { setViewModeRaw(m); localStorage.setItem("renderrh.solicitacoes.viewMode", m); };

    /* ── form modal ── */
    const [formOpen, setFormOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [viewId, setViewId] = useState<string | null>(null);
    const [resubmit, setResubmit] = useState(false);
    const [copySourceId, setCopySourceId] = useState<string | null>(null);

    /* ── timeline modal ── */
    const [timelineOpen, setTimelineOpen] = useState(false);
    const [timelineSteps, setTimelineSteps] = useState<AprovacaoStep[]>([]);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [timelineStatus, setTimelineStatus] = useState<number | string | null>(null);

    /* ── detail dialog ── */
    const [detailOpen, setDetailOpen] = useState(false);
    const [detail, setDetail] = useState<SolicitacaoDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    /* ── delete confirm ── */
    const [deleteTarget, setDeleteTarget] = useState<SolicitacaoGridRow | null>(null);


    /* ── approval actions ── */
    const [approvalObs, setApprovalObs] = useState("");

    /* ── next step banner after approval ── */
    const [lastApproved, setLastApproved] = useState<{ id: string; titulo: string } | null>(null);

    /* ── resolve meu funcionarioId para filtrar aprovações ── */
    const [myFuncionarioId, setMyFuncionarioId] = useState<string | null>(null);

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
            fetchJson<SolicitacaoGridRow[]>(`${API}?apenasMeus=true`),
            fetchJson<SolicitacaoGridRow[]>(API).catch(() => []),
        ]);
        setRows(Array.isArray(myData) ? myData : []);
        const allItems = Array.isArray(allData) ? allData : [];
        const isPendente = (s: number | string) => s === 1 || s === "PendenteAprovacao";
        const pending = funcId
            ? allItems.filter((r) => isPendente(r.status) && r.aprovadorId === funcId)
            : allItems.filter((r) => isPendente(r.status));
        setPendingRows(pending);
    }, [myFuncionarioId]);

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
            if (statusFilter !== "all" && String(r.status) !== statusFilter) return false;
            if (!term) return true;
            const blob = [r.titulo, r.solicitanteNome, r.areaName].filter(Boolean).join(" ").toLowerCase();
            return blob.includes(term);
        });
    }, [q, rows, statusFilter]);

    /* ── KPIs ── */
    const kpis = useMemo(() => {
        const src = rows;
        const total = src.length;
        const pendentes = src.filter((r) => r.status === 1 || r.status === "PendenteAprovacao").length;
        const aprovadas = src.filter((r) => r.status === 2 || r.status === "Aprovada").length;
        const reprovadas = src.filter((r) => r.status === 3 || r.status === "Reprovada").length;
        return { total, pendentes, aprovadas, reprovadas };
    }, [rows]);

    /* ── actions ── */
    function openNew() {
        setViewId(null);
        setEditId(null);
        setResubmit(false);
        setFormOpen(true);
    }

    function openEdit(row: SolicitacaoGridRow) {
        setViewId(null);
        setEditId(row.id);
        setResubmit(false);
        setFormOpen(true);
    }

    function openEditForApproval(row: SolicitacaoGridRow) {
        setViewId(null);
        setEditId(row.id);
        setResubmit(true);
        setFormOpen(true);
    }

    function openView(row: SolicitacaoGridRow) {
        setViewId(row.id);
        setEditId(null);
        setResubmit(false);
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
            // Prefer etapasFluxo (new format) over etapas (legacy)
            const STATUS_NUM_TO_STR: Record<number, string> = { 0: "Pendente", 1: "Aprovado", 2: "Reprovado", 3: "Cancelado" };
            const etapas: EtapaAprovacaoResponse[] = d.etapasFluxo?.length
                ? d.etapasFluxo.map(e => ({
                    ordem: e.ordem,
                    label: e.label,
                    aprovadorId: null,
                    aprovadorNome: e.aprovadorNome,
                    roleFilaId: null,
                    roleFilaNome: e.roleNome,
                    status: STATUS_NUM_TO_STR[e.status] ?? "Pendente",
                    dataUtc: e.dataUtc,
                    observacao: e.observacao,
                }))
                : (d.etapas ?? []);
            setTimelineSteps(
                mapEtapasToSteps(etapas, d.solicitanteNome, d.createdAtUtc)
            );
        } catch {
            toast.error("Falha ao carregar acompanhamento.");
            setTimelineOpen(false);
        } finally {
            setTimelineLoading(false);
        }
    }

    async function openDetail(row: SolicitacaoGridRow) {
        setDetailOpen(true);
        setDetailLoading(true);
        setApprovalObs("");
        try {
            const d = await fetchJson<SolicitacaoDetail>(`${API}/${row.id}`);
            setDetail(d);
        } catch {
            toast.error("Falha ao carregar detalhes.");
            setDetailOpen(false);
        } finally {
            setDetailLoading(false);
        }
    }

    async function cancelSolicitacao(id: string) {
        if (!(await confirmDialog({ title: "Cancelar solicitação", description: "Tem certeza que deseja cancelar esta solicitação? Esta ação não pode ser desfeita.", confirmText: "Cancelar solicitação", destructive: true }))) return;
        try {
            await fetchJson(`${API}/${id}/cancel`, { method: "POST" });
            toast.success("Solicitação cancelada.");
            await syncList();
            setDetailOpen(false);
        } catch (e) {
            toast.error(`Falha ao cancelar: ${e instanceof Error ? e.message : "erro"}`);
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
        setResubmit(false);
        setCopySourceId(null);
    }

    function handleFormSaved() {
        setFormOpen(false);
        setViewId(null);
        setResubmit(false);
        setCopySourceId(null);
        syncList().catch(() => { });
    }

    /* ──────────────────────────── render ──────────────────────────── */
    return (
        <div className="space-y-4">
            {/* ── actions ── */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-muted-foreground">Solicite novas vagas e acompanhe aprovações</div>
                <div className="flex flex-wrap items-center gap-2">
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
                    <Button size="sm" onClick={openNew}>
                        <Plus className="size-4" />
                        <span className="hidden sm:inline">Nova solicitação</span>
                    </Button>
                </div>
            </div>

            {/* Ao aprovar, troca direto para aba triagem */}

            {/* ── KPIs ── */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    { label: "Total", value: kpis.total, color: "text-primary" },
                    { label: "Pendentes", value: kpis.pendentes, color: "text-amber-600" },
                    { label: "Aprovadas", value: kpis.aprovadas, color: "text-emerald-600" },
                    { label: "Reprovadas", value: kpis.reprovadas, color: "text-red-600" },
                ].map((k) => (
                    <div
                        key={k.label}
                        className="rounded-xl border border-border/40 bg-card p-4 shadow-sm"
                    >
                        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                            {k.label}
                        </div>
                        <div className={`mt-1 text-2xl font-bold ${k.color}`}>
                            {k.value}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── filters + table ── */}
            <div className="rounded-xl border border-border/40 bg-card p-4 shadow-sm">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div className="font-semibold">Minhas solicitações</div>
                        <div className="text-muted-foreground text-sm">
                            {loading ? "Carregando…" : `${filtered.length} solicitações`}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[220px] flex-1">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="pl-9"
                                placeholder="Buscar título, área…"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                            />
                        </div>
                        <select
                            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">Todos status</option>
                            <option value="Rascunho">Rascunho</option>
                            <option value="PendenteAprovacao">Pendente</option>
                            <option value="Aprovada">Aprovada</option>
                            <option value="Reprovada">Reprovada</option>
                        </select>
                        <div className="flex items-center rounded-md border border-input bg-background p-0.5">
                            <button type="button" className={`inline-flex items-center justify-center rounded-sm px-2 py-1 text-xs transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setViewMode("list")} title="Lista"><List className="size-3.5" /></button>
                            <button type="button" className={`inline-flex items-center justify-center rounded-sm px-2 py-1 text-xs transition-colors ${viewMode === "kanban" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setViewMode("kanban")} title="Kanban"><Columns3 className="size-3.5" /></button>
                        </div>
                    </div>
                </div>

                {viewMode === "list" ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Posições</TableHead>
                            <TableHead>Urgência</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Aguardando</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                    Carregando…
                                </TableCell>
                            </TableRow>
                        ) : filtered.length ? (
                            filtered.map((r) => (
                                <TableRow key={r.id} className="hover:bg-muted/40">
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-semibold">{r.titulo}</span>
                                            {r.isConfidencial && (
                                                <span title="Vaga Confidencial"><Lock className="size-3.5 text-amber-600" /></span>
                                            )}
                                        </div>
                                        {r.substituidoNome && (
                                            <div className="text-muted-foreground text-xs flex items-center gap-1">
                                                <UserMinus className="size-3" /> Substituindo: {r.substituidoNome}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${r.tipoSolicitacao === 1 ? "bg-blue-500/15 text-blue-700" : "bg-sky-500/15 text-sky-700"}`}>
                                            {r.tipoSolicitacao === 1 ? "Substituição" : "Nova"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-sm font-mono">{r.qtdPosicoes}</TableCell>
                                    <TableCell>{urgenciaBadge(r.urgencia)}</TableCell>
                                    <TableCell>{statusBadge(r.status)}</TableCell>
                                    <TableCell>
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
                                    <TableCell className="text-sm text-muted-foreground">{formatDate(r.createdAtUtc)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                            {/* Rascunho: editar, enviar, excluir */}
                                            {(r.status === 0 || r.status === "Rascunho") && (
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
                                            {(r.status === 4 || r.status === "AjustesNecessarios") && (
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
                                            {(r.status === 1 || r.status === "PendenteAprovacao") && (
                                                <>
                                                    <Button variant="outline" size="icon-xs" title="Editar e reenviar" onClick={() => openEditForApproval(r)}>
                                                        <Pencil />
                                                    </Button>
                                                    <Button variant="outline" size="icon-xs" title="Cancelar solicitação" className="hover:text-red-600 hover:border-red-300" onClick={() => void cancelSolicitacao(r.id)}>
                                                        <Ban />
                                                    </Button>
                                                </>
                                            )}
                                            {/* Aprovada/Reprovada/AguardaRH: visualizar */}
                                            {(r.status === 2 || r.status === "Aprovada" ||
                                              r.status === 3 || r.status === "Reprovada" ||
                                              r.status === 5 || r.status === "PendenteAprovacaoRh") && (
                                                <Button variant="outline" size="icon-xs" title="Visualizar" onClick={() => openView(r)}>
                                                    <Eye />
                                                </Button>
                                            )}
                                            {/* Copiar: todas as linhas */}
                                            <Button variant="outline" size="icon-xs" title="Copiar vaga" onClick={() => { setCopySourceId(r.id); setEditId(null); setViewId(null); setResubmit(false); setFormOpen(true); }}>
                                                <Copy className="size-3.5" />
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
                                    Nenhuma solicitação ainda. Crie sua primeira solicitação de vaga para iniciar o processo.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
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
                                    const meta = STATUS_MAP[col];
                                    const Icon = meta.icon;
                                    const colItems = filtered.filter((r) => String(r.status) === col);
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
                                                        <div className="mt-2 text-[10px] text-muted-foreground">{formatDate(r.createdAtUtc)}</div>
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
                onClose={handleFormClose}
                onSaved={handleFormSaved}
                viewOnly={!!viewId}
                resubmitAfterSave={resubmit}
                copySourceId={copySourceId}
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
                        <DialogTitle>Detalhes da Solicitação</DialogTitle>
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
                                    <div className="text-xs text-muted-foreground uppercase">Título</div>
                                    <div className="font-semibold">{detail.titulo}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Status</div>
                                    <div className="mt-0.5">{statusBadge(detail.status)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Área</div>
                                    <div className="text-sm">{detail.areaName || "—"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Cargo</div>
                                    <div className="text-sm">{detail.jobPositionName || "—"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Unidade</div>
                                    <div className="text-sm">{detail.unitName || "—"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Posições</div>
                                    <div className="text-sm font-mono">{detail.qtdPosicoes}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Urgência</div>
                                    <div className="mt-0.5">{urgenciaBadge(detail.urgencia)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Solicitante</div>
                                    <div className="text-sm">{detail.solicitanteNome || "—"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Aprovador</div>
                                    <div className="text-sm">{detail.aprovadorNome || "—"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Data criação</div>
                                    <div className="text-sm">{formatDate(detail.createdAtUtc)}</div>
                                </div>
                            </div>

                            {detail.justificativa && (
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Justificativa</div>
                                    <div className="mt-1 text-sm rounded-md bg-muted/30 p-3">{detail.justificativa}</div>
                                </div>
                            )}

                            {detail.aprovador3Habilitado && (
                                <div className="rounded-md border border-purple-200 bg-purple-50/60 dark:bg-purple-950/20 dark:border-purple-800 p-3 text-sm">
                                    <div className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider mb-1">Etapa de Aprovação RH</div>
                                    <div className="text-purple-800 dark:text-purple-300">
                                        {detail.aprovador3Nome || "Qualquer recrutador"} —{" "}
                                        {detail.aprovador3Status === 1 || detail.aprovador3Status === "Aprovado"
                                            ? "✓ Aprovado"
                                            : detail.aprovador3Status === 2 || detail.aprovador3Status === "Reprovado"
                                                ? "✗ Reprovado"
                                                : "⏳ Aguardando"}
                                    </div>
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

                            {/* ── Approval actions (only for Admin when status=Pendente) ── */}
                            {(detail.status === 1 || detail.status === "PendenteAprovacao") && isAdmin && (
                                <div className="space-y-3 rounded-lg border border-border/60 p-3">
                                    <div className="text-sm font-semibold">Ações de aprovação</div>
                                    <textarea
                                        className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground"
                                        rows={2}
                                        placeholder="Observação (opcional)..."
                                        value={approvalObs}
                                        onChange={(e) => setApprovalObs(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <Button size="sm" className="btn-approve" onClick={() => void doApproval(detail.id, "approve")}>
                                            <CheckCircle2 className="size-4" /> Aprovar
                                        </Button>
                                        <Button size="sm" className="btn-reject" onClick={() => void doApproval(detail.id, "reject")}>
                                            <XCircle className="size-4" /> Reprovar
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* ── Submit action (only for Rascunho or Ajustes) ── */}
                            {(detail.status === 0 || detail.status === "Rascunho") && (
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => void submitForApproval(detail.id)}>
                                        <Send className="size-4" /> Enviar para aprovação
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => { setDetailOpen(false); setEditId(detail.id); setFormOpen(true); }}>
                                        <Pencil className="size-4" /> Editar
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-red-600 hover:border-red-300" onClick={() => void cancelSolicitacao(detail.id)}>
                                        <Ban className="size-4" /> Cancelar
                                    </Button>
                                </div>
                            )}
                            {/* ── Cancelar (pendente) ── */}
                            {(detail.status === 1 || detail.status === "PendenteAprovacao") && (
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" onClick={() => { setDetailOpen(false); setEditId(detail.id); setResubmit(true); setFormOpen(true); }}>
                                        <Pencil className="size-4" /> Editar e reenviar
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-red-600 hover:border-red-300" onClick={() => void cancelSolicitacao(detail.id)}>
                                        <Ban className="size-4" /> Cancelar
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : null}
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
