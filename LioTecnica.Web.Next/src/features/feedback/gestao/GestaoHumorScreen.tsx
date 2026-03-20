"use client";

import { useState, useEffect, useCallback } from "react";
import { Smile, Frown, Meh, Laugh, Angry, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

interface MoodEntry {
    id: string;
    userId: string;
    fullName: string;
    mood: string;
    createdAtUtc: string;
}
interface MoodStats {
    averageMood: string;
    totalResponses: number;
    distribution: { mood: string; count: number; percentage: number }[];
}

const MOOD_CONFIG: Record<string, { icon: typeof Smile; label: string; color: string; bgColor: string }> = {
    very_bad: { icon: Angry, label: "Muito mal", color: "text-red-500", bgColor: "bg-red-100" },
    bad: { icon: Frown, label: "Mal", color: "text-orange-500", bgColor: "bg-orange-100" },
    neutral: { icon: Meh, label: "Neutro", color: "text-yellow-500", bgColor: "bg-yellow-100" },
    good: { icon: Smile, label: "Bem", color: "text-lime-500", bgColor: "bg-lime-100" },
    great: { icon: Laugh, label: "Ótimo", color: "text-green-500", bgColor: "bg-green-100" },
};

export default function GestaoHumorScreen() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<MoodStats | null>(null);
    const [recentEntries, setRecentEntries] = useState<MoodEntry[]>([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [statsData, entriesData] = await Promise.allSettled([
                fetchJson<MoodStats>("/api/gestao/humor/stats"),
                fetchJson<MoodEntry[]>("/api/gestao/humor/recent?take=10"),
            ]);
            if (statsData.status === "fulfilled") setStats(statsData.value);
            if (entriesData.status === "fulfilled") setRecentEntries(entriesData.value ?? []);
        } catch { /* silent */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { void loadData(); }, [loadData]);

    function fmtDate(iso: string) {
        try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
        catch { return iso; }
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Termômetro de Humor</h4>
                    <div className="text-muted-foreground text-sm">Acompanhe o humor e bem-estar da equipe ao longo do tempo.</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider flex items-center gap-1">
                        <TrendingUp className="size-3" /> Humor médio
                    </div>
                    <div className="mt-1 text-2xl font-bold text-primary">{stats?.averageMood ?? "—"}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total de respostas</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{stats?.totalResponses ?? 0}</div>
                </div>
            </div>

            {/* Distribution */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-5 backdrop-blur">
                <div className="font-bold text-sm mb-4">Distribuição</div>
                {!stats?.distribution?.length ? (
                    <div className="text-center text-muted-foreground text-sm py-4">Nenhum dado disponível ainda.</div>
                ) : (
                    <div className="space-y-3">
                        {stats.distribution.map((d) => {
                            const cfg = MOOD_CONFIG[d.mood] ?? MOOD_CONFIG.neutral;
                            const MoodIcon = cfg.icon;
                            return (
                                <div key={d.mood} className="flex items-center gap-3">
                                    <div className={`size-8 rounded-full flex items-center justify-center ${cfg.bgColor}`}>
                                        <MoodIcon className={`size-4 ${cfg.color}`} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-medium">{cfg.label}</span>
                                            <span className="text-muted-foreground">{d.count} ({d.percentage}%)</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                                            <div className={`h-full ${cfg.bgColor}`} style={{ width: `${d.percentage}%` }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Recent entries */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-5 backdrop-blur">
                <div className="font-bold text-sm mb-3">Registros recentes</div>
                {recentEntries.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-4">Nenhum registro de humor recente.</div>
                ) : (
                    <div className="space-y-2">
                        {recentEntries.map((e) => {
                            const cfg = MOOD_CONFIG[e.mood] ?? MOOD_CONFIG.neutral;
                            const MoodIcon = cfg.icon;
                            return (
                                <div key={e.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <MoodIcon className={`size-5 ${cfg.color}`} />
                                        <span className="text-sm font-medium">{e.fullName}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{fmtDate(e.createdAtUtc)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
