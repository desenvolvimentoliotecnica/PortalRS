"use client";

import { useState, useEffect, useCallback } from "react";
import { ClipboardList, RefreshCw, MessageSquare, PartyPopper, Handshake, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

interface ActivitySummary {
    feedbacksSent: number;
    feedbacksReceived: number;
    celebrationsPosted: number;
    meetingsCompleted: number;
    plansConcluded: number;
    totalPoints: number;
}

interface TimelineEvent {
    id: string;
    type: string;
    description: string;
    actorName: string;
    createdAtUtc: string;
}

const ACTIVITY_ICONS: Record<string, typeof MessageSquare> = {
    feedback: MessageSquare,
    celebration: PartyPopper,
    meeting: Handshake,
    plan: BookOpen,
};

export default function GestaoResumoScreen() {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<ActivitySummary>({
        feedbacksSent: 0, feedbacksReceived: 0, celebrationsPosted: 0,
        meetingsCompleted: 0, plansConcluded: 0, totalPoints: 0,
    });
    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [sumData, tlData] = await Promise.allSettled([
                fetchJson<ActivitySummary>("/api/gestao/resumo/summary"),
                fetchJson<TimelineEvent[]>("/api/gestao/resumo/timeline?take=15"),
            ]);
            if (sumData.status === "fulfilled") setSummary(sumData.value);
            if (tlData.status === "fulfilled") setTimeline(tlData.value ?? []);
        } catch { /* silent */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { void loadData(); }, [loadData]);

    function fmtDate(iso: string) {
        try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
        catch { return iso; }
    }

    const actCards = [
        { label: "Feedbacks enviados", value: summary.feedbacksSent, icon: MessageSquare, color: "text-violet-600 bg-violet-100" },
        { label: "Feedbacks recebidos", value: summary.feedbacksReceived, icon: MessageSquare, color: "text-blue-600 bg-blue-100" },
        { label: "Celebrações", value: summary.celebrationsPosted, icon: PartyPopper, color: "text-pink-600 bg-pink-100" },
        { label: "Reuniões 1:1", value: summary.meetingsCompleted, icon: Handshake, color: "text-sky-600 bg-sky-100" },
        { label: "Planos concluídos", value: summary.plansConcluded, icon: BookOpen, color: "text-emerald-600 bg-emerald-100" },
        { label: "Pontos totais", value: summary.totalPoints, icon: ClipboardList, color: "text-amber-600 bg-amber-100" },
    ];

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Resumo de Atividades</h4>
                    <div className="text-muted-foreground text-sm">Visão consolidada das atividades e progresso da equipe.</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>

            {/* Activity summary cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {actCards.map((c) => {
                    const Icon = c.icon;
                    const [textColor, bgColor] = c.color.split(" ");
                    return (
                        <div key={c.label} className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                            <div className="flex items-center gap-2 mb-1">
                                <div className={`size-7 rounded-lg flex items-center justify-center ${bgColor}`}>
                                    <Icon className={`size-3.5 ${textColor}`} />
                                </div>
                                <span className="text-xs text-muted-foreground font-medium">{c.label}</span>
                            </div>
                            <div className={`text-2xl font-bold ${textColor}`}>
                                {c.value.toLocaleString("pt-BR")}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Timeline */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-5 backdrop-blur">
                <div className="font-bold text-sm mb-4">Timeline de atividades</div>
                {timeline.length === 0 ? (
                    <div className="text-center text-muted-foreground text-sm py-6">
                        <ClipboardList className="size-8 mx-auto mb-2 text-muted-foreground/30" />
                        Nenhuma atividade registrada ainda.
                    </div>
                ) : (
                    <div className="relative space-y-0">
                        {timeline.map((evt, i) => {
                            const Icon = ACTIVITY_ICONS[evt.type] ?? ClipboardList;
                            return (
                                <div key={evt.id} className="flex gap-3 relative">
                                    {/* Timeline line */}
                                    {i < timeline.length - 1 && (
                                        <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border/40" />
                                    )}
                                    <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0 z-10">
                                        <Icon className="size-3.5 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 pb-4">
                                        <div className="text-sm">
                                            <span className="font-semibold">{evt.actorName}</span>{" "}
                                            <span className="text-muted-foreground">{evt.description}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{fmtDate(evt.createdAtUtc)}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
