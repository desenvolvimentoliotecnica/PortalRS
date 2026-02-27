"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";

/* ── Types (from LoggingController) ── */
interface LogListItem {
    id: string;
    transactionId: string;
    startedAt: string;
    durationMs: number;
    method: string | null;
    path: string | null;
    statusCode: number | null;
    isSuccess: boolean;
    userName: string | null;
    environmentNormalized: string | null;
    deviceType: string;
}
interface LogListResponse {
    items: LogListItem[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}
interface SummaryItem { key: string; count: number; avgDurationMs: number; }
interface StatusItem { statusCode: number; count: number; }
interface LogSummary { topRoutes: SummaryItem[]; topUsers: SummaryItem[]; statuses: StatusItem[]; }

async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function fmtDate(iso: string) {
    try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
}

function levelBadge(item: LogListItem) {
    if (!item.isSuccess && (item.statusCode ?? 0) >= 500)
        return <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-xs font-medium">Error</span>;
    if (!item.isSuccess && (item.statusCode ?? 0) >= 400)
        return <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">Warning</span>;
    return <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">OK</span>;
}

export default function AdminOperationalLogsScreen() {
    const [q, setQ] = useState("");
    const [levelFilter, setLevelFilter] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [page, setPage] = useState(1);
    const [data, setData] = useState<LogListResponse | null>(null);
    const [summary, setSummary] = useState<LogSummary | null>(null);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("pageSize", "50");
            if (q.trim()) params.set("search", q.trim());
            if (levelFilter) params.set("level", levelFilter);
            if (fromDate) params.set("from", new Date(fromDate).toISOString());
            if (toDate) params.set("to", new Date(toDate).toISOString());

            const [list, sum] = await Promise.all([
                fetchJson<LogListResponse>(`/api/logs/requests?${params}`),
                fetchJson<LogSummary>("/api/logs/summary"),
            ]);
            setData(list);
            setSummary(sum);
        } catch (err) {
            console.error("Failed to load operational logs", err);
        } finally {
            setLoading(false);
        }
    }, [q, levelFilter, fromDate, toDate, page]);

    useEffect(() => { void loadData(); }, [loadData]);

    const kpis = useMemo(() => {
        const total = data?.totalItems ?? 0;
        const errors = summary?.statuses?.filter(s => s.statusCode >= 500).reduce((a, c) => a + c.count, 0) ?? 0;
        const warnings = summary?.statuses?.filter(s => s.statusCode >= 400 && s.statusCode < 500).reduce((a, c) => a + c.count, 0) ?? 0;
        const avgDuration = summary?.topRoutes?.length
            ? Math.round(summary.topRoutes.reduce((a, c) => a + c.avgDurationMs, 0) / summary.topRoutes.length)
            : 0;
        return [
            { label: "Requisições", value: total.toLocaleString("pt-BR"), color: "text-primary" },
            { label: "Erros (5xx)", value: errors.toLocaleString("pt-BR"), color: "text-red-600" },
            { label: "Warnings (4xx)", value: warnings.toLocaleString("pt-BR"), color: "text-amber-600" },
            { label: "Duração média", value: `${avgDuration} ms`, color: "text-sky-600" },
        ];
    }, [data, summary]);

    const items = data?.items ?? [];

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Logs Operacionais</h4>
                    <div className="text-muted-foreground text-sm">Logs gerais, warnings e erros do app.</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
                    {loading ? "Carregando..." : "Atualizar"}
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {kpis.map((k) => (
                    <div key={k.label} className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{k.label}</div>
                        <div className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold">Rotas mais acessadas</div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Top 6</span>
                    </div>
                    {summary?.topRoutes?.length ? (
                        <div className="space-y-1">
                            {summary.topRoutes.map((r) => (
                                <div key={r.key} className="flex justify-between text-sm">
                                    <code className="text-xs truncate max-w-[300px]">{r.key}</code>
                                    <span className="text-muted-foreground whitespace-nowrap">{r.count}× · {r.avgDurationMs}ms</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground text-sm py-4">Nenhum dado disponível.</div>
                    )}
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold">Usuários mais ativos</div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Top 6</span>
                    </div>
                    {summary?.topUsers?.length ? (
                        <div className="space-y-1">
                            {summary.topUsers.map((u) => (
                                <div key={u.key} className="flex justify-between text-sm">
                                    <span className="truncate max-w-[200px]">{u.key}</span>
                                    <span className="text-muted-foreground whitespace-nowrap">{u.count}× · {u.avgDurationMs}ms</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground text-sm py-4">Nenhum dado disponível.</div>
                    )}
                </div>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div className="font-semibold">Requisições monitoradas</div>
                        <div className="text-muted-foreground text-sm">Clique em uma linha para ver detalhes.</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[220px] pl-8" placeholder="rota, usuário, tx..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
                            <option value="">Todos</option>
                            <option value="warning">Warning</option>
                            <option value="error">Error</option>
                        </select>
                        <Input className="w-[160px]" type="datetime-local" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                        <Input className="w-[160px]" type="datetime-local" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Quando</TableHead>
                            <TableHead>Nível</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead>Rota</TableHead>
                            <TableHead>Usuário</TableHead>
                            <TableHead className="text-right">Duração</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell>
                            </TableRow>
                        ) : items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                    Nenhuma requisição encontrada.
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item) => (
                                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/30">
                                    <TableCell className="whitespace-nowrap text-xs">{fmtDate(item.startedAt)}</TableCell>
                                    <TableCell>{levelBadge(item)}</TableCell>
                                    <TableCell><code className="text-xs">{item.method}</code></TableCell>
                                    <TableCell className="max-w-[300px] truncate text-xs"><code>{item.path}</code></TableCell>
                                    <TableCell className="text-xs">{item.userName || "—"}</TableCell>
                                    <TableCell className="text-right text-xs">{item.durationMs}ms</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {data && data.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
                        <span>Página {data.page} de {data.totalPages} ({data.totalItems} registros)</span>
                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                                <ChevronLeft className="size-4" />
                            </Button>
                            <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
                                <ChevronRight className="size-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
