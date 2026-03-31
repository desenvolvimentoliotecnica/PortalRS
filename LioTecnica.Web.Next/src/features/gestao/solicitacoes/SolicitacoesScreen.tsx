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
    Columns3,
    List,
    XCircle,
    AlertTriangle,
    FileText,
    Lock,
    UserMinus,
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

import SolicitacaoFormModal from "./SolicitacaoFormModal";
import NextStepBanner from "@/components/feedback/NextStepBanner";

/* ──────────────────────────── types ──────────────────────────── */

interface SolicitacaoGridRow {
    id: string;
    titulo: string;
    urgencia: number;
    status: number;
    solicitanteNome: string | null;
    areaName: string | null;
    qtdPosicoes: number;
    tipoSolicitacao: number;
    isConfidencial: boolean;
    substituidoNome: string | null;
    createdAtUtc: string;
}

interface SolicitacaoDetail {
    id: string;
    titulo: string;
    justificativa: string | null;
    qtdPosicoes: number;
    urgencia: number;
    status: number;
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
}

type StatusKey = 0 | 1 | 2 | 3 | 4;
type UrgenciaKey = 0 | 1 | 2 | 3;

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

const STATUS_MAP: Record<StatusKey, { label: string; color: string; icon: React.ElementType }> = {
    0: { label: "Rascunho", color: "bg-zinc-400/15 text-zinc-600", icon: FileText },
    1: { label: "Pendente", color: "bg-amber-500/15 text-amber-700", icon: Clock },
    2: { label: "Aprovada", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    3: { label: "Reprovada", color: "bg-red-500/15 text-red-700", icon: XCircle },
    4: { label: "Ajustes", color: "bg-orange-500/15 text-orange-700", icon: AlertTriangle },
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

export default function SolicitacoesScreen() {
    const { me } = useAuth();
    const isAdmin = me?.roles?.some((r: string) => r.toLowerCase() === "admin") ?? false;

    /* ── tab ── */
    const [activeTab, setActiveTab] = useState<"minhas" | "aprovacoes">("minhas");

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

    /* ── data loading ── */
    const syncList = useCallback(async () => {
        const [allData, pendingData] = await Promise.all([
            fetchJson<SolicitacaoGridRow[]>(API),
            isAdmin ? fetchJson<SolicitacaoGridRow[]>(`${API}?status=1`) : Promise.resolve([]),
        ]);
        setRows(Array.isArray(allData) ? allData : []);
        setPendingRows(Array.isArray(pendingData) ? pendingData : []);
    }, [isAdmin]);

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
        const total = rows.length;
        const pendentes = rows.filter((r) => r.status === 1).length;
        const aprovadas = rows.filter((r) => r.status === 2).length;
        const reprovadas = rows.filter((r) => r.status === 3).length;
        return { total, pendentes, aprovadas, reprovadas };
    }, [rows]);

    /* ── actions ── */
    function openNew() {
        setEditId(null);
        setFormOpen(true);
    }

    function openEdit(row: SolicitacaoGridRow) {
        setEditId(row.id);
        setFormOpen(true);
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
            if (action === "approve" && detail) {
                setLastApproved({ id: detail.id, titulo: detail.titulo });
            }
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

    function handleFormSaved() {
        setFormOpen(false);
        syncList().catch(() => { });
    }

    /* ──────────────────────────── render ──────────────────────────── */
    return (
        <section className="space-y-4">
            {/* ── header ── */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Solicitações de Vaga</h4>
                    <div className="text-muted-foreground text-sm">
                        Solicite novas vagas e acompanhe aprovações
                    </div>
                </div>
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

            {/* ── next step banner ── */}
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
                        className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur"
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

            {/* ── tabs ── */}
            <div className="flex gap-1 border-b border-border/40">
                <button
                    onClick={() => setActiveTab("minhas")}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === "minhas" ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                    Minhas Solicitações
                </button>
                {isAdmin && (
                    <button
                        onClick={() => setActiveTab("aprovacoes")}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === "aprovacoes" ? "border-blue-600 text-blue-600" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                        Aprovações Pendentes
                        {pendingRows.length > 0 && (
                            <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold min-w-[20px] h-5 px-1.5">
                                {pendingRows.length}
                            </span>
                        )}
                    </button>
                )}
            </div>

            {/* ── filters + table ── */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div className="font-semibold">{activeTab === "minhas" ? "Minhas solicitações" : "Aprovações pendentes"}</div>
                        <div className="text-muted-foreground text-sm">
                            {loading ? "Carregando…" : `${activeTab === "minhas" ? filtered.length : pendingRows.length} solicitações`}
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
                            <option value="0">Rascunho</option>
                            <option value="1">Pendente</option>
                            <option value="2">Aprovada</option>
                            <option value="3">Reprovada</option>
                            <option value="4">Ajustes</option>
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
                            <TableHead>Área</TableHead>
                            <TableHead>Posições</TableHead>
                            <TableHead>Urgência</TableHead>
                            <TableHead>Status</TableHead>
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
                        ) : (activeTab === "minhas" ? filtered : pendingRows).length ? (
                            (activeTab === "minhas" ? filtered : pendingRows).map((r) => (
                                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => void openDetail(r)}>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-semibold">{r.titulo}</span>
                                            {r.isConfidencial && (
                                                <span title="Vaga Confidencial"><Lock className="size-3.5 text-amber-600" /></span>
                                            )}
                                        </div>
                                        {r.solicitanteNome && (
                                            <div className="text-muted-foreground text-xs">{r.solicitanteNome}</div>
                                        )}
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
                                    <TableCell className="text-sm">{r.areaName || "—"}</TableCell>
                                    <TableCell className="text-sm font-mono">{r.qtdPosicoes}</TableCell>
                                    <TableCell>{urgenciaBadge(r.urgencia)}</TableCell>
                                    <TableCell>{statusBadge(r.status)}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{formatDate(r.createdAtUtc)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                            <Button variant="outline" size="icon-xs" title="Detalhes" onClick={() => void openDetail(r)}>
                                                <Eye />
                                            </Button>
                                            {(r.status === 0 || r.status === 4) && (
                                                <>
                                                    <Button variant="outline" size="icon-xs" title="Editar" onClick={() => openEdit(r)}>
                                                        <Pencil />
                                                    </Button>
                                                    <Button variant="outline" size="icon-xs" title="Enviar para aprovação" onClick={() => void submitForApproval(r.id)}>
                                                        <Send />
                                                    </Button>
                                                </>
                                            )}
                                            {r.status === 0 && (
                                                <Button variant="destructive" size="icon-xs" title="Excluir" onClick={() => setDeleteTarget(r)}>
                                                    <Trash2 />
                                                </Button>
                                            )}
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
                                {([0, 1, 2, 3, 4] as const).map((col) => {
                                    const meta = STATUS_MAP[col as StatusKey];
                                    const Icon = meta.icon;
                                    const sourceRows = activeTab === "minhas" ? filtered : pendingRows;
                                    const colItems = sourceRows.filter((r) => r.status === col);
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
                                                        className="rounded-lg border border-border/50 bg-card p-3 shadow-sm cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
                                                        onClick={() => void openDetail(r)}
                                                    >
                                                        <div className="text-sm font-medium leading-tight truncate">{r.titulo}</div>
                                                        {r.solicitanteNome && <div className="mt-1 text-[11px] text-muted-foreground">{r.solicitanteNome}</div>}
                                                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                                            {r.areaName && <span>{r.areaName}</span>}
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
                editId={editId}
                onClose={() => setFormOpen(false)}
                onSaved={handleFormSaved}
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

                            {detail.observacaoAprovador && (
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Observação do Aprovador</div>
                                    <div className="mt-1 text-sm rounded-md bg-amber-500/10 p-3 border border-amber-500/20">
                                        {detail.observacaoAprovador}
                                    </div>
                                </div>
                            )}

                            {/* ── Approval actions (only for Admin when status=1 Pendente) ── */}
                            {detail.status === 1 && isAdmin && (
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
                                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void doApproval(detail.id, "approve")}>
                                            <CheckCircle2 className="size-4" /> Aprovar
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

                            {/* ── Submit action (only for status=0 Rascunho or status=4 Ajustes) ── */}
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
        </section>
    );
}
