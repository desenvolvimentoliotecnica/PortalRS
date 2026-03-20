"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface OpLog {
    id: string;
    level: string | null;
    message: string | null;
    source: string | null;
    timestamp: string;
    exception: string | null;
}

interface OpLogListResponse { items: OpLog[]; totalCount: number; }

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) { const b = await res.json().catch(() => null); throw new Error((b as any)?.detail || `HTTP ${res.status}`); }
    return res.json();
}

const levelColors: Record<string, string> = {
    error: "bg-red-100 text-red-800",
    warning: "bg-amber-100 text-amber-800",
    information: "bg-sky-100 text-sky-800",
    debug: "bg-zinc-100 text-zinc-600",
};

export default function AdminOperationalLogsScreen() {
    const [logs, setLogs] = useState<OpLog[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [levelFilter, setLevelFilter] = useState("all");
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
            if (q.trim()) params.set("q", q.trim());
            if (levelFilter !== "all") params.set("level", levelFilter);
            const resp = await fetchJson<OpLogListResponse>(`/api/admin/operational-logs?${params}`);
            setLogs(resp.items ?? []);
            setTotal(resp.totalCount ?? 0);
        } catch { toast.error("Falha ao carregar logs operacionais."); }
        finally { setLoading(false); }
    }, [page, q, levelFilter]);

    useEffect(() => { void load(); }, [load]);
    const totalPages = Math.ceil(total / pageSize);

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h4 className="text-lg font-bold">Logs Operacionais</h4><div className="text-muted-foreground text-sm">Logs de operação e erros do sistema.</div></div>
                <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className="size-4" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur"><div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total</div><div className="mt-1 text-2xl font-bold text-primary">{total}</div></div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur"><div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Erros</div><div className="mt-1 text-2xl font-bold text-red-600">{logs.filter(l => l.level?.toLowerCase() === "error").length}</div></div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur"><div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Avisos</div><div className="mt-1 text-2xl font-bold text-amber-600">{logs.filter(l => l.level?.toLowerCase() === "warning").length}</div></div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur"><div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Info</div><div className="mt-1 text-2xl font-bold text-sky-600">{logs.filter(l => l.level?.toLowerCase() === "information").length}</div></div>
            </div>
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div className="font-semibold">Logs</div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="w-[200px] pl-8" placeholder="buscar..." value={q} onChange={e => { setQ(e.target.value); setPage(1); }} /></div>
                        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={levelFilter} onChange={e => { setLevelFilter(e.target.value); setPage(1); }}>
                            <option value="all">Todos níveis</option>
                            <option value="error">Erro</option>
                            <option value="warning">Aviso</option>
                            <option value="information">Informação</option>
                            <option value="debug">Debug</option>
                        </select>
                    </div>
                </div>
                <Table>
                    <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Nível</TableHead><TableHead>Origem</TableHead><TableHead>Mensagem</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                            : logs.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum log encontrado.</TableCell></TableRow>
                                : logs.map(l => (
                                    <TableRow key={l.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                                        <TableCell className="text-xs whitespace-nowrap">{new Date(l.timestamp).toLocaleString("pt-BR")}</TableCell>
                                        <TableCell><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${levelColors[l.level?.toLowerCase() ?? ""] ?? "bg-zinc-100 text-zinc-600"}`}>{l.level || "—"}</span></TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{l.source || "—"}</TableCell>
                                        <TableCell className="text-sm">
                                            <div className={expanded === l.id ? "" : "truncate max-w-[400px]"}>{l.message || "—"}</div>
                                            {expanded === l.id && l.exception && <pre className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2 whitespace-pre-wrap overflow-auto max-h-[200px]">{l.exception}</pre>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                    </TableBody>
                </Table>
                {totalPages > 1 && <div className="mt-3 flex items-center justify-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button><span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button></div>}
            </div>
        </section>
    );
}
