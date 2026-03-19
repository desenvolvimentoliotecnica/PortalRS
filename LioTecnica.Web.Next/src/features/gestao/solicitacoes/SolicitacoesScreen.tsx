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

    /* ── data ── */
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<SolicitacaoGridRow[]>([]);

    /* ── filters ── */
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

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

    /* ── data loading ── */
    const syncList = useCallback(async () => {
        const data = await fetchJson<SolicitacaoGridRow[]>(API);
        setRows(Array.isArray(data) ? data : []);
    }, []);

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
                        variant="ghost"
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
                        <div className="font-semibold">Minhas solicitações</div>
                        <div className="text-muted-foreground text-sm">
                            {loading ? "Carregando…" : `${filtered.length} solicitações`}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="w-[240px] pl-8"
                                placeholder="Buscar título, área…"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                            />
                        </div>
                        <select
                            className="form-select h-9 rounded-md border border-input bg-transparent px-3 text-sm"
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
                    </div>
                </div>

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
                        ) : filtered.length ? (
                            filtered.map((r) => (
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
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${r.tipoSolicitacao === 1 ? "bg-violet-500/15 text-violet-700" : "bg-sky-500/15 text-sky-700"}`}>
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
                                            <Button variant="ghost" size="icon-xs" title="Detalhes" onClick={() => void openDetail(r)}>
                                                <Eye />
                                            </Button>
                                            {(r.status === 0 || r.status === 4) && (
                                                <>
                                                    <Button variant="ghost" size="icon-xs" title="Editar" onClick={() => openEdit(r)}>
                                                        <Pencil />
                                                    </Button>
                                                    <Button variant="ghost" size="icon-xs" title="Enviar para aprovação" onClick={() => void submitForApproval(r.id)}>
                                                        <Send />
                                                    </Button>
                                                </>
                                            )}
                                            {r.status === 0 && (
                                                <Button variant="ghost" size="icon-xs" className="text-destructive" title="Excluir" onClick={() => setDeleteTarget(r)}>
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
                                    Nenhuma solicitação encontrada.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
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
                                        className="w-full rounded-md border border-input bg-transparent p-2 text-sm placeholder:text-muted-foreground"
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
