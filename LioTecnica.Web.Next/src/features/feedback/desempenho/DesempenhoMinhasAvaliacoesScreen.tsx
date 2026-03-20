"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardCheck, RefreshCw, Eye, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";

async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

interface Evaluation {
    id: string;
    title: string;
    cycle: string;
    status: string;
    score: number | null;
    dueDate: string;
    completedAtUtc: string | null;
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
    pending: { label: "Pendente", cls: "text-amber-600 bg-amber-100" },
    in_progress: { label: "Em andamento", cls: "text-blue-600 bg-blue-100" },
    completed: { label: "Concluída", cls: "text-green-600 bg-green-100" },
    expired: { label: "Expirada", cls: "text-red-600 bg-red-100" },
};

export default function DesempenhoMinhasAvaliacoesScreen() {
    const [loading, setLoading] = useState(true);
    const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
    const [detailId, setDetailId] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<Evaluation[]>("/api/desempenho/minhas-avaliacoes");
            setEvaluations(data ?? []);
        } catch { /* silent */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { void loadData(); }, [loadData]);

    function fmtDate(iso: string | null) {
        if (!iso) return "—";
        try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
    }

    const selected = detailId ? evaluations.find((e) => e.id === detailId) : null;

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Minhas Avaliações</h4>
                    <div className="text-muted-foreground text-sm">Acompanhe suas avaliações de desempenho.</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{evaluations.length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Pendentes</div>
                    <div className="mt-1 text-2xl font-bold text-amber-600">{evaluations.filter(e => e.status === "pending").length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Concluídas</div>
                    <div className="mt-1 text-2xl font-bold text-green-600">{evaluations.filter(e => e.status === "completed").length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Nota média</div>
                    <div className="mt-1 text-2xl font-bold text-sky-600">
                        {(() => {
                            const scored = evaluations.filter(e => e.score != null);
                            if (scored.length === 0) return "—";
                            return (scored.reduce((acc, e) => acc + (e.score ?? 0), 0) / scored.length).toFixed(1);
                        })()}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 backdrop-blur overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Avaliação</TableHead>
                            <TableHead>Ciclo</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Nota</TableHead>
                            <TableHead>Prazo</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                        ) : evaluations.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                <ClipboardCheck className="size-8 mx-auto mb-2 text-muted-foreground/30" />
                                Nenhuma avaliação encontrada.
                            </TableCell></TableRow>
                        ) : evaluations.map((ev) => {
                            const cfg = STATUS_CFG[ev.status] ?? STATUS_CFG.pending;
                            return (
                                <TableRow key={ev.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetailId(ev.id)}>
                                    <TableCell className="font-medium">{ev.title}</TableCell>
                                    <TableCell className="text-sm">{ev.cycle}</TableCell>
                                    <TableCell>
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
                                            {cfg.label}
                                        </span>
                                    </TableCell>
                                    <TableCell className="font-mono font-semibold">{ev.score != null ? ev.score.toFixed(1) : "—"}</TableCell>
                                    <TableCell className="text-sm whitespace-nowrap">{fmtDate(ev.dueDate)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm">
                                            <Eye className="size-3.5 mr-1" />Ver
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Detail drawer */}
            {selected && (
                <div className="fixed inset-0 z-50 grid place-items-stretch bg-black/40" role="dialog" aria-modal="true">
                    <div className="ml-auto h-dvh w-full max-w-md bg-white dark:bg-card p-5 shadow-2xl overflow-y-auto">
                        <div className="flex items-start justify-between gap-2 mb-4">
                            <div>
                                <div className="font-bold text-lg">{selected.title}</div>
                                <div className="text-muted-foreground text-sm">{selected.cycle}</div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setDetailId(null)}>Fechar</Button>
                        </div>
                        <div className="space-y-3">
                            <div className="rounded-lg bg-muted/30 p-3">
                                <div className="text-xs text-muted-foreground mb-1">Status</div>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${(STATUS_CFG[selected.status] ?? STATUS_CFG.pending).cls}`}>
                                    {(STATUS_CFG[selected.status] ?? STATUS_CFG.pending).label}
                                </span>
                            </div>
                            <div className="rounded-lg bg-muted/30 p-3">
                                <div className="text-xs text-muted-foreground mb-1">Nota</div>
                                <div className="text-3xl font-bold text-primary">{selected.score != null ? selected.score.toFixed(1) : "—"}</div>
                            </div>
                            <div className="rounded-lg bg-muted/30 p-3">
                                <div className="text-xs text-muted-foreground mb-1">Prazo</div>
                                <div className="text-sm font-medium">{fmtDate(selected.dueDate)}</div>
                            </div>
                            {selected.completedAtUtc && (
                                <div className="rounded-lg bg-muted/30 p-3">
                                    <div className="text-xs text-muted-foreground mb-1">Concluída em</div>
                                    <div className="text-sm font-medium">{fmtDate(selected.completedAtUtc)}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
