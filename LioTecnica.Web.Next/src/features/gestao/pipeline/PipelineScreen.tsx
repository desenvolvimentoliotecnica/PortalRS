"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
    Search,
    RefreshCw,
    Briefcase,
    Users,
    ArrowRight,
    CheckCircle2,
    Clock,
    Eye,
    UserPlus,
    AlertCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

/* ──────────────────────────── types ──────────────────────────── */

interface SolicitacaoGridRow {
    id: string;
    titulo: string;
    urgencia: number;
    status: number;
    solicitanteNome: string | null;
    areaName: string | null;
    qtdPosicoes: number;
    createdAtUtc: string;
}

interface EtapaResponse {
    id: string;
    ordem: number;
    nome: string;
    responsavel: number;
    modo: number;
    slaDias: number | null;
    descricaoInstrucoes: string | null;
}

interface VagaDetail {
    id: string;
    titulo: string;
    areaName: string | null;
    status: number;
    quantidadeVagas: number;
    etapas: EtapaResponse[];
    createdAtUtc: string;
}

interface SolicitacaoDetail {
    id: string;
    titulo: string;
    vagaId: string | null;
    areaName: string | null;
    qtdPosicoes: number;
    urgencia: number;
    status: number;
    approvedAtUtc: string | null;
}

type UrgenciaKey = 0 | 1 | 2 | 3;

/* ──────────────────────────── helpers ──────────────────────────── */

