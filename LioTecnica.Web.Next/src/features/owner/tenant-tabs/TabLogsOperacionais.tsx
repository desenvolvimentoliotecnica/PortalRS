"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Filter, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { getBackendUrl } from "@/lib/getBackendUrl";

const BASE = getBackendUrl();

interface LogItem {
    id: string;
    transactionId: string;
    method: string;
    path: string;
    statusCode: number;
    userName: string | null;
    durationMs: number;
    startedAt: string;
}

interface LogDetail extends LogItem {
    ip: string | null;
    exceptions: { order: number; exceptionType: string; statusCode: number; message: string }[];
    entries: { level: string; category: string; message: string; occurredAt: string }[];
}

interface SummaryData {
    topRoutes: { key: string; count: number }[];
    topUsers: { key: string; count: number }[];
}

interface PagedResponse {
    items: LogItem[];
    page: number;
    totalPages: number;
    totalItems: number;
}

export default function TabLogsOperacionais({ tenantId }: { tenantId: string }) {
    const apiBase = `${BASE}/Owner/Tenants/${encodeURIComponent(tenantId)}/Config/OperationalLogs/_api`;

    const [items, setItems] = useState<LogItem[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<SummaryData | null>(null);

    const [search, setSearch] = useState("");
    const [level, setLevel] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    const [detail, setDetail] = useState<LogDetail | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const errors = items.filter((x) => (x.statusCode ?? 0) >= 500).length;
    const warnings = items.filter((x) => (x.statusCode ?? 0) >= 400 && (x.statusCode ?? 0) < 500).length;
    const avg = items.length ? Math.round(items.reduce((s, x) => s + (x.durationMs || 0), 0) / items.length) : 0;

    const loadLogs = useCallback(async (p: number) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(p), pageSize: "50" });
            if (search) params.set("search", search);
            if (level) params.set("level", level);
            if (from) params.set("from", new Date(from).toISOString());
            if (to) params.set("to", new Date(to).toISOString());
            const res = await fetch(`${apiBase}/requests?${params}`, { credentials: "same-origin" });
            if (!res.ok) throw new Error();
            const data: PagedResponse = await res.json();
            setItems(data.items || []);
            setPage(data.page || 1);
            setTotalPages(data.totalPages || 1);
            setTotalItems(data.totalItems || 0);
        } catch { toast.error("Erro ao carregar logs operacionais."); }
        finally { setLoading(false); }
    }, [apiBase, search, level, from, to]);

    const loadSummary = useCallback(async () => {
        try {
            const params = new URLSearchParams({ top: "6" });
            if (from) params.set("from", new Date(from).toISOString());
            if (to) params.set("to", new Date(to).toISOString());
            const res = await fetch(`${apiBase}/summary?${params}`, { credentials: "same-origin" });
            if (res.ok) setSummary(await res.json());
        } catch { }
    }, [apiBase, from, to]);

    useEffect(() => { loadLogs(1); loadSummary(); }, [loadLogs, loadSummary]);

    const openDetail = async (id: string) => {
        try {
            const res = await fetch(`${apiBase}/requests/${id}`, { credentials: "same-origin" });
            if (!res.ok) return;
            setDetail(await res.json());
            setDetailOpen(true);
        } catch { }
    };

    const levelBadge = (code: number) => {
        if (code >= 500) return { label: "ERROR", cls: "bg-red-100 text-red-700" };
        if (code >= 400) return { label: "WARN", cls: "bg-yellow-100 text-yellow-700" };
        return { label: "INFO", cls: "bg-blue-100 text-blue-700" };
    };

    const methodClass = (m: string) => {
        const cls: Record<string, string> = {
            get: "bg-blue-500 text-white", post: "bg-green-600 text-white",
            put: "bg-yellow-500 text-black", patch: "bg-pink-500 text-white", delete: "bg-red-500 text-white",
        };
        return cls[m.toLowerCase()] || "bg-gray-500 text-white";
    };

    return (
        <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Requisições", value: totalItems, color: "bg-blue-500" },
                    { label: "Erros (5xx)", value: errors, color: "bg-red-500" },
                    { label: "Warnings (4xx)", value: warnings, color: "bg-yellow-500" },
                    { label: "Duração média", value: `${avg} ms`, color: "bg-cyan-500" },
                ].map((k) => (
                    <Card key={k.label} className="shadow-lt">
                        <CardContent className="pt-4 pb-4 flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl ${k.color} flex items-center justify-center text-white text-lg font-bold`}>
                                {typeof k.value === "number" ? (k.value > 99 ? "99+" : k.value) : "⏱"}
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">{k.label}</div>
                                <div className="font-bold text-sm">{k.value}</div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Summary */}
            {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                        { title: "Rotas mais acessadas", data: summary.topRoutes },
                        { title: "Usuários mais ativos", data: summary.topUsers },
                    ].map((s) => (
                        <Card key={s.title} className="shadow-lt">
                            <CardHeader className="pb-2"><CardTitle className="text-sm">{s.title}</CardTitle></CardHeader>
                            <CardContent className="space-y-1.5">
                                {s.data?.length ? s.data.map((r) => (
                                    <div key={r.key} className="flex items-center justify-between text-sm bg-muted/50 rounded-lg px-2.5 py-1.5">
                                        <span className="truncate font-medium">{r.key}</span>
                                        <span className="text-xs font-bold text-[rgb(var(--lt-brand))] bg-[rgb(var(--lt-brand))]/10 px-2 py-0.5 rounded-full">{r.count}</span>
                                    </div>
                                )) : <p className="text-xs text-muted-foreground">Sem dados.</p>}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Filters + Table */}
            <Card className="shadow-lt">
                <CardContent className="pt-5">
                    <div className="flex flex-wrap gap-2 items-end mb-4">
                        <div className="min-w-[180px]">
                            <label className="text-xs font-medium mb-1 block">Buscar</label>
                            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="rota, usuario…" />
                        </div>
                        <div>
                            <label className="text-xs font-medium mb-1 block">Nível</label>
                            <select className="h-9 rounded-md border px-2 text-sm" value={level} onChange={(e) => setLevel(e.target.value)}>
                                <option value="">Todos</option>
                                <option value="error">Erro</option>
                                <option value="warning">Warning</option>
                                <option value="info">Info</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium mb-1 block">De</label>
                            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[180px]" />
                        </div>
                        <div>
                            <label className="text-xs font-medium mb-1 block">Até</label>
                            <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} className="w-[180px]" />
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { loadLogs(1); loadSummary(); }}>
                            <Filter className="size-3.5 mr-1" />Aplicar
                        </Button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-xs text-muted-foreground">
                                            <th className="text-left py-2 px-2">Quando</th>
                                            <th className="text-center py-2 px-2">Nível</th>
                                            <th className="text-center py-2 px-2">Método</th>
                                            <th className="text-left py-2 px-2">Rota</th>
                                            <th className="text-center py-2 px-2">Usuário</th>
                                            <th className="text-right py-2 px-2">Duração</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.length === 0 ? (
                                            <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Nenhum registro encontrado.</td></tr>
                                        ) : items.map((item) => {
                                            const badge = levelBadge(item.statusCode);
                                            return (
                                                <tr key={item.id} className={`border-b cursor-pointer hover:bg-muted/50 transition ${(item.statusCode ?? 0) >= 500 ? "text-red-600" : ""}`} onClick={() => openDetail(item.id)}>
                                                    <td className="py-1.5 px-2 whitespace-nowrap text-xs">{new Date(item.startedAt).toLocaleString("pt-BR")}</td>
                                                    <td className="py-1.5 px-2 text-center"><span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${badge.cls}`}>{badge.label}</span></td>
                                                    <td className="py-1.5 px-2 text-center"><span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${methodClass(item.method)}`}>{item.method.toUpperCase()}</span></td>
                                                    <td className="py-1.5 px-2 font-mono text-xs max-w-[400px] truncate">{item.path}</td>
                                                    <td className="py-1.5 px-2 text-center text-xs">{item.userName || "-"}</td>
                                                    <td className="py-1.5 px-2 text-right font-mono text-xs">{item.durationMs} ms</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex items-center justify-between mt-3">
                                <span className="text-xs text-muted-foreground">{totalItems} registros</span>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" onClick={() => loadLogs(page - 1)} disabled={page <= 1}><ChevronLeft className="size-4" /></Button>
                                    <span className="text-xs">Pág {page}/{totalPages}</span>
                                    <Button variant="outline" size="sm" onClick={() => loadLogs(page + 1)} disabled={page >= totalPages}><ChevronRight className="size-4" /></Button>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Detail Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader><DialogTitle className="text-base">Requisição {detail?.transactionId || "-"}</DialogTitle></DialogHeader>
                    {detail && (
                        <div className="space-y-4">
                            <Card className="shadow-sm"><CardContent className="pt-4 space-y-1 text-sm">
                                <div className="font-mono text-xs">{detail.method} {detail.path}</div>
                                <div className="text-xs text-muted-foreground">{new Date(detail.startedAt).toLocaleString("pt-BR")} | {detail.durationMs} ms | {detail.statusCode}</div>
                                <div className="text-xs">{detail.userName ? `Usuário: ${detail.userName} | IP: ${detail.ip || "-"}` : `IP: ${detail.ip || "-"}`}</div>
                            </CardContent></Card>
                            {detail.exceptions?.length > 0 && (
                                <Card className="shadow-sm"><CardContent className="pt-4">
                                    <div className="font-bold text-xs text-muted-foreground mb-1">Exceções</div>
                                    <ul className="space-y-0.5">{detail.exceptions.map((ex) => (
                                        <li key={ex.order} className="text-xs">#{ex.order} {ex.exceptionType} ({ex.statusCode}) — {ex.message}</li>
                                    ))}</ul>
                                </CardContent></Card>
                            )}
                            {detail.entries?.length > 0 && (
                                <Card className="shadow-sm"><CardContent className="pt-4">
                                    <div className="font-bold text-xs text-muted-foreground mb-2">Log entries</div>
                                    <div className="overflow-x-auto"><table className="w-full text-xs">
                                        <thead><tr className="border-b text-muted-foreground"><th className="py-1 px-2">Nível</th><th className="py-1 px-2">Categoria</th><th className="py-1 px-2">Mensagem</th><th className="py-1 px-2">Horário</th></tr></thead>
                                        <tbody>{detail.entries.map((e, i) => (
                                            <tr key={i} className="border-b">
                                                <td className="py-1 px-2"><span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${e.level.toLowerCase() === "error" ? "bg-red-100 text-red-700" : e.level.toLowerCase() === "warning" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>{e.level.toUpperCase()}</span></td>
                                                <td className="py-1 px-2">{e.category}</td>
                                                <td className="py-1 px-2">{e.message}</td>
                                                <td className="py-1 px-2 whitespace-nowrap">{new Date(e.occurredAt).toLocaleString("pt-BR")}</td>
                                            </tr>
                                        ))}</tbody>
                                    </table></div>
                                </CardContent></Card>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
