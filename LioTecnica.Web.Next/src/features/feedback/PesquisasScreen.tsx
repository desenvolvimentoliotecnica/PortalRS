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
    const [pageSize, setPageSize] = useState(10);
    const [q, setQ] = useState("");

    // Create form
    const [showCreate, setShowCreate] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newType, setNewType] = useState("rapida");
    const [newStart, setNewStart] = useState("");
    const [newEnd, setNewEnd] = useState("");
    const [creating, setCreating] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetchJson<SurveyList>(`/api/feedback/surveys?page=${page}&pageSize=${pageSize}`);
            setData(result);
        } catch (err) {
            console.error("Failed to load surveys", err);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize]);

    useEffect(() => { void loadData(); }, [loadData]);

    const items = data?.items ?? [];
    const filtered = q.trim()
        ? items.filter(s => s.title?.toLowerCase().includes(q.toLowerCase()))
        : items;
    const totalPages = Math.ceil((data?.totalItems ?? 0) / pageSize);

    function statusBadge(s: SurveySummary) {
        if (s.endAtUtc && new Date(s.endAtUtc) < new Date()) return <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-xs font-medium">Encerrada</span>;
        if (s.startAtUtc && new Date(s.startAtUtc) <= new Date()) return <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">Ativa</span>;
        return <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-xs font-medium">Rascunho</span>;
    }

    function typeBadge(type: string) {
        const lower = (type || "").toLowerCase();
        if (lower.includes("rapida") || lower.includes("rápida"))
            return <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-xs font-medium">Rápida</span>;
        if (lower.includes("super"))
            return <span className="inline-flex items-center rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 text-xs font-medium">Super</span>;
        return <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">{type || "—"}</span>;
    }

    async function handleCreate() {
        if (!newTitle.trim()) { toast.error("Preencha o título."); return; }
        setCreating(true);
        try {
            await fetchJson("/api/feedback/surveys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: newTitle.trim(),
                    type: newType,
                    startAtUtc: newStart ? new Date(newStart).toISOString() : null,
                    endAtUtc: newEnd ? new Date(newEnd).toISOString() : null,
                }),
            });
            toast.success("Pesquisa criada!");
            setNewTitle(""); setShowCreate(false);
            void loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao criar.");
        } finally { setCreating(false); }
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Pesquisas</h4>
                    <div className="text-muted-foreground text-sm">Gerencie pesquisas de clima e engajamento.</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
                    <RefreshCw className="mr-1 size-4" />
                    Atualizar
                </Button>
                <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
                    <Plus className="mr-1 size-4" />
                    Nova Pesquisa
                </Button>
            </div>

            {showCreate && (
                <div className="card-soft rounded-xl border border-primary/30 bg-card/60 p-4 backdrop-blur space-y-3">
                    <div className="font-semibold">Criar Pesquisa</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Input placeholder="Título da pesquisa" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={newType} onChange={e => setNewType(e.target.value)}>
                            <option value="rapida">Rápida</option>
                            <option value="super">Super</option>
                        </select>
                        <Input type="datetime-local" placeholder="Início" value={newStart} onChange={e => setNewStart(e.target.value)} />
                        <Input type="datetime-local" placeholder="Fim" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
                    </div>
                    <Button onClick={() => void handleCreate()} disabled={creating}>
                        {creating ? "Criando..." : "Criar"}
                    </Button>
                </div>
            )}

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
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Exibindo</span>
                        <select className="h-8 rounded-md border border-input bg-transparent px-1 text-sm" style={{ width: 60 }} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <span className="text-sm text-muted-foreground">resultados por página</span>
                    </div>
                    <div className="relative max-w-[250px]">
                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-8" placeholder="Filtrar..." value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Pesquisa</TableHead>
                            <TableHead>Data Criação</TableHead>
                            <TableHead>Data Encerramento</TableHead>
                            <TableHead>Departamentos</TableHead>
                            <TableHead className="text-right">Respostas</TableHead>
                            <TableHead className="text-right">Média</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum registro encontrado</TableCell></TableRow>
                        ) : (
                            filtered.map((s) => (
                                <TableRow key={s.id}>
                                    <TableCell className="font-medium flex items-center gap-2"><ClipboardList className="size-4 text-primary" /> {s.title}</TableCell>
                                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(s.createdAtUtc)}</TableCell>
                                    <TableCell className="text-xs whitespace-nowrap">{fmtDate(s.endAtUtc)}</TableCell>
                                    <TableCell className="text-xs">—</TableCell>
                                    <TableCell className="text-right font-semibold">{s.responseCount}</TableCell>
                                    <TableCell className="text-right text-xs">—</TableCell>
                                    <TableCell>{statusBadge(s)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm">Ver</Button>
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
