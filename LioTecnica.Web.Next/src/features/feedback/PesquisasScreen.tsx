"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, ChevronLeft, ChevronRight, Plus, Search, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

/* ── Types ── */
interface SurveySummary {
    id: string;
    title: string;
    type: string;
    createdAtUtc: string;
    startAtUtc: string | null;
    endAtUtc: string | null;
    responseCount: number;
}
interface SurveyList {
    items: SurveySummary[];
    totalItems: number;
    page: number;
    pageSize: number;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function fmtDate(iso: string | null) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
}

export default function PesquisasScreen() {
    const [data, setData] = useState<SurveyList | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [q, setQ] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchJson<SurveyList>(`/api/feedback/surveys?page=${page}&pageSize=20`);
            setData(result);
        } catch (err) {
            console.error("Failed to load surveys", err);
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => { void loadData(); }, [loadData]);

    const items = data?.items ?? [];
    const filtered = q.trim()
        ? items.filter(s => s.title?.toLowerCase().includes(q.toLowerCase()))
        : items;
    const totalPages = Math.ceil((data?.totalItems ?? 0) / 20);

    function typeBadge(type: string) {
        const lower = (type || "").toLowerCase();
        if (lower.includes("rapida") || lower.includes("rápida"))
            return <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">Rápida</span>;
        if (lower.includes("super"))
            return <span className="inline-flex items-center rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 text-xs font-medium">Super</span>;
        return <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">{type || "—"}</span>;
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Pesquisas</h4>
                    <div className="text-muted-foreground text-sm">Gerencie pesquisas de clima e engajamento.</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void loadData()} disabled={loading}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{data?.totalItems ?? 0}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Respostas</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-600">{items.reduce((a, s) => a + (s.responseCount ?? 0), 0)}</div>
                </div>
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-8" placeholder="Filtrar..." value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Título</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Início</TableHead>
                            <TableHead>Fim</TableHead>
                            <TableHead className="text-right">Respostas</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma pesquisa encontrada.</TableCell></TableRow>
                        ) : (
                            filtered.map((s) => (
                                <TableRow key={s.id}>
                                    <TableCell className="font-medium flex items-center gap-2"><ClipboardList className="size-4 text-primary" /> {s.title}</TableCell>
                                    <TableCell>{typeBadge(s.type)}</TableCell>
                                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(s.startAtUtc)}</TableCell>
                                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(s.endAtUtc)}</TableCell>
                                    <TableCell className="text-right font-semibold">{s.responseCount}</TableCell>
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
