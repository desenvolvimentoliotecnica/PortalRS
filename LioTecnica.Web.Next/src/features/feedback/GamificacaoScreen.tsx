"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Trophy, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";

/* ── Types ── */
interface LeaderboardEntry {
    userId: string;
    fullName: string;
    balance: number;
    rank: number;
}
interface LeaderboardResponse {
    items: LeaderboardEntry[];
    totalItems: number;
    page: number;
    pageSize: number;
}
interface MyBalance {
    userId: string;
    balance: number;
    lastTransactionDate: string | null;
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export default function GamificacaoScreen() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [myBalance, setMyBalance] = useState<MyBalance | null>(null);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [lb, balance] = await Promise.all([
                fetchJson<LeaderboardResponse>("/api/feedback/gamification/leaderboard?page=1&pageSize=50"),
                fetchJson<MyBalance>("/api/feedback/gamification/my-balance").catch(() => null),
            ]);
            setLeaderboard(lb.items ?? []);
            setMyBalance(balance);
        } catch (err) {
            console.error("Failed to load gamification", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadData(); }, [loadData]);

    const filtered = q.trim()
        ? leaderboard.filter(e => e.fullName?.toLowerCase().includes(q.toLowerCase()))
        : leaderboard;

    function medalIcon(rank: number) {
        if (rank === 1) return "🥇";
        if (rank === 2) return "🥈";
        if (rank === 3) return "🥉";
        return `#${rank}`;
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Gamificação — Ranking</h4>
                    <div className="text-muted-foreground text-sm">Ranking de RenderCoins acumulados pelos colaboradores.</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void loadData()} disabled={loading}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider flex items-center gap-1"><Trophy className="size-3" /> Participantes</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{leaderboard.length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider flex items-center gap-1"><Star className="size-3" /> Meu saldo</div>
                    <div className="mt-1 text-2xl font-bold text-amber-600">{myBalance?.balance?.toLocaleString("pt-BR") ?? "—"} RC</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider flex items-center gap-1"><TrendingUp className="size-3" /> Líder</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-600">{leaderboard[0]?.balance?.toLocaleString("pt-BR") ?? "—"} RC</div>
                </div>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                        <Input className="pl-3" placeholder="Busque pelo nome" value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-16 text-center">Pos.</TableHead>
                            <TableHead>Colaborador</TableHead>
                            <TableHead className="text-right">RenderCoins</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Nenhum participante encontrado.</TableCell></TableRow>
                        ) : (
                            filtered.map((e, i) => (
                                <TableRow key={e.userId} className={i < 3 ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                                    <TableCell className="text-center font-bold">{medalIcon(e.rank)}</TableCell>
                                    <TableCell className="font-medium">{e.fullName}</TableCell>
                                    <TableCell className="text-right font-mono font-semibold">{e.balance?.toLocaleString("pt-BR")} RC</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}
