"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, RefreshCw, ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";

/* ── Types ── */
interface FeedbackItem {
    id: string;
    fromUserName: string;
    toUserName: string;
    content: string;
    type: string;
    createdAtUtc: string;
}
interface FeedbackList {
    items: FeedbackItem[];
    totalItems: number;
    page: number;
    pageSize: number;
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function fmtDate(iso: string) {
    try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
}

export default function FeedbacksScreen() {
    const [tab, setTab] = useState<"mine" | "all">("all");
    const [data, setData] = useState<FeedbackList | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [q, setQ] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const endpoint = tab === "mine" ? "/api/feedback/items/mine" : "/api/feedback/items/all";
            const result = await fetchJson<FeedbackList>(`${endpoint}?page=${page}&pageSize=20`);
            setData(result);
        } catch (err) {
            console.error("Failed to load feedbacks", err);
        } finally {
            setLoading(false);
        }
    }, [tab, page]);

    useEffect(() => { void loadData(); }, [loadData]);

    const filtered = useMemo(() => {
        const items = data?.items ?? [];
        if (!q.trim()) return items;
        const lower = q.toLowerCase();
        return items.filter(f =>
            f.fromUserName?.toLowerCase().includes(lower) ||
            f.toUserName?.toLowerCase().includes(lower) ||
            f.content?.toLowerCase().includes(lower)
        );
    }, [data, q]);

    const totalPages = Math.ceil((data?.totalItems ?? 0) / 20);

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Feedbacks</h4>
                    <div className="text-muted-foreground text-sm">Visualize todos os feedbacks enviados e recebidos.</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void loadData()} disabled={loading}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>

            <div className="flex gap-2">
                <Button variant={tab === "all" ? "default" : "outline"} size="sm" onClick={() => { setTab("all"); setPage(1); }}>
                    Todos
                </Button>
                <Button variant={tab === "mine" ? "default" : "outline"} size="sm" onClick={() => { setTab("mine"); setPage(1); }}>
                    Meus feedbacks
                </Button>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-8" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>De</TableHead>
                            <TableHead>Para</TableHead>
                            <TableHead>Conteúdo</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Data</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum feedback encontrado.</TableCell></TableRow>
                        ) : (
                            filtered.map((f) => (
                                <TableRow key={f.id}>
                                    <TableCell className="font-medium text-sm">{f.fromUserName || "—"}</TableCell>
                                    <TableCell className="text-sm">{f.toUserName || "—"}</TableCell>
                                    <TableCell className="text-sm max-w-[300px] truncate">{f.content}</TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                            {f.type || "—"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(f.createdAtUtc)}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
                        <span>Página {page} de {totalPages} ({data?.totalItems} registros)</span>
                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                                <ChevronLeft className="size-4" />
                            </Button>
                            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
