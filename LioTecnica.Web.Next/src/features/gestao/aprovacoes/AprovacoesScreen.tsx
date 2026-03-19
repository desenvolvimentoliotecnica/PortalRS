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
} from "@/components/ui/dialog";

/* ──────────────────────────── types ──────────────────────────── */

interface SolicitacaoGridRow {
    id: string;
    titulo: string;
    urgencia: number;
    status: number;
    solicitanteNome: string | null;
    areaName: string | null;
    qtdPosicoes: number;
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
    // Sprint 1
    tipoSolicitacao: number;
    isConfidencial: boolean;
    substituidoNome: string | null;
    // Sprint 2 — Approval Chain
    aprovador1Id: string | null;
    aprovador1Nome: string | null;
    aprovador1Status: number;
    aprovador1DataUtc: string | null;
    aprovador2Id: string | null;
    aprovador2Nome: string | null;
    aprovador2Status: number | null;
    aprovador2DataUtc: string | null;
    aprovador2Habilitado: boolean;
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
        return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
        return "—";
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

/* ──────────────────────────── component ──────────────────────────── */

export default function AprovacoesScreen() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<SolicitacaoGridRow[]>([]);
    const [q, setQ] = useState("");

    /* ── detail / approval ── */
    const [detailOpen, setDetailOpen] = useState(false);
    const [detail, setDetail] = useState<SolicitacaoDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [approvalObs, setApprovalObs] = useState("");
    const [acting, setActing] = useState(false);

