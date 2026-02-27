"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Plus, Trash2, Target, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

/* ── Types ── */
interface DevelopmentPlan {
    id: string;
    title: string;
    description: string | null;
    status: string;
    createdAtUtc: string;
    goals: DevelopmentGoal[];
}
interface DevelopmentGoal {
    id: string;
    title: string;
    isCompleted: boolean;
}
interface PlanList {
    items: DevelopmentPlan[];
    totalItems: number;
    page: number;
    pageSize: number;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function fmtDate(iso: string) {
    try { return new Date(iso).toLocaleDateString("pt-BR"); }
    catch { return iso; }
}

export default function MeusPlanosScreen() {
    const [data, setData] = useState<PlanList | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchJson<PlanList>(`/api/feedback/plans/my?page=${page}&pageSize=20`);
            setData(result);
        } catch (err) {
            console.error("Failed to load plans", err);
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => { void loadData(); }, [loadData]);

    const plans = data?.items ?? [];
    const totalPages = Math.ceil((data?.totalItems ?? 0) / 20);

    async function handleDelete(id: string) {
        if (!confirm("Excluir este plano?")) return;
        try {
            await apiFetch(`/api/feedback/plans/${id}`, { method: "DELETE" });
            toast.success("Plano removido.");
            void loadData();
        } catch {
            toast.error("Falha ao remover plano.");
        }
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Meus Planos de Desenvolvimento</h4>
                    <div className="text-muted-foreground text-sm">Acompanhe seus planos de desenvolvimento individual (PDI).</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void loadData()} disabled={loading}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>

            {loading ? (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-8 backdrop-blur text-center text-muted-foreground">
                    Carregando planos...
                </div>
            ) : plans.length === 0 ? (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-8 backdrop-blur text-center text-muted-foreground">
                    Você ainda não tem planos de desenvolvimento. Converse com seu gestor para criar um.
                </div>
            ) : (
                <div className="space-y-3">
                    {plans.map((plan) => {
                        const total = plan.goals?.length ?? 0;
                        const done = plan.goals?.filter(g => g.isCompleted).length ?? 0;
                        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                        return (
                            <div key={plan.id} className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="font-semibold flex items-center gap-2">
                                            <Target className="size-4 text-primary" />
                                            {plan.title}
                                        </div>
                                        {plan.description && <div className="text-sm text-muted-foreground mt-1">{plan.description}</div>}
                                        <div className="text-xs text-muted-foreground mt-1">Criado em {fmtDate(plan.createdAtUtc)}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{plan.status}</span>
                                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void handleDelete(plan.id)}>
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                </div>

                                {total > 0 && (
                                    <div className="mt-3">
                                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                            <span>{done}/{total} metas concluídas</span>
                                            <span>{pct}%</span>
                                        </div>
                                        <div className="w-full h-2 rounded-full bg-muted">
                                            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                        <div className="mt-2 space-y-1">
                                            {plan.goals.map((g) => (
                                                <div key={g.id} className="flex items-center gap-2 text-sm">
                                                    <span className={g.isCompleted ? "text-emerald-600" : "text-muted-foreground"}>
                                                        {g.isCompleted ? "✅" : "⬜"}
                                                    </span>
                                                    <span className={g.isCompleted ? "line-through text-muted-foreground" : ""}>{g.title}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>Página {page} de {totalPages}</span>
                            <div className="flex gap-1">
                                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="size-4" /></Button>
                                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="size-4" /></Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
