"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Search, RefreshCw, ChevronLeft, ChevronRight, Send, Inbox,
    ArrowDownCircle, ArrowUpCircle, Star, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

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

type TabKey = "received" | "sent" | "sol-received" | "sol-sent";

async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function fmtDate(iso: string) {
    try {
        return new Date(iso).toLocaleString("pt-BR", {
            day: "2-digit", month: "2-digit", year: "2-digit",
            hour: "2-digit", minute: "2-digit",
        });
    } catch { return iso; }
}

/* ── Star display component ── */
function Stars({ rating, max = 5 }: { rating: number; max?: number }) {
    const full = Math.floor(rating);
    const half = rating - full >= 0.25;
    return (
        <span className="inline-flex items-center gap-0.5">
            {Array.from({ length: max }, (_, i) => (
                <Star
                    key={i}
                    className={`size-3.5 ${i < full ? "fill-amber-400 text-amber-400"
                            : i === full && half ? "fill-amber-400/50 text-amber-400"
                                : "text-muted-foreground/30"
                        }`}
                />
            ))}
            {rating > 0 && <span className="ml-1 text-xs font-bold">{rating.toFixed(1)}</span>}
        </span>
    );
}

const TAB_CONFIG: { key: TabKey; label: string; apiFilter: string }[] = [
    { key: "received", label: "Recebidos", apiFilter: "received" },
    { key: "sent", label: "Enviados", apiFilter: "sent" },
    { key: "sol-received", label: "Solicitações Recebidas", apiFilter: "sol-received" },
    { key: "sol-sent", label: "Solicitações Enviadas", apiFilter: "sol-sent" },
];

