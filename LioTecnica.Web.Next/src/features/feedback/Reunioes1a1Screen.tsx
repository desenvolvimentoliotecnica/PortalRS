"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Plus, Trash2, ChevronLeft, ChevronRight, Search, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

/* ── Types ── */
interface OneOnOneMeeting {
    id: string;
    participantName: string;
    scheduledAt: string;
    notes: string | null;
    status: string;
    createdAtUtc: string;
}
interface OneOnOneList {
    items: OneOnOneMeeting[];
    totalItems: number;
    page: number;
    pageSize: number;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function fmtDate(iso: string) {
    try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
}

export default function Reunioes1a1Screen() {
    const [data, setData] = useState<OneOnOneList | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [q, setQ] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchJson<OneOnOneList>(`/api/feedback/oneonone?page=${page}&pageSize=20`);
            setData(result);
        } catch (err) {
            console.error("Failed to load 1:1 meetings", err);
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => { void loadData(); }, [loadData]);

    const items = data?.items ?? [];
    const filtered = q.trim()
        ? items.filter(m => m.participantName?.toLowerCase().includes(q.toLowerCase()) || m.notes?.toLowerCase().includes(q.toLowerCase()))
        : items;
    const totalPages = Math.ceil((data?.totalItems ?? 0) / 20);

    async function handleDelete(id: string) {
        if (!confirm("Excluir esta reunião 1:1?")) return;
        try {
            await apiFetch(`/api/feedback/oneonone/${id}`, { method: "DELETE" });
            toast.success("Reunião removida.");
            void loadData();
        } catch {
            toast.error("Falha ao remover reunião.");
        }
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Reuniões 1:1</h4>
                    <div className="text-muted-foreground text-sm">Gerencie suas reuniões individuais com colaboradores.</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void loadData()} disabled={loading}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-8" placeholder="Buscar colaborador..." value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Participante</TableHead>
                            <TableHead>Agendada para</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Notas</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma reunião 1:1 encontrada.</TableCell></TableRow>
                        ) : (
                            filtered.map((m) => (
                                <TableRow key={m.id}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        <Calendar className="size-4 text-primary" /> {m.participantName || "—"}
                                    </TableCell>
                                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(m.scheduledAt)}</TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{m.status}</span>
                                    </TableCell>
                                    <TableCell className="text-sm max-w-[200px] truncate">{m.notes || "—"}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void handleDelete(m.id)}>
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-3 text-sm text-muted-foreground">
                        <span>Página {page} de {totalPages}</span>
                        <div className="flex gap-1">
                            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="size-4" /></Button>
                            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="size-4" /></Button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
