"use client";

import React, { useState, useCallback } from "react";
import {
    CheckCircle2,
    XCircle,
    Clock,
    ArrowRightLeft,
    Search,
    RefreshCw,
} from "lucide-react";
import {
    Table,
    TableHeader,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { TableSkeleton } from "@/components/ui/ScreenSkeleton";
import { useQueryClient } from "@tanstack/react-query";
import IntegracaoDetalhesDrawer from "./IntegracaoDetalhesDrawer";

/* ── types ── */

interface IntegracaoTotvsListItem {
    id: string;
    tipoIntegracao: number;
    tipoIntegracaoLabel: string;
    nome: string;
    cpf: string | null;
    descricao: string;
    approvedAtUtc: string | null;
    // API serializa enum como string via JsonStringEnumConverter ("Sucesso"|"Falha"|"FalhaDefinitiva")
    // mas também pode vir como number (1|2|3) em alguns endpoints.
    integracaoResultado: number | string | null;
    integracaoMensagem: string | null;
    integradaEmUtc: string | null;
}

interface IntegracaoTotvsPainelResponse {
    items: IntegracaoTotvsListItem[];
    total: number;
    pendentes: number;
    sucesso: number;
    falha: number;
}

/* ── constants ── */

const TIPO_LABELS: Record<number, string> = {
    1: "Admissao",
    2: "Pgto Extra",
    3: "Desligamento",
    4: "Promocao",
    5: "Alt. Endereco",
    6: "Dependente",
    7: "Beneficio",
    8: "Ferias",
};

const TIPO_COLORS: Record<number, string> = {
    1: "bg-blue-100 text-blue-800",
    2: "bg-purple-100 text-purple-800",
    3: "bg-red-100 text-red-800",
    4: "bg-emerald-100 text-emerald-800",
    5: "bg-cyan-100 text-cyan-800",
    6: "bg-orange-100 text-orange-800",
    7: "bg-pink-100 text-pink-800",
    8: "bg-amber-100 text-amber-800",
};

const RESULTADO_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    "1": { label: "Sucesso", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    "2": { label: "Falha", color: "bg-red-500/15 text-red-700", icon: XCircle },
    "3": { label: "Falha Definitiva", color: "bg-red-700/20 text-red-800", icon: XCircle },
    Sucesso: { label: "Sucesso", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    Falha: { label: "Falha", color: "bg-red-500/15 text-red-700", icon: XCircle },
    FalhaDefinitiva: { label: "Falha Definitiva", color: "bg-red-700/20 text-red-800", icon: XCircle },
};

type FiltroResultado = "all" | "pendente" | "1" | "2";

/* ── component ── */

export default function IntegracaoTotvsScreen() {
    const queryClient = useQueryClient();
    const [filtroTipo, setFiltroTipo] = useState<string>("all");
    const [filtroResultado, setFiltroResultado] = useState<FiltroResultado>("all");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [drawerItem, setDrawerItem] = useState<IntegracaoTotvsListItem | null>(null);

    // Debounce search
    const searchTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const handleSearchChange = useCallback((value: string) => {
        setSearch(value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => setDebouncedSearch(value), 400);
    }, []);

    // Build query params
    const params = new URLSearchParams();
    if (filtroTipo !== "all") params.set("tipo", filtroTipo);
    if (filtroResultado === "1" || filtroResultado === "2") params.set("resultado", filtroResultado);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    params.set("take", "200");
    const qs = params.toString() ? `?${params.toString()}` : "";

    const queryKey = ["integracao-totvs", "painel", filtroTipo, filtroResultado, debouncedSearch];
    const { data, isLoading } = useApiQuery<IntegracaoTotvsPainelResponse>(
        queryKey,
        `/api/integracao-totvs/painel${qs}`
    );

    const items = data?.items ?? [];
    // Filter pendente client-side (API doesn't have a "pendente" resultado value)
    const rows = filtroResultado === "pendente"
        ? items.filter((r) => r.integracaoResultado === null)
        : items;

    const total = data?.total ?? 0;
    const pendentes = data?.pendentes ?? 0;
    const sucesso = data?.sucesso ?? 0;
    const falha = data?.falha ?? 0;

    const handleRetrySuccess = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ["integracao-totvs"] });
        setDrawerItem(null);
    }, [queryClient]);

    return (
        <section className="space-y-6">
            {/* header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Integração TOTVS</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Painel unificado de envio das solicitações aprovadas para o Progress Datasul
                    </p>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard label="Total" value={total} color="bg-card" />
                <KpiCard label="Pendentes" value={pendentes} color="bg-amber-50 dark:bg-amber-950/30" textColor="text-amber-700 dark:text-amber-400" />
                <KpiCard label="Sucesso" value={sucesso} color="bg-emerald-50 dark:bg-emerald-950/30" textColor="text-emerald-700 dark:text-emerald-400" />
                <KpiCard label="Falha" value={falha} color="bg-red-50 dark:bg-red-950/30" textColor="text-red-700 dark:text-red-400" />
            </div>

            {/* filters + table */}
            <div className="rounded-xl border border-border/50 bg-card shadow-sm p-4">
                {/* Filter row */}
                <div className="flex flex-wrap items-center gap-4 mb-4">
                    {/* Tipo filter */}
                    <select
                        value={filtroTipo}
                        onChange={(e) => setFiltroTipo(e.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">Todos os tipos</option>
                        {Object.entries(TIPO_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>

                    {/* Resultado tabs */}
                    <div className="flex flex-wrap gap-1">
                        {(
                            [
                                { key: "all", label: "Todos" },
                                { key: "pendente", label: "Pendente" },
                                { key: "1", label: "Sucesso" },
                                { key: "2", label: "Falha" },
                            ] as { key: FiltroResultado; label: string }[]
                        ).map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setFiltroResultado(f.key)}
                                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                    filtroResultado === f.key
                                        ? "bg-blue-600 text-white"
                                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative ml-auto">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            placeholder="Buscar nome ou CPF..."
                            className="rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>CPF</TableHead>
                            <TableHead>Descricao</TableHead>
                            <TableHead className="text-center">Resultado</TableHead>
                            <TableHead>Mensagem</TableHead>
                            <TableHead className="text-right">Aprovada em</TableHead>
                            <TableHead className="text-right">Integrada em</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && (
                            <TableRow>
                                <TableCell colSpan={8} className="py-4">
                                    <TableSkeleton rows={5} />
                                </TableCell>
                            </TableRow>
                        )}
                        {!isLoading && rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <ArrowRightLeft className="size-10 opacity-20" />
                                        <p className="text-sm font-medium">Nenhum registro encontrado</p>
                                        <p className="text-xs opacity-70">
                                            Ajuste os filtros ou aguarde aprovacoes serem integradas.
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {rows.map((r) => {
                            const res = r.integracaoResultado != null ? RESULTADO_MAP[String(r.integracaoResultado)] : null;
                            const ResIcon = res?.icon;
                            return (
                                <TableRow
                                    key={`${r.tipoIntegracao}-${r.id}`}
                                    className="cursor-pointer hover:bg-muted/40"
                                    onClick={() => setDrawerItem(r)}
                                >
                                    <TableCell>
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${TIPO_COLORS[r.tipoIntegracao] ?? "bg-gray-100 text-gray-800"}`}>
                                            {r.tipoIntegracaoLabel}
                                        </span>
                                    </TableCell>
                                    <TableCell className="font-semibold text-sm">{r.nome}</TableCell>
                                    <TableCell className="text-sm font-mono">{r.cpf || "\u2014"}</TableCell>
                                    <TableCell className="text-sm max-w-[180px] truncate">{r.descricao}</TableCell>
                                    <TableCell className="text-center">
                                        {res && ResIcon ? (
                                            <span
                                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${res.color}`}
                                            >
                                                <ResIcon className="size-3" /> {res.label}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-500/15 text-amber-700">
                                                <Clock className="size-3" /> Pendente
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                        {r.integracaoMensagem || "\u2014"}
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">
                                        {r.approvedAtUtc
                                            ? new Date(r.approvedAtUtc).toLocaleDateString("pt-BR")
                                            : "\u2014"}
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">
                                        {r.integradaEmUtc
                                            ? new Date(r.integradaEmUtc).toLocaleDateString("pt-BR")
                                            : "\u2014"}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                <div className="mt-3 text-xs text-muted-foreground">{rows.length} registros</div>
            </div>

            {/* Detail drawer */}
            <IntegracaoDetalhesDrawer
                item={drawerItem}
                open={drawerItem !== null}
                onClose={() => setDrawerItem(null)}
                onRetrySuccess={handleRetrySuccess}
            />
        </section>
    );
}

/* ── KPI Card ── */

function KpiCard({
    label,
    value,
    color = "bg-card",
    textColor = "text-foreground",
}: {
    label: string;
    value: number;
    color?: string;
    textColor?: string;
}) {
    return (
        <div className={`rounded-xl border border-border/50 ${color} shadow-sm p-4`}>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${textColor}`}>{value}</p>
        </div>
    );
}