async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, {
        headers: { Accept: "application/json" },
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

const URGENCIA_MAP: Record<UrgenciaKey, { label: string; color: string }> = {
    0: { label: "Baixa", color: "bg-sky-500/15 text-sky-700" },
    1: { label: "Média", color: "bg-amber-500/15 text-amber-700" },
    2: { label: "Alta", color: "bg-orange-500/15 text-orange-700" },
    3: { label: "Crítica", color: "bg-red-500/15 text-red-700" },
};

const RESPONSAVEL_MAP: Record<number, string> = {
    0: "RH",
    1: "Gestor",
    2: "Externo",
};

const MODO_MAP: Record<number, string> = {
    0: "Individual",
    1: "Painel",
    2: "Online",
};

const STAGE_COLORS = [
    "border-sky-500/40 bg-sky-500/5",
    "border-violet-500/40 bg-violet-500/5",
    "border-amber-500/40 bg-amber-500/5",
    "border-emerald-500/40 bg-emerald-500/5",
    "border-rose-500/40 bg-rose-500/5",
    "border-teal-500/40 bg-teal-500/5",
];

function urgenciaBadge(urgencia: number) {
    const u = URGENCIA_MAP[(urgencia ?? 1) as UrgenciaKey] ?? URGENCIA_MAP[1];
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${u.color}`}>
            {u.label}
        </span>
    );
}

function formatDate(iso: string | null | undefined) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
        return "—";
    }
}

/* ──────────────────────────── main ──────────────────────────── */

interface VagaPipeline {
    solicitacaoId: string;
    vagaId: string;
    titulo: string;
    areaName: string | null;
    qtdPosicoes: number;
    urgencia: number;
    approvedAt: string | null;
    etapas: EtapaResponse[];
    status: number;
}

export default function PipelineScreen() {
    const [loading, setLoading] = useState(true);
    const [pipelines, setPipelines] = useState<VagaPipeline[]>([]);
    const [q, setQ] = useState("");

    /* ── detail dialog ── */
    const [detailOpen, setDetailOpen] = useState(false);
    const [selectedPipeline, setSelectedPipeline] = useState<VagaPipeline | null>(null);

    /* ── load approved + awaiting-RH solicitações + their vagas ── */
    const syncData = useCallback(async () => {
        const [approvedRaw, pendingRhRaw] = await Promise.all([
            fetchJson<SolicitacaoGridRow[]>("/api/solicitacoes-vaga?status=2"),
            fetchJson<SolicitacaoGridRow[]>("/api/solicitacoes-vaga?status=5"),
        ]);
        const solList = [
            ...(Array.isArray(approvedRaw) ? approvedRaw : []),
            ...(Array.isArray(pendingRhRaw) ? pendingRhRaw : []),
        ];

        const results: VagaPipeline[] = [];
        for (const sol of solList) {
            const detail = await fetchJson<SolicitacaoDetail>(`/api/solicitacoes-vaga/${sol.id}`).catch(() => null);
            if (!detail?.vagaId) {
                results.push({
                    solicitacaoId: sol.id,
                    vagaId: "",
                    titulo: sol.titulo,
                    areaName: sol.areaName,
                    qtdPosicoes: sol.qtdPosicoes,
                    urgencia: sol.urgencia,
                    approvedAt: detail?.approvedAtUtc ?? null,
                    etapas: [],
                    status: sol.status,
                });
                continue;
            }

            const vaga = await fetchJson<VagaDetail>(`/api/vagas/${detail.vagaId}`).catch(() => null);
            results.push({
                solicitacaoId: sol.id,
                vagaId: detail.vagaId,
                titulo: sol.titulo,
                areaName: sol.areaName ?? vaga?.areaName ?? null,
                qtdPosicoes: sol.qtdPosicoes,
                urgencia: sol.urgencia,
                approvedAt: detail.approvedAtUtc ?? null,
                etapas: vaga?.etapas ?? [],
                status: sol.status,
            });
        }

        setPipelines(results);
    }, []);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        syncData()
            .catch((e) => toast.error(`Falha ao carregar: ${e instanceof Error ? e.message : "erro"}`))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [syncData]);

    /* ── filtering ── */
    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        const approved = pipelines.filter(p => p.status === 2);
        const pendingRh = pipelines.filter(p => p.status === 5);
        if (!term) return { approved, pendingRh };
        const match = (p: VagaPipeline) =>
            [p.titulo, p.areaName].filter(Boolean).join(" ").toLowerCase().includes(term);
        return { approved: approved.filter(match), pendingRh: pendingRh.filter(match) };
    }, [q, pipelines]);

    /* ── default stages when vaga has no etapas ── */
    const DEFAULT_STAGES = [
        { nome: "Triagem", ordem: 1 },
        { nome: "Entrevista RH", ordem: 2 },
        { nome: "Teste/Gamificação", ordem: 3 },
        { nome: "Entrevista Gestor", ordem: 4 },
        { nome: "Proposta", ordem: 5 },
        { nome: "Contratado", ordem: 6 },
    ];

    function getStages(pipeline: VagaPipeline) {
        if (pipeline.etapas.length > 0) {
            return pipeline.etapas.sort((a, b) => a.ordem - b.ordem);
        }
        return DEFAULT_STAGES.map((s, i) => ({
            id: `default-${i}`,
            ordem: s.ordem,
            nome: s.nome,
            responsavel: 0,
            modo: 0,
            slaDias: null,
            descricaoInstrucoes: null,
        }));
    }

    /* ──────────────────────────── render ──────────────────────────── */
    return (
        <section className="space-y-4">
            {/* ── header ── */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Pipeline de Contratação</h4>
                    <div className="text-muted-foreground text-sm">
                        Acompanhe as etapas de cada vaga aprovada
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        setLoading(true);
                        syncData()
                            .catch(() => toast.error("Falha ao atualizar."))
                            .finally(() => setLoading(false));
                    }}
                >
                    <RefreshCw className="size-4" />
                    <span className="hidden sm:inline">Atualizar</span>
                </Button>
            </div>

            {/* ── KPI strip ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-emerald-500/15 p-2.5">
                            <Briefcase className="size-5 text-emerald-600" />
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs font-medium uppercase">Vagas Aprovadas</div>
                            <div className="text-2xl font-bold">{loading ? "…" : pipelines.filter(p => p.status === 2).length}</div>
                        </div>
                    </div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-sky-500/15 p-2.5">
                            <Users className="size-5 text-sky-600" />
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs font-medium uppercase">Total Posições</div>
                            <div className="text-2xl font-bold">{loading ? "…" : pipelines.reduce((s, p) => s + p.qtdPosicoes, 0)}</div>
                        </div>
                    </div>
                </div>
                <div className={`card-soft rounded-xl border p-4 backdrop-blur ${!loading && pipelines.some(p => p.status === 5) ? "border-amber-400/60 bg-amber-500/10" : "border-border/40 bg-card/60"}`}>
                    <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2.5 ${!loading && pipelines.some(p => p.status === 5) ? "bg-amber-500/20" : "bg-amber-500/15"}`}>
                            <AlertCircle className="size-5 text-amber-600" />
                        </div>
                        <div>
                            <div className="text-muted-foreground text-xs font-medium uppercase">Aguardando RH</div>
                            <div className="text-2xl font-bold text-amber-600">{loading ? "…" : pipelines.filter(p => p.status === 5).length}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── search ── */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div className="font-semibold">Vagas em processo</div>
                        <div className="text-muted-foreground text-sm">
                            {loading ? "Carregando…" : `${filtered.approved.length + filtered.pendingRh.length} vagas`}
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="w-[260px] pl-8"
                            placeholder="Buscar título, área…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="border-lt-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
                    </div>
                ) : filtered.approved.length === 0 && filtered.pendingRh.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12">
                        Nenhuma vaga encontrada.
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* ── Aguardando ação do RH ── */}
                        {filtered.pendingRh.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="size-4 text-amber-600" />
                                    <span className="text-sm font-semibold text-amber-700">Aguardando ação do RH</span>
                                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700">{filtered.pendingRh.length}</span>
                                </div>
                                {filtered.pendingRh.map((pipeline) => (
                                    <div
                                        key={pipeline.solicitacaoId}
                                        className="rounded-xl border border-amber-400/40 bg-amber-500/5 p-4"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-lg bg-amber-500/15 p-2">
                                                    <Briefcase className="size-4 text-amber-600" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold">{pipeline.titulo}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {pipeline.areaName || "Sem área"} • {pipeline.qtdPosicoes} posição(ões) • Solicitada em {formatDate(pipeline.approvedAt)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {urgenciaBadge(pipeline.urgencia)}
                                                <Button variant="outline" size="sm" className="border-amber-400 text-amber-700 hover:bg-amber-50" asChild>
                                                    <Link href="/gestao/aprovacoes">
                                                        <CheckCircle2 className="size-4" />
                                                        <span>Revisar aprovação</span>
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ── Vagas aprovadas no pipeline ── */}
                        {filtered.approved.length > 0 && (
                        <div className="space-y-4">
                        {filtered.approved.map((pipeline) => {
                            const stages = getStages(pipeline);
                            return (
                                <div
                                    key={pipeline.solicitacaoId}
                                    className="rounded-xl border border-border/50 bg-card/40 p-4 transition-colors hover:bg-card/60"
                                >
                                    {/* ── vaga header ── */}
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 p-2">
                                                <Briefcase className="size-4 text-violet-600" />
                                            </div>
                                            <div>
                                                <div className="font-semibold">{pipeline.titulo}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {pipeline.areaName || "Sem área"} • {pipeline.qtdPosicoes} posição(ões) • Aprovada {formatDate(pipeline.approvedAt)}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {urgenciaBadge(pipeline.urgencia)}
                                            <Button
                                                variant="outline"
                                                size="icon-xs"
                                                title="Ver detalhes das etapas"
                                                onClick={() => {
                                                    setSelectedPipeline(pipeline);
                                                    setDetailOpen(true);
                                                }}
                                            >
                                                <Eye />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                                asChild
                                            >
                                                <Link href={`/admissao/nova?cargo=${encodeURIComponent(pipeline.titulo)}&vagaId=${pipeline.vagaId || ""}&solicitacaoId=${pipeline.solicitacaoId}`}>
                                                    <UserPlus className="size-4" />
                                                    <span className="hidden lg:inline">Iniciar Admissão</span>
                                                </Link>
                                            </Button>
                                        </div>
                                    </div>

                                    {/* ── stages pipeline visual ── */}
                                    <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
                                        {stages.map((stage, i) => (
                                            <React.Fragment key={stage.id ?? `s-${i}`}>
                                                <div
                                                    className={`flex-1 min-w-[120px] rounded-lg border p-3 ${STAGE_COLORS[i % STAGE_COLORS.length]}`}
                                                >
                                                    <div className="text-xs font-semibold mb-1 truncate">{stage.nome}</div>
                                                    <div className="text-[10px] text-muted-foreground">
                                                        {RESPONSAVEL_MAP[stage.responsavel] ?? "—"}
                                                        {stage.slaDias ? ` • ${stage.slaDias}d SLA` : ""}
                                                    </div>
                                                    <div className="mt-2 rounded bg-white/50 dark:bg-zinc-900/30 p-2 text-center text-xs text-muted-foreground italic">
                                                        Nenhum candidato
                                                    </div>
                                                </div>
                                                {i < stages.length - 1 && (
                                                    <div className="flex items-center px-0.5">
                                                        <ArrowRight className="size-3 text-muted-foreground/50" />
                                                    </div>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                        </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Stage Detail Dialog ── */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Etapas — {selectedPipeline?.titulo}</DialogTitle>
                        <DialogDescription>
                            {selectedPipeline?.areaName || "Sem área"} • {selectedPipeline?.qtdPosicoes} posição(ões)
                        </DialogDescription>
                    </DialogHeader>
                    {selectedPipeline && (
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                            {getStages(selectedPipeline).map((stage, i) => (
                                <div
                                    key={stage.id ?? `d-${i}`}
                                    className={`rounded-lg border p-4 ${STAGE_COLORS[i % STAGE_COLORS.length]}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center justify-center size-6 rounded-full bg-white/60 dark:bg-zinc-800/60 text-xs font-bold">
                                                {i + 1}
                                            </div>
                                            <span className="font-semibold text-sm">{stage.nome}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>Resp: {RESPONSAVEL_MAP[stage.responsavel] ?? "—"}</span>
                                            <span>Modo: {MODO_MAP[stage.modo] ?? "—"}</span>
                                            {stage.slaDias && <span>SLA: {stage.slaDias} dias</span>}
                                        </div>
                                    </div>
                                    {stage.descricaoInstrucoes && (
                                        <div className="mt-2 text-sm text-muted-foreground">
                                            {stage.descricaoInstrucoes}
                                        </div>
                                    )}
                                    <div className="mt-3 rounded-md bg-white/40 dark:bg-zinc-900/30 p-3 text-center text-sm text-muted-foreground">
                                        <Users className="inline-block size-4 mr-1" />
                                        0 candidatos nesta etapa
                                    </div>
                                </div>
                            ))}

                            {selectedPipeline.etapas.length === 0 && (
                                <div className="bg-amber-500/10 text-amber-700 rounded-md p-3 text-sm">
                                    ⚠️ Esta vaga foi criada automaticamente e não possui etapas definidas.
                                    As etapas padrão estão sendo exibidas. Edite a vaga no módulo Recrutamento para personalizar.
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </section>
    );
}
