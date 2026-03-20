"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
    Users, MessageSquare, Handshake, PartyPopper, TrendingUp,
    Trophy, ChevronRight, RefreshCw, Smile, Frown, Meh, Laugh, Angry,
    CheckCircle2, Circle, ArrowRight, Calendar, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

/* ── helpers ── */
async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function fmtDate(iso: string) {
    try {
        return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    } catch { return iso; }
}
function fmtTime(iso: string) {
    try {
        return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
}

/* ── types ── */
interface FeedbackKpis {
    teamSize: number;
    feedbackEfficiency: number;
    oneOnOneEfficiency: number;
    celebrationEfficiency: number;
    developmentEfficiency: number;
}
interface PendingMeeting {
    id: string;
    participantName: string;
    participantRole: string;
    scheduledAtUtc: string;
    endAtUtc: string;
}
interface GamificationProfile {
    userId: string;
    fullName: string;
    balance: number;
    rank: number;
    level: string;
    levelProgress: number;
}
interface DailyActivity {
    key: string;
    label: string;
    current: number;
    target: number;
    completed: boolean;
}
interface LeaderboardEntry {
    userId: string;
    fullName: string;
    balance: number;
    rank: number;
}
interface GamificationRule {
    eventType: string;
    label: string;
    points: number;
    dailyCap: number | null;
}

const MOODS = [
    { key: "very_bad", icon: Angry, label: "Muito mal", color: "text-red-500" },
    { key: "bad", icon: Frown, label: "Mal", color: "text-orange-500" },
    { key: "neutral", icon: Meh, label: "Neutro", color: "text-yellow-500" },
    { key: "good", icon: Smile, label: "Bem", color: "text-lime-500" },
    { key: "great", icon: Laugh, label: "Ótimo", color: "text-green-500" },
];

/* ── main component ── */
export default function FeedbackInicioScreen() {
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState("Colaborador");
    const [kpis, setKpis] = useState<FeedbackKpis>({
        teamSize: 0, feedbackEfficiency: 0, oneOnOneEfficiency: 0,
        celebrationEfficiency: 0, developmentEfficiency: 0,
    });
    const [pendingMeetings, setPendingMeetings] = useState<PendingMeeting[]>([]);
    const [totalPendingMeetings, setTotalPendingMeetings] = useState(0);
    const [profile, setProfile] = useState<GamificationProfile | null>(null);
    const [dailyActivities, setDailyActivities] = useState<DailyActivity[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [rules, setRules] = useState<GamificationRule[]>([]);
    const [selectedMood, setSelectedMood] = useState<string | null>(null);
    const [moodSubmitted, setMoodSubmitted] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [kpiData, meetingsData, profileData, activitiesData, lbData] = await Promise.allSettled([
                fetchJson<FeedbackKpis>("/api/feedback/inicio/kpis"),
                fetchJson<{ items: PendingMeeting[]; totalItems: number }>("/api/feedback/meetings/pending?take=3"),
                fetchJson<GamificationProfile>("/api/feedback/gamification/my-profile"),
                fetchJson<DailyActivity[]>("/api/feedback/gamification/daily-activities"),
                fetchJson<{ items: LeaderboardEntry[] }>("/api/feedback/gamification/leaderboard?page=1&pageSize=5"),
            ]);
            const rulesData = await fetchJson<GamificationRule[]>("/api/feedback/gamification/rules").catch(() => []);

            if (kpiData.status === "fulfilled") setKpis(kpiData.value);
            if (meetingsData.status === "fulfilled") {
                setPendingMeetings(meetingsData.value.items ?? []);
                setTotalPendingMeetings(meetingsData.value.totalItems ?? 0);
            }
            if (profileData.status === "fulfilled") {
                setProfile(profileData.value);
                setUserName(profileData.value.fullName?.split(" ")[0] ?? "Colaborador");
            }
            if (activitiesData.status === "fulfilled") setDailyActivities(activitiesData.value ?? []);
            if (lbData.status === "fulfilled") setLeaderboard(lbData.value.items ?? []);
            setRules(rulesData ?? []);
        } catch {
            // silent — dashboard shows empty state
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadData(); }, [loadData]);
    useEffect(() => {
        const onFocus = () => { void loadData(); };
        window.addEventListener("focus", onFocus);
        const id = window.setInterval(() => { void loadData(); }, 60000);
        return () => {
            window.removeEventListener("focus", onFocus);
            window.clearInterval(id);
        };
    }, [loadData]);

    async function submitMood(mood: string) {
        setSelectedMood(mood);
        try {
            await apiFetch("/api/feedback/mood", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mood }),
            });
            setMoodSubmitted(true);
        } catch { /* silent */ }
    }

    const dailyProgress = dailyActivities.length > 0
        ? Math.round((dailyActivities.filter(a => a.completed).length / dailyActivities.length) * 100)
        : 0;

    /* ── KPI helper ── */
    function KpiCard({ icon: Icon, label, value, suffix, color }: {
        icon: typeof Users; label: string; value: number | string; suffix?: string; color: string;
    }) {
        return (
            <div className="flex flex-col items-center gap-1 px-3 py-2">
                <div className={`size-10 rounded-full flex items-center justify-center ${color}`}>
                    <Icon className="size-5" />
                </div>
                <div className="font-bold text-sm mt-1">
                    {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
                    {suffix && <span className="text-xs font-normal text-muted-foreground ml-0.5">{suffix}</span>}
                </div>
                <div className="text-xs text-muted-foreground text-center leading-tight">{label}</div>
            </div>
        );
    }

    if (loading) {
        return (
            <section className="space-y-4">
                <div className="text-center text-muted-foreground py-16">Carregando...</div>
            </section>
        );
    }

    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Início</h4>
                    <div className="text-muted-foreground text-sm">Visão geral do módulo de feedback e engajamento.</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadData()}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>

            {/* Greeting + KPIs */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-5 backdrop-blur">
                <div className="font-bold text-base mb-4">
                    Olá {userName}, como está sua gestão? 👋
                </div>
                <div className="flex flex-wrap justify-around gap-2">
                    <KpiCard icon={Users} label="Seu time" value={kpis.teamSize} suffix={`Colaboradores`} color="bg-blue-100 text-blue-600" />
                    <KpiCard icon={MessageSquare} label="Feedbacks" value={`${kpis.feedbackEfficiency}%`} suffix="" color="bg-violet-100 text-violet-600" />
                    <KpiCard icon={Handshake} label="1:1" value={`${kpis.oneOnOneEfficiency}%`} suffix="" color="bg-sky-100 text-sky-600" />
                    <KpiCard icon={PartyPopper} label="Celebrações" value={`${kpis.celebrationEfficiency}%`} suffix="" color="bg-pink-100 text-pink-600" />
                    <KpiCard icon={TrendingUp} label="Desenvolvimento" value={`${kpis.developmentEfficiency}%`} suffix="" color="bg-emerald-100 text-emerald-600" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
                {/* Left column */}
                <div className="space-y-4">
                    {/* Pending 1:1 meetings */}
                    <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-5 backdrop-blur">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="size-8 rounded-full bg-amber-100 flex items-center justify-center">
                                    <Calendar className="size-4 text-amber-600" />
                                </div>
                                <div>
                                    <div className="font-semibold text-sm">Reuniões 1:1 pendentes</div>
                                    <div className="text-xs text-muted-foreground">Confirme as reuniões que já passaram e não foram finalizadas</div>
                                </div>
                            </div>
                            {totalPendingMeetings > 0 && (
                                <span className="text-xs text-muted-foreground">
                                    Mostrando {Math.min(pendingMeetings.length, 3)} de {totalPendingMeetings} reuniões
                                </span>
                            )}
                        </div>

                        {pendingMeetings.length === 0 ? (
                            <div className="text-center text-muted-foreground text-sm py-4">
                                Nenhuma reunião 1:1 pendente. 🎉
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {pendingMeetings.map((m) => (
                                    <div key={m.id} className="flex items-center justify-between rounded-lg border border-border/30 bg-background/60 px-4 py-3 hover:bg-muted/40 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                                {m.participantName?.charAt(0) ?? "?"}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-sm">{m.participantName}</div>
                                                <div className="text-xs text-muted-foreground">{m.participantRole}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <div className="flex items-center gap-1.5 text-sm">
                                                    <Calendar className="size-3.5 text-muted-foreground" />
                                                    {fmtDate(m.scheduledAtUtc)}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {fmtTime(m.scheduledAtUtc)} até {fmtTime(m.endAtUtc)}
                                                </div>
                                            </div>
                                            <Link href="/app/feedback/reunioes1a1">
                                                <Button variant="outline" size="sm">
                                                    <ArrowRight className="size-4" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                                {totalPendingMeetings > 3 && (
                                    <div className="text-center pt-1">
                                        <Link href="/app/feedback/reunioes1a1" className="text-sm text-primary hover:underline font-medium">
                                            Carregar mais
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Mood tracker */}
                    <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-5 backdrop-blur text-center">
                        <div className="font-semibold text-base mb-3">Como você está se sentindo?</div>
                        {moodSubmitted ? (
                            <div className="text-muted-foreground text-sm py-2">
                                Obrigado por compartilhar! 💙
                            </div>
                        ) : (
                            <div className="flex justify-center gap-4">
                                {MOODS.map(({ key, icon: MoodIcon, label, color }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        title={label}
                                        onClick={() => void submitMood(key)}
                                        className={`group flex flex-col items-center gap-1 transition-all duration-200 hover:scale-110 ${selectedMood === key ? "scale-110" : ""}`}
                                    >
                                        <MoodIcon className={`size-10 transition-colors ${selectedMood === key ? color : "text-muted-foreground/50 group-hover:" + color}`} />
                                        <span className="text-[10px] text-muted-foreground">{label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Mini ranking */}
                    <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-5 backdrop-blur">
                        <div className="flex items-center justify-between mb-3">
                            <div className="font-semibold text-sm">Ranking Mensal 🏆</div>
                            <Link href="/app/feedback/gamificacao" className="text-xs text-primary hover:underline">
                                Ver completo <ChevronRight className="size-3 inline" />
                            </Link>
                        </div>
                        {leaderboard.length === 0 ? (
                            <div className="text-center text-muted-foreground text-sm py-3">Nenhum participante ainda.</div>
                        ) : (
                            <div className="space-y-2">
                                {leaderboard.slice(0, 5).map((entry, i) => (
                                    <div key={entry.userId} className={`flex items-center justify-between rounded-lg px-3 py-2 ${i < 3 ? "bg-amber-50/60 dark:bg-amber-950/20" : ""}`}>
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-sm w-6 text-center">
                                                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${entry.rank}`}
                                            </span>
                                            <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                                {entry.fullName?.charAt(0) ?? "?"}
                                            </div>
                                            <span className="text-sm font-medium">{entry.fullName}</span>
                                        </div>
                                        <span className="text-sm font-mono font-semibold text-amber-600">
                                            {entry.balance?.toLocaleString("pt-BR")} RC
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right column */}
                <div className="space-y-4">
                    {/* User profile card */}
                    <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-5 backdrop-blur">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="size-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold text-lg">
                                {profile?.fullName?.charAt(0) ?? "?"}
                            </div>
                            <div>
                                <div className="font-bold text-sm">{profile?.fullName ?? userName}</div>
                                <div className="flex items-center gap-1 text-amber-600 text-sm font-semibold">
                                    <Star className="size-3.5 fill-amber-500" />
                                    {profile?.balance?.toLocaleString("pt-BR") ?? 0} RC
                                </div>
                            </div>
                        </div>

                        {/* Level */}
                        <div className="rounded-lg bg-muted/40 p-3 mb-3">
                            <div className="flex items-center gap-1.5 mb-1">
                                <Trophy className="size-4 text-amber-600" />
                                <span className="text-sm font-semibold">{profile?.level ?? "Iniciante"}</span>
                            </div>
                            <div className="text-xs text-muted-foreground mb-2">
                                Mantenha o engajamento e suba de nível! A contagem das ações reinicia a cada 15 dias.
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-2 flex-1 rounded-full bg-black/10 overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-500"
                                        style={{ width: `${profile?.levelProgress ?? 0}%` }}
                                    />
                                </div>
                                <span className="text-xs font-semibold text-muted-foreground">{profile?.levelProgress ?? 0}%</span>
                            </div>
                        </div>

                        {/* Daily activities */}
                        <div className="font-semibold text-sm mb-2">Atividades diárias</div>
                        {dailyActivities.length === 0 ? (
                            <div className="text-xs text-muted-foreground">Nenhuma atividade configurada.</div>
                        ) : (
                            <div className="space-y-2">
                                {dailyActivities.map((act) => (
                                    <div key={act.key} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {act.completed ? (
                                                <CheckCircle2 className="size-4 text-green-500" />
                                            ) : (
                                                <Circle className="size-4 text-muted-foreground/40" />
                                            )}
                                            <span className={`text-sm ${act.completed ? "line-through text-muted-foreground" : ""}`}>
                                                {act.current}/{act.target} {act.label}
                                            </span>
                                        </div>
                                        {act.completed ? (
                                            <CheckCircle2 className="size-4 text-green-500" />
                                        ) : (
                                            <Link href={act.key === "feedbacks" ? "/app/feedback/enviar" : act.key === "celebrations" ? "/app/feedback/celebracao" : "/app/feedback/feedbacks"}>
                                                <Button variant="outline" size="sm">
                                                    <ArrowRight className="size-3" />
                                                </Button>
                                            </Link>
                                        )}
                                    </div>
                                ))}
                                <div className="mt-2">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-muted-foreground">Progresso diário</span>
                                        <span className="font-semibold">{dailyProgress}%</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-green-400 to-emerald-600 transition-all duration-500"
                                            style={{ width: `${dailyProgress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Scoring rules mini */}
                    <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                        <div className="font-semibold text-sm mb-2">Pontos por ação</div>
                        <div className="space-y-1.5 text-xs">
                            {rules.slice(0, 6).map((rule) => (
                                <div key={rule.eventType} className="flex justify-between py-0.5 border-b border-border/10 last:border-0">
                                    <span className="text-muted-foreground">{rule.label}</span>
                                    <span className="font-semibold text-amber-600">
                                        +{rule.points.toLocaleString("pt-BR")} RC
                                    </span>
                                </div>
                            ))}
                        </div>
                        <Link href="/app/feedback/gamificacao" className="text-xs text-primary hover:underline mt-2 inline-block">
                            Ver todas as regras →
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
