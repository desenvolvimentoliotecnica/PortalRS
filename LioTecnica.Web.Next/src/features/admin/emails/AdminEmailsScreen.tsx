"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface EmailItem {
    id: string;
    to: string | null;
    subject: string | null;
    sentAt: string | null;
    status: string | null;
    templateName: string | null;
}

interface EmailListResponse { items: EmailItem[]; totalCount: number; }

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) { const b = await res.json().catch(() => null); throw new Error((b as any)?.detail || `HTTP ${res.status}`); }
    return res.json();
}

export default function AdminEmailsScreen() {
    const [emails, setEmails] = useState<EmailItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
            if (q.trim()) params.set("q", q.trim());
            const resp = await fetchJson<EmailListResponse>(`/api/admin/emails?${params}`);
            setEmails(resp.items ?? []);
            setTotal(resp.totalCount ?? 0);
        } catch { toast.error("Falha ao carregar emails."); }
        finally { setLoading(false); }
    }, [page, q]);

    useEffect(() => { void load(); }, [load]);
    const totalPages = Math.ceil(total / pageSize);

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h4 className="text-lg font-bold">Emails Enviados</h4><div className="text-muted-foreground text-sm">Histórico de emails disparados pelo sistema.</div></div>
                <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className="size-4" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-3"><div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur"><div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total</div><div className="mt-1 text-2xl font-bold text-primary">{total}</div></div><div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur"><div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Exibindo</div><div className="mt-1 text-2xl font-bold text-sky-600">{emails.length}</div></div></div>
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div className="font-semibold">Histórico</div><div className="relative"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="w-[240px] pl-8" placeholder="buscar email, assunto..." value={q} onChange={e => { setQ(e.target.value); setPage(1); }} /></div></div>
                <Table>
                    <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Destinatário</TableHead><TableHead>Assunto</TableHead><TableHead>Template</TableHead><TableHead className="text-center">Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                            : emails.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum email encontrado.</TableCell></TableRow>
                                : emails.map(e => (
                                    <TableRow key={e.id}>
                                        <TableCell className="text-xs whitespace-nowrap">{e.sentAt ? new Date(e.sentAt).toLocaleString("pt-BR") : "—"}</TableCell>
                                        <TableCell className="font-medium">{e.to || "—"}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">{e.subject || "—"}</TableCell>
                                        <TableCell className="text-xs">{e.templateName || "—"}</TableCell>
                                        <TableCell className="text-center">{e.status === "sent" ? <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">Enviado</span> : <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">{e.status || "—"}</span>}</TableCell>
                                    </TableRow>
                                ))}
                    </TableBody>
                </Table>
                {totalPages > 1 && <div className="mt-3 flex items-center justify-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button><span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button></div>}
            </div>
        </section>
    );
}
