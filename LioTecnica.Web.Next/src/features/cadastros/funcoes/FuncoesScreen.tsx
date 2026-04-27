"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import PaginationBar from "@/components/pagination/PaginationBar";
import { apiFetch } from "@/lib/api";

interface FuncaoItem {
    codigo: string;
    nome: string | null;
    total: number;
    totalAtivos: number;
    totalInativos: number;
}

type SortKey = "codigo" | "nome" | "total" | "totalAtivos" | "totalInativos";

const PAGE_SIZES = [10, 20, 50, 100];

async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
}

export default function FuncoesScreen() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<FuncaoItem[]>([]);
    const [q, setQ] = useState("");
    const [debouncedQ, setDebouncedQ] = useState("");
    const [sort, setSort] = useState<SortKey>("totalAtivos");
    const [dir, setDir] = useState<"asc" | "desc">("desc");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const url = debouncedQ ? `/api/funcoes?q=${encodeURIComponent(debouncedQ)}` : "/api/funcoes";
            const data = await fetchJson<FuncaoItem[]>(url);
            setRows(Array.isArray(data) ? data : []);
        } catch {
            toast.error("Falha ao carregar funções.");
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [debouncedQ]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => { void load(); }, [load]);

    const sorted = useMemo(() => {
        const sgn = dir === "asc" ? 1 : -1;
        const cmp = (a: FuncaoItem, b: FuncaoItem) => {
            switch (sort) {
                case "codigo": return (a.codigo || "").localeCompare(b.codigo || "") * sgn;
                case "nome": return ((a.nome ?? "").localeCompare(b.nome ?? "")) * sgn;
                case "total": return (a.total - b.total) * sgn;
                case "totalAtivos": return (a.totalAtivos - b.totalAtivos) * sgn;
                case "totalInativos": return (a.totalInativos - b.totalInativos) * sgn;
            }
        };
        return [...rows].sort(cmp);
    }, [rows, sort, dir]);

    const totalItems = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

    function clickSort(key: SortKey) {
        if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setSort(key); setDir(key === "codigo" || key === "nome" ? "asc" : "desc"); }
    }

    function sortIcon(key: SortKey) {
        if (sort !== key) return <ChevronsUpDown className="size-3 ml-1 inline opacity-50" />;
        return dir === "asc" ? <ChevronUp className="size-3 ml-1 inline" /> : <ChevronDown className="size-3 ml-1 inline" />;
    }

    const totals = useMemo(() => {
        return rows.reduce((acc, r) => {
            acc.funcoes++;
            acc.ativos += r.totalAtivos;
            acc.inativos += r.totalInativos;
            return acc;
        }, { funcoes: 0, ativos: 0, inativos: 0 });
    }, [rows]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Funções</h1>
                    <p className="text-sm text-muted-foreground">Funções específicas dos funcionários (PFUNCAO no TOTVS RM) — descrição mais granular que Cargo.</p>
                </div>
                <Button variant="outline" onClick={() => void load()} disabled={loading}>
                    <RefreshCw className={loading ? "animate-spin" : ""} /> Atualizar
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Funções únicas</p>
                    <p className="mt-1 text-2xl font-bold">{totals.funcoes}</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Funcionários ativos</p>
                    <p className="mt-1 text-2xl font-bold text-emerald-600">{totals.ativos}</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Inativos / desligados</p>
                    <p className="mt-1 text-2xl font-bold text-amber-600">{totals.inativos}</p>
                </div>
            </div>

            <div className="rounded-xl border bg-card">
                <div className="p-4 flex items-center justify-between gap-3 flex-wrap border-b">
                    <div>
                        <h2 className="text-base font-semibold flex items-center gap-2">
                            <ListChecks className="size-4 text-violet-600" /> Lista de funções
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">Clique numa função pra filtrar funcionários por ela.</p>
                    </div>
                    <div className="relative w-full max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <Input
                            placeholder="código ou nome..."
                            className="pl-8"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="cursor-pointer" onClick={() => clickSort("codigo")}>Código{sortIcon("codigo")}</TableHead>
                            <TableHead className="cursor-pointer" onClick={() => clickSort("nome")}>Função{sortIcon("nome")}</TableHead>
                            <TableHead className="cursor-pointer text-right" onClick={() => clickSort("totalAtivos")}>Ativos{sortIcon("totalAtivos")}</TableHead>
                            <TableHead className="cursor-pointer text-right" onClick={() => clickSort("totalInativos")}>Inativos{sortIcon("totalInativos")}</TableHead>
                            <TableHead className="cursor-pointer text-right" onClick={() => clickSort("total")}>Total{sortIcon("total")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
                        ) : pageRows.length ? pageRows.map((f) => (
                            <TableRow key={f.codigo}>
                                <TableCell className="font-mono text-sm">{f.codigo}</TableCell>
                                <TableCell className="font-medium">{f.nome ?? <span className="text-muted-foreground italic">sem descrição</span>}</TableCell>
                                <TableCell className="text-right">
                                    <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                        {f.totalAtivos}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right">
                                    {f.totalInativos > 0 ? (
                                        <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                                            {f.totalInativos}
                                        </span>
                                    ) : <span className="text-xs text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell className="text-right text-sm font-mono">{f.total}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma função encontrada.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>

                <PaginationBar
                    page={page}
                    pageSize={pageSize}
                    totalItems={totalItems}
                    pageSizes={PAGE_SIZES}
                    onPageChange={(p) => { if (p >= 1 && p <= totalPages) setPage(p); }}
                    onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
                />
            </div>
        </div>
    );
}
