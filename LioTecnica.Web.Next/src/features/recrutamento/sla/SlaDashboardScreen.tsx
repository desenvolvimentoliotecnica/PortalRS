"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/* ────── types ────── */

interface SlaVagaItem {
    id: string;
    titulo: string;
    status: string;
    prioridade: string;
    tipoVagaNome?: string | null;
    permanenciaDisplay?: string | null;
    diasAberto: number;
    diasUteisAberto?: number;
    metaDias: number;
    metaDiasUteis?: number;
    percentualConsumido: number;
    slaStatus: "no_prazo" | "critica" | "atrasada";
}

interface SlaKpis {
    total: number;
    noPrazo: number;
    critica: number;
    atrasada: number;
}

interface SlaResponse {
    kpis: SlaKpis;
    vagas: SlaVagaItem[];
}

/* ────── helpers ────── */

async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    return res.json() as Promise<T>;
}

const SLA_COLOR = {
    no_prazo: {
        bar: "bg-green-500",
        badge: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
        label: "No prazo",
        icon: <CheckCircle2 className="size-4 text-green-600" />,
    },
    critica: {
        bar: "bg-amber-500",
        badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
        label: "Crítico",
        icon: <AlertTriangle className="size-4 text-amber-600" />,
    },
    atrasada: {
        bar: "bg-red-500",
        badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
        label: "Atrasada",
        icon: <XCircle className="size-4 text-red-600" />,
    },
};

const PRIORIDADE_BADGE: Record<string, string> = {
    Critica: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    Alta: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    Media: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    Baixa: "bg-muted text-muted-foreground",
    Indefinida: "bg-muted text-muted-foreground",
};

/* ────── component ────── */

export default function SlaDashboardScreen() {
    const router = useRouter();
    const [data, setData] = useState<SlaResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>("");
    const [filterPrioridade, setFilterPrioridade] = useState<string>("");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterStatus) params.set("status", filterStatus);
            if (filterPrioridade) params.set("prioridade", filterPrioridade);
            const result = await fetchJson<SlaResponse>(`/api/sla/vagas?${params.toString()}`);
            setData(result);
        } catch (e) {
            toast.error(`Falha ao carregar SLA: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setLoading(false);
        }
    }, [filterStatus, filterPrioridade]);

    useEffect(() => { void load(); }, [load]);

    const kpis = data?.kpis;
    const vagas = data?.vagas ?? [];

    return (
        <section className="w-full space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="mb-2 inline-flex rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Recrutamento
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">SLA Dashboard</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Acompanhe o prazo de fechamento das vagas em aberto.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void load()}>
                    <RefreshCw className="size-4 mr-1" /> Atualizar
                </Button>
            </div>

            {/* KPI cards */}
            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <KpiCard label="Total de Vagas" value={kpis?.total ?? 0} icon={<Clock className="size-5 text-muted-foreground" />} color="bg-card" />
                    <KpiCard label="No Prazo" value={kpis?.noPrazo ?? 0} icon={<CheckCircle2 className="size-5 text-green-600" />} color="bg-green-50 dark:bg-green-900/10" />
                    <KpiCard label="Crítico (>80%)" value={kpis?.critica ?? 0} icon={<AlertTriangle className="size-5 text-amber-600" />} color="bg-amber-50 dark:bg-amber-900/10" />
                    <KpiCard label="Atrasadas" value={kpis?.atrasada ?? 0} icon={<XCircle className="size-5 text-red-600" />} color="bg-red-50 dark:bg-red-900/10" />
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-2">
                <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="">Todos os status</option>
                    <option value="2">Aberta</option>
                    <option value="3">Pausada</option>
                    <option value="4">Em Triagem</option>
                    <option value="5">Em Entrevistas</option>
                    <option value="6">Em Oferta</option>
                </select>
                <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={filterPrioridade}
                    onChange={(e) => setFilterPrioridade(e.target.value)}
                >
                    <option value="">Todas as prioridades</option>
                    <option value="4">Crítica</option>
                    <option value="3">Alta</option>
                    <option value="2">Média</option>
                    <option value="1">Baixa</option>
                </select>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-4 space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                    </div>
                ) : vagas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <CheckCircle2 className="size-10 text-green-400 mb-3" />
                        <p className="text-muted-foreground">Nenhuma vaga encontrada com os filtros selecionados.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/40">
                        {vagas.map((v) => {
                            const sla = SLA_COLOR[v.slaStatus] ?? SLA_COLOR.no_prazo;
                            const pct = Math.min(100, v.percentualConsumido);
                            return (
                                <div key={v.id} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {sla.icon}
                                            <span className="font-semibold text-sm truncate">{v.titulo}</span>
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORIDADE_BADGE[v.prioridade] ?? PRIORIDADE_BADGE["Indefinida"]}`}>
                                                {v.prioridade}
                                            </span>
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${sla.badge}`}>
                                                {sla.label}
                                            </span>
                                            {v.tipoVagaNome && (
                                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground">
                                                    {v.tipoVagaNome}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            {v.diasUteisAberto ?? v.diasAberto} dias úteis em aberto · Meta: {v.metaDiasUteis ?? v.metaDias} dias úteis
                                            {v.permanenciaDisplay ? ` · Permanência: ${v.permanenciaDisplay}` : ""} · Status: {v.status}
                                        </div>
                                    </div>
                                    <div className="w-full sm:w-56 lg:w-72 xl:w-80 space-y-1 shrink-0">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>{pct.toFixed(0)}%</span>
                                            <span>{v.diasUteisAberto ?? v.diasAberto}/{v.metaDiasUteis ?? v.metaDias}d úteis</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${sla.bar}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="shrink-0 self-center"
                                        onClick={() => router.push(`/vagas/hub?id=${encodeURIComponent(v.id)}`)}
                                    >
                                        <ExternalLink className="size-3.5 mr-1.5" />
                                        Abrir vaga
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}

function KpiCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
    return (
        <div className={`rounded-xl border border-border/40 p-4 shadow-sm ${color}`}>
            <div className="flex items-center gap-2">
                {icon}
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
            </div>
            <div className="mt-2 text-3xl font-bold">{value}</div>
        </div>
    );
}
