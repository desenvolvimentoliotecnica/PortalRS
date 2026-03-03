"use client";

import { useState, useEffect, useCallback } from "react";
import {
    BookCheck, Smile, Calendar, TrendingUp, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

interface GestaoKpis {
    planosAtivos: number;
    humorMedio: string;
    reunioes1a1: number;
    metasConcluidas: number;
}
interface RecentActivity {
    id: string;
    type: string;
    description: string;
    createdAtUtc: string;
}
interface UpcomingAction {
    id: string;
    type: string;
    description: string;
    dueAtUtc: string;
}

export default function GestaoDashboardScreen() {
    const [loading, setLoading] = useState(true);
    const [kpis, setKpis] = useState<GestaoKpis>({
        planosAtivos: 0, humorMedio: "—", reunioes1a1: 0, metasConcluidas: 0,
    });
    const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
    const [upcomingActions, setUpcomingActions] = useState<UpcomingAction[]>([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [kpiData, actData, upData] = await Promise.allSettled([
                fetchJson<GestaoKpis>("/api/gestao/dashboard/kpis"),
                fetchJson<RecentActivity[]>("/api/gestao/dashboard/recent-activities?take=5"),
                fetchJson<UpcomingAction[]>("/api/gestao/dashboard/upcoming-actions?take=5"),
            ]);
            if (kpiData.status === "fulfilled") setKpis(kpiData.value);
            if (actData.status === "fulfilled") setRecentActivities(actData.value ?? []);
            if (upData.status === "fulfilled") setUpcomingActions(upData.value ?? []);
        } catch { /* silent */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { void loadData(); }, [loadData]);

    function fmtDate(iso: string) {
        try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }); }
        catch { return iso; }
    }

    const kpiCards = [
        { icon: BookCheck, label: "Planos ativos", sublabel: "Planos de desenvolvimento em andamento", value: kpis.planosAtivos },
        { icon: Smile, label: "Humor da equipe", sublabel: "Média do último período", value: kpis.humorMedio },
        { icon: Calendar, label: "Reuniões 1:1", sublabel: "Agendadas este mês", value: kpis.reunioes1a1 },
        { icon: TrendingUp, label: "Metas concluídas", sublabel: "No período", value: kpis.metasConcluidas },
    ];

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Dashboard</h4>
                    <div className="text-muted-foreground text-sm">Visão geral da gestão de equipes.</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void loadData()} disabled={loading}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {kpiCards.map((k) => (
                    <div key={k.label} className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <k.icon className="size-4 text-primary" />
                            </div>
                            <div>
                                <div className="font-semibold text-sm">{k.label}</div>
                                <div className="text-xs text-muted-foreground">{k.sublabel}</div>
                            </div>
                        </div>
                        <div className="text-2xl font-bold text-primary">
                            {typeof k.value === "number" ? k.value.toLocaleString("pt-BR") : k.value}
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-5 backdrop-blur">
                    <div className="font-bold text-sm mb-3">Resumo recente</div>
                    {recentActivities.length === 0 ? (
                        <div className="text-muted-foreground text-sm py-4 text-center">
                            Atividades e atualizações recentes da equipe serão exibidas aqui.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recentActivities.map((a) => (
                                <div key={a.id} className="flex items-start justify-between rounded-lg bg-muted/30 px-3 py-2">
                                    <div>
                                        <div className="text-sm font-medium">{a.description}</div>
                                        <div className="text-xs text-muted-foreground">{a.type}</div>
                                    </div>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{fmtDate(a.createdAtUtc)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-5 backdrop-blur">
                    <div className="font-bold text-sm mb-3">Próximas ações</div>
                    {upcomingActions.length === 0 ? (
                        <div className="text-muted-foreground text-sm py-4 text-center">
                            Reuniões e prazos de metas próximos serão exibidos aqui.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {upcomingActions.map((a) => (
                                <div key={a.id} className="flex items-start justify-between rounded-lg bg-muted/30 px-3 py-2">
                                    <div>
                                        <div className="text-sm font-medium">{a.description}</div>
                                        <div className="text-xs text-muted-foreground">{a.type}</div>
                                    </div>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{fmtDate(a.dueAtUtc)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
