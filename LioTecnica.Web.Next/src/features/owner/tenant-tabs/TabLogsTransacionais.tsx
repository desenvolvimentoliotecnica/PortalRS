"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Filter, Loader2, RotateCw } from "lucide-react";
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

const BASE = "/app";

interface LogItem {
    id: string;
    transactionId: string;
    method: string;
    path: string;
    statusCode: number;
    isSuccess: boolean;
    userName: string | null;
    durationMs: number;
    startedAt: string;
}

interface LogDetail extends LogItem {
    ip: string | null;
    events: { order: number; eventType: string; name: string }[];
    changes: { entityName: string; state: string; primaryKeyJson: string; changedColumns: string | null; occurredAt: string }[];
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

export default function TabLogsTransacionais({ tenantId }: { tenantId: string }) {
    const apiBase = `${BASE}/Owner/Tenants/${encodeURIComponent(tenantId)}/Config/Logs/_api`;

    const [items, setItems] = useState<LogItem[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<SummaryData | null>(null);

    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [method, setMethod] = useState("nonget");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

    const [detail, setDetail] = useState<LogDetail | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    // KPIs
    const errors = items.filter((x) => !x.isSuccess || (x.statusCode ?? 0) >= 500).length;
    const avg = items.length ? Math.round(items.reduce((s, x) => s + (x.durationMs || 0), 0) / items.length) : 0;
    const users = new Set(items.map((x) => x.userName).filter(Boolean)).size;

    const loadLogs = useCallback(async (p: number) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(p), pageSize: "50" });
            if (search) params.set("search", search);
            if (status) params.set("status", status);
            if (method) {
                if (method === "nonget") params.set("methods", "POST,PUT,PATCH,DELETE");
                else params.set("methods", method);
            }
            if (from) params.set("from", new Date(from).toISOString());
            if (to) params.set("to", new Date(to).toISOString());

            const res = await fetch(`${apiBase}/transactions?${params}`, { credentials: "same-origin" });
            if (!res.ok) throw new Error();
            const data: PagedResponse = await res.json();
            setItems(data.items || []);
            setPage(data.page || 1);
            setTotalPages(data.totalPages || 1);
            setTotalItems(data.totalItems || 0);
        } catch {
            toast.error("Erro ao carregar logs.");
        } finally {
            setLoading(false);
        }
    }, [apiBase, search, status, method, from, to]);

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
            const res = await fetch(`${apiBase}/transactions/${id}`, { credentials: "same-origin" });
            if (!res.ok) return;
            setDetail(await res.json());
            setDetailOpen(true);
        } catch { }
    };

    const methodClass = (m: string) => {
        const cls: Record<string, string> = {
            get: "bg-blue-500 text-white",
            post: "bg-green-600 text-white",
            put: "bg-yellow-500 text-black",
            patch: "bg-pink-500 text-white",
            delete: "bg-red-500 text-white",
        };
        return cls[m.toLowerCase()] || "bg-gray-500 text-white";
    };

    return (
        <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Transações", value: totalItems, color: "bg-blue-500" },
                    { label: "Falhas", value: errors, color: "bg-red-500" },
                    { label: "Duração média", value: `${avg} ms`, color: "bg-cyan-500" },
                    { label: "Usuários únicos", value: users, color: "bg-green-500" },
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
                            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="rota, usuario, tx…" />
                        </div>
                        <div>
                            <label className="text-xs font-medium mb-1 block">Status</label>
                            <select className="h-9 rounded-md border px-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="">Todos</option>
                                <option value="success">Sucesso</option>
                                <option value="error">Erro</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium mb-1 block">Método</label>
                            <select className="h-9 rounded-md border px-2 text-sm" value={method} onChange={(e) => setMethod(e.target.value)}>
                                <option value="nonget">Sem GET</option>
                                <option value="">Todos</option>
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                                <option value="PUT">PUT</option>
                                <option value="DELETE">DELETE</option>
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
                                            <th className="text-left py-2 px-2 whitespace-nowrap">Quando</th>
                                            <th className="text-center py-2 px-2">Método</th>
                                            <th className="text-left py-2 px-2">Rota</th>
                                            <th className="text-center py-2 px-2">Status</th>
                                            <th className="text-center py-2 px-2">Usuário</th>
                                            <th className="text-right py-2 px-2">Duração</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.length === 0 ? (
                                            <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Nenhuma transação encontrada.</td></tr>
                                        ) : items.filter((i) => i.method && i.path && i.path !== "/").map((item) => (
                                            <tr
                                                key={item.id}
                                                className={`border-b cursor-pointer hover:bg-muted/50 transition ${!item.isSuccess ? "text-red-600" : ""}`}
                                                onClick={() => openDetail(item.id)}
                                            >
                                                <td className="py-1.5 px-2 whitespace-nowrap text-xs">{new Date(item.startedAt).toLocaleString("pt-BR")}</td>
                                                <td className="py-1.5 px-2 text-center">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${methodClass(item.method)}`}>{item.method.toUpperCase()}</span>
                                                </td>
                                                <td className="py-1.5 px-2 font-mono text-xs max-w-[400px] truncate">{item.path}</td>
                                                <td className="py-1.5 px-2 text-center">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${item.isSuccess ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                                        {item.statusCode ?? "-"}
                                                    </span>
                                                </td>
                                                <td className="py-1.5 px-2 text-center text-xs">{item.userName || "-"}</td>
                                                <td className="py-1.5 px-2 text-right font-mono text-xs">{item.durationMs} ms</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-center justify-between mt-3">
                                <span className="text-xs text-muted-foreground">{totalItems} transações</span>
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
                    <DialogHeader>
                        <DialogTitle className="text-base">Transação {detail?.transactionId || "-"}</DialogTitle>
                    </DialogHeader>
                    {detail && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Card className="shadow-sm"><CardContent className="pt-4 space-y-1 text-sm">
                                    <div className="font-bold text-xs text-muted-foreground mb-1">HTTP</div>
                                    <div className="font-mono text-xs">{detail.method} {detail.path}</div>
                                    <div className="text-xs text-muted-foreground">{new Date(detail.startedAt).toLocaleString("pt-BR")} | {detail.durationMs} ms | {detail.statusCode}</div>
                                    <div className="text-xs">{detail.userName ? `Usuário: ${detail.userName} | IP: ${detail.ip || "-"}` : `IP: ${detail.ip || "-"}`}</div>
                                </CardContent></Card>
                                <Card className="shadow-sm"><CardContent className="pt-4">
                                    <div className="font-bold text-xs text-muted-foreground mb-1">Eventos</div>
                                    {detail.events?.length ? (
                                        <ul className="space-y-0.5">{detail.events.map((ev) => (
                                            <li key={ev.order} className="text-xs">#{ev.order} {ev.eventType} — {ev.name}</li>
                                        ))}</ul>
                                    ) : <p className="text-xs text-muted-foreground">Sem eventos.</p>}
                                </CardContent></Card>
                            </div>
                            {detail.changes?.length > 0 && (
                                <Card className="shadow-sm"><CardContent className="pt-4">
                                    <div className="font-bold text-xs text-muted-foreground mb-2">Mudanças no banco</div>
                                    <div className="overflow-x-auto"><table className="w-full text-xs">
                                        <thead><tr className="border-b text-muted-foreground">
                                            <th className="text-left py-1 px-2">Entidade</th><th className="py-1 px-2">Estado</th><th className="py-1 px-2">Chaves</th><th className="py-1 px-2">Colunas</th><th className="py-1 px-2">Horário</th>
                                        </tr></thead>
                                        <tbody>{detail.changes.map((ch, i) => (
                                            <tr key={i} className="border-b">
                                                <td className="py-1 px-2">{ch.entityName}</td>
                                                <td className="py-1 px-2 font-mono">{ch.state}</td>
                                                <td className="py-1 px-2 font-mono max-w-[150px] truncate">{ch.primaryKeyJson}</td>
                                                <td className="py-1 px-2">{ch.changedColumns || "-"}</td>
                                                <td className="py-1 px-2 whitespace-nowrap">{new Date(ch.occurredAt).toLocaleString("pt-BR")}</td>
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
