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
    Users,
    Activity,
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

import DesligamentoFormModal from "./DesligamentoFormModal";
import AcompanhamentoModal, { AprovacaoStep } from "@/features/gestao/shared/AcompanhamentoModal";

/* ──────────────────────────── types ──────────────────────────── */

interface EtapaAprovacaoResponse {
    ordem: number;
    label: string;
    aprovadorId: string | null;
    aprovadorNome: string | null;
    roleFilaId: string | null;
    roleFilaNome: string | null;
    status: string; // "Pendente" | "Aprovado" | "Reprovado"
    dataUtc: string | null;
    observacao: string | null;
}

interface SolicitacaoDesligamentoGridRow {
    id: string;
    status: number;
    solicitanteNome: string | null;
    funcionarioNome: string | null;
    tipoDesligamento: number;
    dataDesligamento: string | null;
    createdAtUtc: string;
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
    aprovador1Nome: string | null;
    aprovador1Status: number | null;
    aprovador2Nome: string | null;
    aprovador2Status: number | null;
    aprovador2Habilitado: boolean;
    observacaoAprovador: string | null;
    observacoes: string | null;
    createdAtUtc: string;
    approvedAtUtc: string | null;
    etapas?: EtapaAprovacaoResponse[];
}

type StatusKey = 0 | 1 | 2 | 3 | 4 | 6;

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
    0: { label: "Rascunho", color: "bg-zinc-400/15 text-zinc-600", icon: FileText },
    1: { label: "Pendente", color: "bg-amber-500/15 text-amber-700", icon: Clock },
    2: { label: "Aprovada", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    3: { label: "Reprovada", color: "bg-red-500/15 text-red-700", icon: XCircle },
    4: { label: "Ajustes", color: "bg-orange-500/15 text-orange-700", icon: AlertTriangle },
    6: { label: "Aguarda Fila", color: "bg-violet-500/15 text-violet-700", icon: Users },
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

export default function DesligamentosScreen() {
    const { me } = useAuth();
    const isAdmin = me?.roles?.some((r: string) => r.toLowerCase() === "admin") ?? false;
    const myFuncionarioId = (me as { funcionarioId?: string } | null)?.funcionarioId;
    const myRoles: string[] = (me?.roles ?? []) as string[];

    /* ── data ── */
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<SolicitacaoDesligamentoGridRow[]>([]);

    /* ── filters ── */
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    /* ── form modal ── */
    const [formOpen, setFormOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [viewId, setViewId] = useState<string | null>(null);
    const [resubmit, setResubmit] = useState(false);

    /* ── timeline modal ── */
    const [timelineOpen, setTimelineOpen] = useState(false);
    const [timelineSteps, setTimelineSteps] = useState<AprovacaoStep[]>([]);
    const [timelineLoading, setTimelineLoading] = useState(false);

    /* ── detail dialog ── */
    const [detailOpen, setDetailOpen] = useState(false);
    const [detail, setDetail] = useState<SolicitacaoDesligamentoResponse | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    /* ── delete confirm ── */
    const [deleteTarget, setDeleteTarget] = useState<SolicitacaoDesligamentoGridRow | null>(null);

    /* ── approval actions ── */
    const [approvalObs, setApprovalObs] = useState("");

    /* ── data loading ── */
    const syncList = useCallback(async () => {
        const data = await fetchJson<SolicitacaoDesligamentoGridRow[]>(API);
        setRows(Array.isArray(data) ? data : []);
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
            if (statusFilter !== "all" && String(r.status) !== statusFilter) return false;
            if (!term) return true;
            const blob = [r.funcionarioNome, r.solicitanteNome].filter(Boolean).join(" ").toLowerCase();
            return blob.includes(term);
        });
    }, [q, rows, statusFilter]);

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
        try {
            const d = await fetchJson<SolicitacaoDesligamentoResponse>(`${API}/${row.id}`);
            const steps: AprovacaoStep[] = [
                {
                    label: "Criado",
                    nome: d.solicitanteNome,
                    status: 1,
                    habilitado: true,
                    date: d.createdAtUtc,
                },
                {
                    label: "Aprovação — Gestor",
                    nome: d.aprovador1Nome,
                    status: d.aprovador1Status,
                    habilitado: true,
                },
            ];
            if (d.aprovador2Habilitado) {
                steps.push({
                    label: "Aprovação — Nível 2",
                    nome: d.aprovador2Nome,
                    status: d.aprovador2Status,
                    habilitado: true,
                });
            }
            setTimelineSteps(steps);
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

        // Fallback to legacy aprovador check
        const d = detail as unknown as { aprovador1Id?: string; aprovador2Id?: string };
        const isAprov = d.aprovador1Id === myFuncionarioId || d.aprovador2Id === myFuncionarioId;
        return { canApprove: isAprov, isQueueStep: false, currentEtapa: null };
    }, [detail, me, isAdmin, myFuncionarioId, myRoles]);

    /* ──────────────────────────── render ──────────────────────────── */
    return (
        <section className="space-y-4">
            {/* ── header ── */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Solicitações de Desligamento</h4>
                    <div className="text-muted-foreground text-sm">
                        Gerencie solicitações de desligamento e acompanhe aprovações
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

            {/* ── filters + table ── */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div className="font-semibold">Solicitações de desligamento</div>
                        <div className="text-muted-foreground text-sm">
                            {loading ? "Carregando…" : `${filtered.length} solicitações`}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-[220px] flex-1">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="pl-9"
                                placeholder="Buscar funcionário…"
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
                            <option value="6">Aguarda Fila</option>
                        </select>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Funcionário</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Data Desligamento</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Data Criação</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                    Carregando…
                                </TableCell>
                            </TableRow>
                        ) : filtered.length ? (
                            filtered.map((r) => (
                                <TableRow key={r.id} className="hover:bg-muted/40">
                                    <TableCell>
                                        <div className="font-semibold">{r.funcionarioNome || "—"}</div>
                                        {r.solicitanteNome && (
                                            <div className="text-muted-foreground text-xs">Solicitante: {r.solicitanteNome}</div>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm">{TIPO_DESLIGAMENTO_MAP[r.tipoDesligamento] ?? "—"}</TableCell>
                                    <TableCell className="text-sm">{formatDate(r.dataDesligamento)}</TableCell>
                                    <TableCell>{statusBadge(r.status)}</TableCell>
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
                                            {/* Pendente: editar e reenviar */}
                                            {r.status === 1 && (
                                                <Button variant="outline" size="icon-xs" title="Editar e reenviar" onClick={() => openEditForApproval(r)}>
                                                    <Pencil />
                                                </Button>
                                            )}
                                            {/* Aprovada/Reprovada: visualizar */}
                                            {(r.status === 2 || r.status === 3) && (
                                                <Button variant="outline" size="icon-xs" title="Visualizar" onClick={() => openView(r)}>
                                                    <Eye />
                                                </Button>
                                            )}
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
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                    Nenhuma solicitação de desligamento encontrada.
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
                                ) : (
                                    /* Fallback to legacy view */
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="text-xs text-muted-foreground">Aprovador 1</div>
                                            <div className="text-sm font-medium">{detail.aprovador1Nome || "—"}</div>
                                            {detail.aprovador1Status != null && (
                                                <div className="mt-0.5">{statusBadge(detail.aprovador1Status)}</div>
                                            )}
                                        </div>
                                        {detail.aprovador2Habilitado && (
                                            <div>
                                                <div className="text-xs text-muted-foreground">Aprovador 2</div>
                                                <div className="text-sm font-medium">{detail.aprovador2Nome || "—"}</div>
                                                {detail.aprovador2Status != null && (
                                                    <div className="mt-0.5">{statusBadge(detail.aprovador2Status)}</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
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
