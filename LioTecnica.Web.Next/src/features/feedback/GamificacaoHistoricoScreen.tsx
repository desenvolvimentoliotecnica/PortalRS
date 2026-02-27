"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

/* ── Types ── */
interface MonthEntry {
    month: string;
    top3: { userId: string; fullName: string; total: number }[];
    goalLine: number;
}
interface HistoryResponse {
    months: MonthEntry[];
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export default function GamificacaoHistoricoScreen() {
    const [data, setData] = useState<MonthEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchJson<HistoryResponse>("/api/feedback/gamification/history?months=12&goal=5000");
            setData(result.months ?? []);
        } catch (err) {
            console.error("Failed to load gamification history", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadData(); }, [loadData]);

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Gamificação — Histórico</h4>
                    <div className="text-muted-foreground text-sm">Top 3 colaboradores por mês nos últimos 12 meses.</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void loadData()} disabled={loading}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>

            {loading ? (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-8 backdrop-blur text-center text-muted-foreground">
                    Carregando histórico...
                </div>
            ) : data.length === 0 ? (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-8 backdrop-blur text-center text-muted-foreground">
                    Nenhum dado histórico encontrado.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.map((month) => (
                        <div key={month.month} className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                            <div className="flex items-center justify-between mb-3">
                                <div className="font-semibold flex items-center gap-2"><BarChart3 className="size-4 text-primary" /> {month.month}</div>
                                <span className="text-xs text-muted-foreground">Meta: {month.goalLine?.toLocaleString("pt-BR")} RC</span>
                            </div>
                            {month.top3?.length > 0 ? (
                                <div className="space-y-2">
                                    {month.top3.map((entry, i) => (
                                        <div key={entry.userId} className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm">
                                                    {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
                                                </span>
                                                <span className="text-sm truncate max-w-[150px]">{entry.fullName}</span>
                                            </div>
                                            <span className="font-mono font-semibold text-sm">{entry.total?.toLocaleString("pt-BR")} RC</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground text-sm py-2">Sem dados</div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