    /* ── data loading — only pending (status=1) ── */
    const syncList = useCallback(async () => {
        const data = await fetchJson<SolicitacaoGridRow[]>(`${API}?status=1`);
        setRows(Array.isArray(data) ? data : []);
    }, []);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        syncList()
            .catch((e) => toast.error(`Falha ao carregar: ${e instanceof Error ? e.message : "erro"}`))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [syncList]);

    /* ── filtering ── */
    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (!term) return rows;
        return rows.filter((r) => {
            const blob = [r.titulo, r.solicitanteNome, r.areaName].filter(Boolean).join(" ").toLowerCase();
            return blob.includes(term);
        });
    }, [q, rows]);

    /* ── actions ── */
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

    async function doAction(id: string, action: "approve" | "reject" | "request-changes") {
        const labels = { approve: "Aprovada", reject: "Reprovada", "request-changes": "Ajustes solicitados" };
        setActing(true);
        try {
            await fetchJson(`${API}/${id}/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ observacao: approvalObs || null }),
            });
            toast.success(`Solicitação: ${labels[action]}!`);
            setDetailOpen(false);
            await syncList();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setActing(false);
        }
    }

    /* ──────────────────────────── render ──────────────────────────── */
    return (
        <section className="space-y-4">
            {/* ── header ── */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Aprovações Pendentes</h4>
                    <div className="text-muted-foreground text-sm">
                        Solicitações de vaga aguardando sua análise
                    </div>
                </div>
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
            </div>

            {/* ── KPI ── */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-amber-500/15 p-3">
                        <Clock className="size-6 text-amber-600" />
                    </div>
                    <div>
                        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                            Pendentes de aprovação
                        </div>
                        <div className="text-3xl font-bold text-amber-600">
                            {loading ? "…" : rows.length}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── filters + table ── */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div className="font-semibold">Solicitações pendentes</div>
                        <div className="text-muted-foreground text-sm">
                            {loading ? "Carregando…" : `${filtered.length} solicitações`}
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="w-[260px] pl-8"
                            placeholder="Buscar título, solicitante, área…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Solicitante</TableHead>
                            <TableHead>Área</TableHead>
                            <TableHead>Posições</TableHead>
                            <TableHead>Urgência</TableHead>
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
                                    <TableCell className="font-semibold">{r.titulo}</TableCell>
                                    <TableCell className="text-sm">{r.solicitanteNome || "—"}</TableCell>
                                    <TableCell className="text-sm">{r.areaName || "—"}</TableCell>
                                    <TableCell className="text-sm font-mono">{r.qtdPosicoes}</TableCell>
                                    <TableCell>{urgenciaBadge(r.urgencia)}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{formatDate(r.createdAtUtc)}</TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="icon-xs" title="Ver detalhes" onClick={() => void openDetail(r)}>
                                                <Eye />
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="bg-emerald-600 hover:bg-emerald-700 h-7 px-2 text-xs"
                                                onClick={() => {
                                                    setApprovalObs("");
                                                    void doAction(r.id, "approve");
                                                }}
                                            >
                                                <CheckCircle2 className="size-3" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-red-600 border-red-300 hover:bg-red-50 h-7 px-2 text-xs"
                                                onClick={() => {
                                                    setApprovalObs("");
                                                    void doAction(r.id, "reject");
                                                }}
                                            >
                                                <XCircle className="size-3" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                                    🎉 Nenhuma aprovação pendente!
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* ── Detail + Approval Dialog ── */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Analisar Solicitação</DialogTitle>
                        <DialogDescription>Revise os detalhes e tome uma ação.</DialogDescription>
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
                                    <div className="text-xs text-muted-foreground uppercase">Solicitante</div>
                                    <div className="text-sm">{detail.solicitanteNome || "—"}</div>
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
                                    <div className="text-xs text-muted-foreground uppercase">Data criação</div>
                                    <div className="text-sm">{formatDate(detail.createdAtUtc)}</div>
                                </div>
                            </div>

                            {detail.justificativa && (
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Justificativa do Solicitante</div>
                                    <div className="mt-1 text-sm rounded-md bg-muted/30 p-3">{detail.justificativa}</div>
                                </div>
                            )}

                            {/* ── Sprint 1 Info ── */}
                            <div className="grid grid-cols-3 gap-3 rounded-lg border border-border/30 p-3">
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Tipo</div>
                                    <div className="text-sm font-medium">{detail.tipoSolicitacao === 1 ? "Substituição" : "Vaga Nova"}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Confidencial</div>
                                    <div className="text-sm">{detail.isConfidencial ? "🔒 Sim" : "Não"}</div>
                                </div>
                                {detail.substituidoNome && (
                                    <div>
                                        <div className="text-xs text-muted-foreground uppercase">Substituído</div>
                                        <div className="text-sm">{detail.substituidoNome}</div>
                                    </div>
                                )}
                            </div>

                            {/* ── Approval Chain (Sprint 2) ── */}
                            <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                                <div className="text-sm font-semibold text-primary">Cadeia de Aprovação</div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">1ª Aprovação</span>
                                            <span className="text-muted-foreground">(obrigatória)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm">{detail.aprovador1Nome || "Aguardando"}</span>
                                            {approvalChainBadge(detail.aprovador1Status)}
                                        </div>
                                    </div>
                                    {detail.aprovador1DataUtc && (
                                        <div className="text-xs text-muted-foreground ml-4">{formatDate(detail.aprovador1DataUtc)}</div>
                                    )}
                                    {detail.aprovador2Habilitado && (
                                        <>
                                            <div className="flex items-center justify-between text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">2ª Aprovação</span>
                                                    <span className="text-muted-foreground">(opcional)</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm">{detail.aprovador2Nome || "Aguardando"}</span>
                                                    {detail.aprovador2Status != null && approvalChainBadge(detail.aprovador2Status)}
                                                </div>
                                            </div>
                                            {detail.aprovador2DataUtc && (
                                                <div className="text-xs text-muted-foreground ml-4">{formatDate(detail.aprovador2DataUtc)}</div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* ── Approval actions ── */}
                            {detail.status === 1 && (
                                <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                                    <div className="text-sm font-semibold text-amber-700">Sua decisão</div>
                                    <textarea
                                        className="w-full rounded-md border border-input bg-transparent p-2 text-sm placeholder:text-muted-foreground"
                                        rows={2}
                                        placeholder="Observação (opcional)..."
                                        value={approvalObs}
                                        onChange={(e) => setApprovalObs(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            disabled={acting}
                                            className="bg-emerald-600 hover:bg-emerald-700"
                                            onClick={() => void doAction(detail.id, "approve")}
                                        >
                                            <CheckCircle2 className="size-4" /> Aprovar
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={acting}
                                            className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                            onClick={() => void doAction(detail.id, "request-changes")}
                                        >
                                            <AlertTriangle className="size-4" /> Pedir Ajustes
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={acting}
                                            className="text-red-600 border-red-300 hover:bg-red-50"
                                            onClick={() => void doAction(detail.id, "reject")}
                                        >
                                            <XCircle className="size-4" /> Reprovar
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* ── Already acted ── */}
                            {detail.status !== 1 && (
                                <div className="rounded-md bg-muted/30 p-3 text-sm text-muted-foreground">
                                    Esta solicitação já foi processada.
                                </div>
                            )}
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
        </section>
    );
}