export default function FeedbacksScreen() {
    const [tab, setTab] = useState<TabKey>("received");
    const [data, setData] = useState<FeedbackList | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [q, setQ] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Counts for tab badges
    const [counts, setCounts] = useState<Record<TabKey, number>>({
        received: 0, sent: 0, "sol-received": 0, "sol-sent": 0,
    });

    const loadData = useCallback(async (activeTab?: TabKey, activePage?: number) => {
        const t = activeTab ?? tab;
        const p = activePage ?? page;
        setLoading(true);
        try {
            const endpoint = "/api/feedback/items/mine";
            const qs = new URLSearchParams({ page: String(p), pageSize: "20", filter: t });
            if (dateFrom) qs.set("from", dateFrom);
            if (dateTo) qs.set("to", dateTo);
            const result = await fetchJson<FeedbackList>(`${endpoint}?${qs}`);
            setData(result);
        } catch (err) {
            console.error("Failed to load feedbacks", err);
        } finally {
            setLoading(false);
        }
    }, [tab, page, dateFrom, dateTo]);

    // Load counts for all tabs (once on mount + on filter change)
    const loadCounts = useCallback(async () => {
        const results = await Promise.allSettled(
            TAB_CONFIG.map(async (t) => {
                const qs = new URLSearchParams({ page: "1", pageSize: "1", filter: t.apiFilter });
                if (dateFrom) qs.set("from", dateFrom);
                if (dateTo) qs.set("to", dateTo);
                const r = await fetchJson<FeedbackList>(`/api/feedback/items/mine?${qs}`);
                return { key: t.key, count: r.totalItems ?? 0 };
            })
        );
        const next: Record<string, number> = {};
        for (const r of results) {
            if (r.status === "fulfilled") next[r.value.key] = r.value.count;
        }
        setCounts((prev) => ({ ...prev, ...next }));
    }, [dateFrom, dateTo]);

    useEffect(() => { void loadData(); }, [loadData]);
    useEffect(() => { void loadCounts(); }, [loadCounts]);

    const filtered = useMemo(() => {
        const items = data?.items ?? [];
        if (!q.trim()) return items;
        const lower = q.toLowerCase();
        return items.filter((f) =>
            f.fromUserName?.toLowerCase().includes(lower) ||
            f.toUserName?.toLowerCase().includes(lower) ||
            f.content?.toLowerCase().includes(lower)
        );
    }, [data, q]);

    const totalPages = Math.ceil((data?.totalItems ?? 0) / 20);
    const totalReceived = counts.received;
    const totalSent = counts.sent;

    function handleFilter() { setPage(1); void loadData(tab, 1); void loadCounts(); }
    function handleClear() { setDateFrom(""); setDateTo(""); setPage(1); }

    return (
        <section className="space-y-3">
            {/* ── Header ── */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="mb-2 inline-flex rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Feedback
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Feedbacks</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Dê, solicite e receba feedbacks precisos de maneira construtiva
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled title="Em breve">
                        <Inbox className="size-4 mr-1" />Solicitar
                    </Button>
                    <Button size="sm" asChild>
                        <Link href="/feedback/enviar">
                            <Send className="size-4 mr-1" />Enviar Feedback
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { void loadData(); void loadCounts(); }} disabled={loading}>
                        <RefreshCw className="size-4" />
                    </Button>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className="rounded-xl border border-border/40 bg-card/60 p-3 backdrop-blur">
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">De</label>
                        <Input type="date" className="h-9 w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Até</label>
                        <Input type="date" className="h-9 w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" onClick={handleFilter}>Filtrar</Button>
                        <Button variant="outline" size="sm" onClick={handleClear}>Limpar</Button>
                    </div>
                    <div className="ml-auto relative max-w-[220px]">
                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-8 h-9" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                            <ArrowDownCircle className="size-5" />
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs">Feedbacks recebidos</div>
                            <div className="text-2xl font-bold">{totalReceived}</div>
                        </div>
                    </div>
                </div>
                <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                            <ArrowUpCircle className="size-5" />
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs">Feedbacks enviados</div>
                            <div className="text-2xl font-bold">{totalSent}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Resumo por Item (star ratings) ── */}
            <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <h6 className="font-bold text-sm mb-3">Resumo por Item</h6>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border/20 bg-muted/30 p-3">
                        <div className="font-semibold text-sm">Alinhamento Cultural</div>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-muted-foreground text-xs">Sua média:</span>
                            <span className="text-muted-foreground text-xs">Sem feedbacks</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-muted-foreground text-xs">Média empresa:</span>
                            <Stars rating={4.7} />
                        </div>
                    </div>
                    <div className="rounded-lg border border-border/20 bg-muted/30 p-3">
                        <div className="font-semibold text-sm">Foco no Cliente</div>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-muted-foreground text-xs">Sua média:</span>
                            <span className="text-muted-foreground text-xs">Sem feedbacks</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-muted-foreground text-xs">Média empresa:</span>
                            <Stars rating={4.7} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Resumo Mensal ── */}
            <div className="rounded-xl border border-border/40 bg-card/60 p-3 backdrop-blur">
                <h6 className="font-bold text-sm mb-1">Resumo Mensal</h6>
                <div className="text-muted-foreground text-xs flex items-center gap-1">
                    <BarChart3 className="size-3.5" />
                    Sem feedbacks o suficiente para fazer a análise
                </div>
            </div>

            {/* ── 4 Tabs ── */}
            <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="flex flex-wrap gap-1 mb-3 border-b border-border/20 pb-2">
                    {TAB_CONFIG.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
                                }`}
                            onClick={() => { setTab(t.key); setPage(1); void loadData(t.key, 1); }}
                        >
                            {t.label} ({counts[t.key]})
                        </button>
                    ))}
                </div>

                {/* ── Table ── */}
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
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <Inbox className="size-8 opacity-30" />
                                        <div className="font-semibold">Não encontramos nada por aqui</div>
                                        <div className="text-xs">Nenhum feedback no período selecionado</div>
                                    </div>
                                </TableCell>
                            </TableRow>
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

                {/* ── Pagination ── */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
                        <span>Página {page} de {totalPages} ({data?.totalItems} registros)</span>
                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                                <ChevronLeft className="size-4" />
                            </Button>
                            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
