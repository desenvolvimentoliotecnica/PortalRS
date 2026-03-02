"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, RefreshCw, Eye, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

/* ── Types ── */
interface AuditTransaction {
    id: string;
    userName: string | null;
    action: string | null;
    entityName: string | null;
    timestamp: string;
    details: string | null;
}

interface AuditListResponse {
    items: AuditTransaction[];
    totalCount: number;
}

interface AuditDetail {
    id: string;
    userName: string | null;
    action: string | null;
    entityName: string | null;
    entityId: string | null;
    timestamp: string;
    details: string | null;
    changes: Record<string, { oldValue: string; newValue: string }>[];
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as any)?.detail || (body as any)?.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export default function AdminLogsScreen() {
    const [transactions, setTransactions] = useState<AuditTransaction[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize] = useState(20);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // Detail
    const [detail, setDetail] = useState<AuditDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
            if (q.trim()) params.set("q", q.trim());
            if (dateFrom) params.set("from", dateFrom);
            if (dateTo) params.set("to", dateTo);
            const resp = await fetchJson<AuditListResponse>(`/Admin/Logs/_api/transactions?${params}`);
            setTransactions(resp.items ?? []);
            setTotal(resp.totalCount ?? 0);
        } catch {
            toast.error("Falha ao carregar logs.");
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, q, dateFrom, dateTo]);

    useEffect(() => { void loadLogs(); }, [loadLogs]);

    async function viewDetail(id: string) {
        setLoadingDetail(true);
        try {
            const d = await fetchJson<AuditDetail>(`/Admin/Logs/_api/transactions/${id}`);
            setDetail(d);
        } catch {
            toast.error("Falha ao carregar detalhes.");
        } finally {
            setLoadingDetail(false);
        }
    }

    const totalPages = Math.ceil(total / pageSize);

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Logs Transacionais</h4>
                    <div className="text-muted-foreground text-sm">Auditoria de operações do sistema.</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void loadLogs()} disabled={loading}><RefreshCw className="size-4" /></Button>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total de Registros</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{total}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Página</div>
                    <div className="mt-1 text-2xl font-bold text-sky-600">{page} / {totalPages || 1}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Exibindo</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-600">{transactions.length}</div>
                </div>
            </div>

            {/* Detail panel */}
            {detail && (
                <div className="card-soft rounded-xl border border-primary/30 bg-primary/5 p-4 backdrop-blur space-y-2">
                    <div className="flex items-center justify-between"><div className="font-semibold">Detalhes da Transação</div><Button variant="ghost" size="sm" onClick={() => setDetail(null)}>✕</Button></div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-muted-foreground">Usuário:</span> {detail.userName || "—"}</div>
                        <div><span className="text-muted-foreground">Ação:</span> {detail.action || "—"}</div>
                        <div><span className="text-muted-foreground">Entidade:</span> {detail.entityName || "—"}</div>
                        <div><span className="text-muted-foreground">ID Entidade:</span> <code className="text-xs">{detail.entityId || "—"}</code></div>
                        <div><span className="text-muted-foreground">Data:</span> {new Date(detail.timestamp).toLocaleString("pt-BR")}</div>
                    </div>
                    {detail.details && <div className="text-xs text-muted-foreground mt-2 bg-muted/30 rounded p-2 font-mono whitespace-pre-wrap">{detail.details}</div>}
                </div>
            )}

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div className="font-semibold">Transações</div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="w-[200px] pl-8" placeholder="buscar..." value={q} onChange={e => { setQ(e.target.value); setPage(1); }} /></div>
                        <Input type="date" className="w-[150px]" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
                        <Input type="date" className="w-[150px]" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
                    </div>
                </div>
                <Table>
                    <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Usuário</TableHead><TableHead>Ação</TableHead><TableHead>Entidade</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? (<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                        ) : transactions.length === 0 ? (<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum log encontrado.</TableCell></TableRow>
                        ) : (transactions.map(t => (
                            <TableRow key={t.id}>
                                <TableCell className="text-xs whitespace-nowrap">{new Date(t.timestamp).toLocaleString("pt-BR")}</TableCell>
                                <TableCell className="font-medium">{t.userName || "—"}</TableCell>
                                <TableCell><span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{t.action || "—"}</span></TableCell>
                                <TableCell className="text-sm text-muted-foreground">{t.entityName || "—"}</TableCell>
                                <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => void viewDetail(t.id)}><Eye className="size-4" /></Button></TableCell>
                            </TableRow>
                        )))}
                    </TableBody>
                </Table>
                {totalPages > 1 && (
                    <div className="mt-3 flex items-center justify-center gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                        <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
                    </div>
                )}
            </div>
        </section>
    );
}
