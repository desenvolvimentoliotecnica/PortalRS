"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
    AlertTriangle,
    Briefcase,
    CheckCircle2,
    RefreshCw,
    Search,
    Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVagaPipeline } from "./useVagaPipeline";
import { PipelineColumn } from "./PipelineColumn";
import type { VagaOrigemTipo, VagaPipelineFiltros, VagaPipelineItem } from "./types";

const ORIGEM_OPTIONS: { value: VagaOrigemTipo | ""; label: string }[] = [
    { value: "", label: "Todas as origens" },
    { value: 1, label: "RM — Aumento de Quadro" },
    { value: 2, label: "RM — Substituição (Desligamento)" },
    { value: 3, label: "RM — Substituição (Promoção)" },
    { value: 4, label: "RM — Direta" },
    { value: 0, label: "Manual (Portal)" },
];

export default function PipelineScreen() {
    const [q, setQ] = useState("");
    const [origem, setOrigem] = useState<VagaOrigemTipo | "">("");
    const [incluirZumbis, setIncluirZumbis] = useState(true);

    const filtros = useMemo<VagaPipelineFiltros>(() => ({
        origem: origem === "" ? undefined : origem,
        q: q || undefined,
        incluirZumbis,
    }), [origem, q, incluirZumbis]);

    const { data, loading, error, refresh } = useVagaPipeline(filtros);

    const lastErrorRef = useRef<string | null>(null);
    useEffect(() => {
        if (error && error !== lastErrorRef.current) {
            lastErrorRef.current = error;
            toast.error(`Falha ao carregar: ${error}`);
        }
        if (!error) lastErrorRef.current = null;
    }, [error]);

    const allVagas: VagaPipelineItem[] = useMemo(
        () => (data?.colunas ?? []).flatMap(c => c.vagas),
        [data],
    );

    const kpiCandidatosAtivos = allVagas.reduce((s, v) => s + v.candidatosAtivos, 0);
    const kpiZumbis = allVagas.filter(v => v.isZumbi).length;
    const kpiEmProposta = data?.colunas.find(c => c.estagio === 5)?.total ?? 0;

    return (
        <section className="flex h-full flex-col space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Pipeline de Vagas</h4>
                    <div className="text-sm text-muted-foreground">
                        Operacional pós-aprovação RM — vagas classificadas pelo estágio do recrutamento
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { void refresh(); }}
                    disabled={loading}
                >
                    <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">Atualizar</span>
                </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <KpiCard icon={Briefcase} color="emerald" label="Vagas no pipeline" value={data?.total ?? 0} loading={loading} />
                <KpiCard icon={Users} color="sky" label="Candidatos ativos" value={kpiCandidatosAtivos} loading={loading} />
                <KpiCard icon={CheckCircle2} color="teal" label="Em proposta" value={kpiEmProposta} loading={loading} />
                <KpiCard icon={AlertTriangle} color="amber" label="Zumbis" value={kpiZumbis} loading={loading} highlight={kpiZumbis > 0} />
            </div>

            <div className="rounded-xl border border-border/40 bg-card/60 p-3">
                <div className="flex flex-wrap items-end gap-2">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="pl-8"
                            placeholder="Buscar título, código ou função TOTVS…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                    <select
                        className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                        value={origem === "" ? "" : String(origem)}
                        onChange={(e) => {
                            const v = e.target.value;
                            setOrigem(v === "" ? "" : (Number(v) as VagaOrigemTipo));
                        }}
                    >
                        {ORIGEM_OPTIONS.map(opt => (
                            <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
                        ))}
                    </select>
                    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                            type="checkbox"
                            checked={incluirZumbis}
                            onChange={(e) => setIncluirZumbis(e.target.checked)}
                        />
                        Incluir zumbis
                    </label>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto">
                {loading && !data ? (
                    <div className="flex h-64 items-center justify-center">
                        <div className="border-lt-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
                    </div>
                ) : !data || data.colunas.length === 0 ? (
                    <div className="flex h-64 items-center justify-center text-muted-foreground">
                        Nenhuma vaga encontrada.
                    </div>
                ) : (
                    <div className="flex h-full gap-3">
                        {data.colunas.map((coluna) => (
                            <PipelineColumn key={coluna.estagio} coluna={coluna} />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

type KpiColor = "emerald" | "sky" | "teal" | "amber";

const KPI_COLOR_CLASSES: Record<KpiColor, { bg: string; text: string; borderHighlight: string; bgHighlight: string }> = {
    emerald: { bg: "bg-emerald-500/15", text: "text-emerald-600", borderHighlight: "border-emerald-400/60", bgHighlight: "bg-emerald-500/10" },
    sky:     { bg: "bg-sky-500/15",     text: "text-sky-600",     borderHighlight: "border-sky-400/60",     bgHighlight: "bg-sky-500/10" },
    teal:    { bg: "bg-teal-500/15",    text: "text-teal-600",    borderHighlight: "border-teal-400/60",    bgHighlight: "bg-teal-500/10" },
    amber:   { bg: "bg-amber-500/15",   text: "text-amber-600",   borderHighlight: "border-amber-400/60",   bgHighlight: "bg-amber-500/10" },
};

function KpiCard({
    icon: Icon,
    color,
    label,
    value,
    loading,
    highlight,
}: {
    icon: React.ComponentType<{ className?: string }>;
    color: KpiColor;
    label: string;
    value: number;
    loading: boolean;
    highlight?: boolean;
}) {
    const c = KPI_COLOR_CLASSES[color];
    const borderClass = highlight ? `${c.borderHighlight} ${c.bgHighlight}` : "border-border/40 bg-card/60";
    return (
        <div className={`rounded-xl border p-4 backdrop-blur ${borderClass}`}>
            <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2.5 ${c.bg}`}>
                    <Icon className={`size-5 ${c.text}`} />
                </div>
                <div>
                    <div className="text-xs font-medium uppercase text-muted-foreground">{label}</div>
                    <div className={`text-2xl font-bold ${highlight ? c.text : ""}`}>{loading ? "…" : value}</div>
                </div>
            </div>
        </div>
    );
}
