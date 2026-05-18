"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    AlertCircle,
    AlertTriangle,
    Bot,
    Brain,
    Loader2,
    Mail,
    MoreHorizontal,
    PenSquare,
    Sparkles,
    UserPlus,
    Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api";
import {
    MATCHING_FETCH_TIMEOUT_MS,
    MATCHING_LLM_CACHE_TIMEOUT_MS,
    MATCHING_SCORE_DIVERGENCE_THRESHOLD,
} from "@/features/recrutamento/matching/matchingHelpers";
import { AssistenteIaApi } from "@/features/assistente-ia/assistente-ia-api";
import MatchingBreakdownDialog, {
    useMatchingBreakdownDialog,
} from "@/features/recrutamento/matching/MatchingBreakdownDialog";
import LlmMatchingDialog, {
    useLlmMatchingDialog,
} from "@/features/recrutamento/matching/LlmMatchingDialog";

export interface HubCandidateRow {
    id: string;
    nome: string;
    email: string | null;
    fone: string | null;
    celular: string | null;
    status: string;
    createdAtUtc: string;
}

export interface CandidatosMatchTabProps {
    vagaId: string;
    candidates: HubCandidateRow[];
    temDescricaoCargo: boolean;
    isReadOnly: boolean;
    onAddCandidate: () => void;
    onEditCandidate: (id: string) => void | Promise<void>;
    onApproveCandidate: (c: HubCandidateRow) => void;
    onAcompanharAdmissao: (candidatoId: string) => Promise<void>;
}

type MatchingModo = "ai" | "semantic" | "lexical";
type SortCol = "nome" | "data" | "score";
type MatchFilter = "todos" | "sem_match" | "abaixo" | "passou" | "divergencia" | "com_llm";

interface MatchRow {
    calculated: boolean;
    loading: boolean;
    error?: string;
    scoreFinal: number;
    scoreLexico: number | null;
    scoreSemantico: number | null;
    distanciaKm: number | null;
    modo: MatchingModo;
    passou: boolean;
    reqsFaltando: number;
    llmScore: number | null;
    llmPassou: boolean | null;
    llmCacheLoading: boolean;
}

async function parseMatchApiError(res: Response): Promise<string> {
    const raw = await res.text().catch(() => "");
    if (!raw.trim()) return `HTTP ${res.status}`;
    try {
        const j = JSON.parse(raw) as Record<string, unknown>;
        const m = j.message ?? j.title ?? j.detail;
        if (typeof m === "string" && m.trim()) return m.trim();
    } catch {
        /* ignore */
    }
    return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw.trim();
}

async function fetchLlmCache(
    vagaId: string,
    candidatoId: string,
): Promise<{ scoreFinal: number; passouMatchMinimo: boolean } | null> {
    try {
        const res = await apiFetch(
            `/api/vagas/${vagaId}/matching-llm-cached/${candidatoId}`,
            { cache: "no-store" },
            MATCHING_LLM_CACHE_TIMEOUT_MS,
        );
        if (!res.ok) return null;
        return (await res.json()) as { scoreFinal: number; passouMatchMinimo: boolean };
    } catch {
        return null;
    }
}

export default function CandidatosMatchTab({
    vagaId,
    candidates,
    temDescricaoCargo,
    isReadOnly,
    onAddCandidate,
    onEditCandidate,
    onApproveCandidate,
    onAcompanharAdmissao,
}: CandidatosMatchTabProps) {
    const [matchById, setMatchById] = useState<Record<string, MatchRow>>({});
    const [reindexando, setReindexando] = useState(false);
    const [tenantLlmLabel, setTenantLlmLabel] = useState<string | null>(null);
    const [embeddingsOk, setEmbeddingsOk] = useState<boolean | null>(null);
    const [sortCol, setSortCol] = useState<SortCol>("nome");
    const [filter, setFilter] = useState<MatchFilter>("todos");
    const breakdownDialog = useMatchingBreakdownDialog();
    const llmDialog = useLlmMatchingDialog();

    useEffect(() => {
        AssistenteIaApi.health()
            .then((h) => {
                const emb = h as { embedding?: { usesCloudGemini?: boolean }; ollama?: { reachable?: boolean } };
                if (emb.embedding?.usesCloudGemini) setEmbeddingsOk(true);
                else setEmbeddingsOk(!!emb.ollama?.reachable);
            })
            .catch(() => setEmbeddingsOk(false));
        apiFetch("/api/tenant-configuracao/ai")
            .then(async (res) => {
                if (!res.ok) return;
                const dto = (await res.json()) as { effectiveLlmProvider?: string; effectiveLlmModel?: string };
                const p = dto.effectiveLlmProvider ?? "?";
                const m = dto.effectiveLlmModel ? ` (${dto.effectiveLlmModel})` : "";
                setTenantLlmLabel(`${p}${m}`);
            })
            .catch(() => setTenantLlmLabel(null));
    }, []);

    /** Só leitura de Análise IA em cache — sem breakdown híbrido. */
    const prefetchLlmCaches = useCallback(async () => {
        if (!temDescricaoCargo || candidates.length === 0) return;

        setMatchById((prev) => {
            const next = { ...prev };
            for (const c of candidates) {
                if (!next[c.id]) {
                    next[c.id] = emptyMatchRow();
                }
                next[c.id] = { ...next[c.id], llmCacheLoading: true };
            }
            return next;
        });

        const queue = [...candidates];
        const workers = Array.from({ length: 2 }, async () => {
            while (queue.length > 0) {
                const c = queue.shift();
                if (!c) return;
                const llm = await fetchLlmCache(vagaId, c.id);
                setMatchById((prev) => ({
                    ...prev,
                    [c.id]: {
                        ...(prev[c.id] ?? emptyMatchRow()),
                        llmCacheLoading: false,
                        llmScore: llm?.scoreFinal ?? null,
                        llmPassou: llm?.passouMatchMinimo ?? null,
                    },
                }));
            }
        });
        await Promise.all(workers);
    }, [vagaId, candidates, temDescricaoCargo]);

    useEffect(() => {
        void prefetchLlmCaches();
    }, [prefetchLlmCaches]);

    const calcularMatch = useCallback(
        async (c: HubCandidateRow) => {
            if (!temDescricaoCargo) return;

            setMatchById((prev) => ({
                ...prev,
                [c.id]: {
                    ...(prev[c.id] ?? emptyMatchRow()),
                    loading: true,
                    error: undefined,
                },
            }));

            try {
                const res = await apiFetch(
                    `/api/vagas/${vagaId}/matching-breakdown-hybrid/${c.id}`,
                    { cache: "no-store" },
                    MATCHING_FETCH_TIMEOUT_MS,
                );
                if (!res.ok) throw new Error(await parseMatchApiError(res));

                const data = (await res.json()) as {
                    scoreFinal: number;
                    scoreLexico: number | null;
                    scoreSemantico: number | null;
                    distanciaKm: number | null;
                    modo: MatchingModo;
                    passouMatchMinimo: boolean;
                    requisitosObrigatoriosFaltando: string[];
                };

                const llm = await fetchLlmCache(vagaId, c.id);

                setMatchById((prev) => ({
                    ...prev,
                    [c.id]: {
                        calculated: true,
                        loading: false,
                        scoreFinal: data.scoreFinal,
                        scoreLexico: data.scoreLexico,
                        scoreSemantico: data.scoreSemantico,
                        distanciaKm: data.distanciaKm,
                        modo: data.modo ?? "semantic",
                        passou: data.passouMatchMinimo,
                        reqsFaltando: data.requisitosObrigatoriosFaltando?.length ?? 0,
                        llmScore: llm?.scoreFinal ?? prev[c.id]?.llmScore ?? null,
                        llmPassou: llm?.passouMatchMinimo ?? prev[c.id]?.llmPassou ?? null,
                        llmCacheLoading: false,
                    },
                }));
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Falha ao calcular match";
                toast.error(`${c.nome}: ${msg}`, { duration: 8000 });
                setMatchById((prev) => ({
                    ...prev,
                    [c.id]: {
                        ...(prev[c.id] ?? emptyMatchRow()),
                        calculated: false,
                        loading: false,
                        error: msg,
                    },
                }));
            }
        },
        [vagaId, temDescricaoCargo],
    );

    const reindexar = useCallback(async () => {
        setReindexando(true);
        try {
            const r = await AssistenteIaApi.reindexar(true);
            toast.success(`Reindexado: ${r.itensIndexados} itens + ${r.candidatosIndexados} candidatos`);
        } catch (err) {
            toast.error(`Erro: ${(err as Error).message}`);
        } finally {
            setReindexando(false);
        }
    }, []);

    const rows = useMemo(() => {
        let list = candidates.map((c) => ({ ...c, m: matchById[c.id] }));

        if (filter === "sem_match") {
            list = list.filter((r) => !r.m?.calculated);
        } else if (filter === "abaixo") {
            list = list.filter((r) => r.m?.calculated && !r.m.passou);
        } else if (filter === "passou") {
            list = list.filter((r) => r.m?.calculated && r.m.passou);
        } else if (filter === "divergencia") {
            list = list.filter((r) => {
                const b = r.m?.scoreFinal;
                const l = r.m?.llmScore;
                return b != null && l != null && Math.abs(b - l) > MATCHING_SCORE_DIVERGENCE_THRESHOLD;
            });
        } else if (filter === "com_llm") {
            list = list.filter((r) => r.m?.llmScore != null);
        }

        return list.sort((a, b) => {
            if (sortCol === "score") {
                const sa = a.m?.calculated ? a.m.scoreFinal : -1;
                const sb = b.m?.calculated ? b.m.scoreFinal : -1;
                return sb - sa;
            }
            if (sortCol === "data") {
                return new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime();
            }
            return a.nome.localeCompare(b.nome, "pt-BR");
        });
    }, [candidates, matchById, filter, sortCol]);

    const stats = useMemo(() => {
        const calculated = candidates.filter((c) => matchById[c.id]?.calculated).length;
        const comLlm = candidates.filter((c) => matchById[c.id]?.llmScore != null).length;
        return { calculated, comLlm };
    }, [candidates, matchById]);

    const filterChips: { id: MatchFilter; label: string }[] = [
        { id: "todos", label: "Todos" },
        { id: "sem_match", label: "Sem breakdown" },
        { id: "passou", label: "Passou mínimo" },
        { id: "abaixo", label: "Abaixo do mínimo" },
        { id: "com_llm", label: "Com Análise IA" },
        { id: "divergencia", label: "Divergência >20" },
    ];

    return (
        <div className="mt-4 space-y-3">
            {/* Cabeçalho */}
            <div className="rounded-xl border border-border/40 bg-card p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-full bg-primary/10 p-2 shrink-0">
                        <Users className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                        <div className="font-semibold text-sm">Candidatos & Match</div>
                        <div className="text-xs text-muted-foreground">
                            {candidates.length} candidato(s)
                            {temDescricaoCargo && stats.calculated > 0 && (
                                <span> · {stats.calculated} com breakdown calculado</span>
                            )}
                            {stats.comLlm > 0 && <span> · {stats.comLlm} com Análise IA em cache</span>}
                        </div>
                        {temDescricaoCargo && (
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                Análise IA: <span className="text-foreground/80">{tenantLlmLabel ?? "…"}</span>
                                {" · "}
                                Embeddings:{" "}
                                {embeddingsOk === null && "verificando…"}
                                {embeddingsOk === true && <span className="text-emerald-600">ok</span>}
                                {embeddingsOk === false && <span className="text-amber-600">fallback léxico</span>}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {!isReadOnly && (
                        <Button size="sm" onClick={onAddCandidate} className="gap-1.5">
                            <UserPlus className="size-3.5" />
                            Candidato
                        </Button>
                    )}
                    {temDescricaoCargo && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void reindexar()}
                            disabled={reindexando}
                            className="gap-1.5"
                            title="Reindexa embeddings da vaga/CVs (ação administrativa)"
                        >
                            {reindexando ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />}
                            Reindexar embeddings
                        </Button>
                    )}
                </div>
            </div>

            {!temDescricaoCargo && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 flex items-start gap-3">
                    <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-medium text-amber-900 dark:text-amber-300">Matching indisponível</p>
                        <p className="text-amber-800/80 dark:text-amber-400/80 mt-1">
                            Vincule uma <strong>Descrição de Cargo (DNALIO)</strong> na edição da vaga para calcular match.
                            A lista de candidatos e ações de RH continuam disponíveis.
                        </p>
                    </div>
                </div>
            )}

            {temDescricaoCargo && candidates.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1">Filtrar</span>
                    {filterChips.map((chip) => (
                        <button
                            key={chip.id}
                            type="button"
                            onClick={() => setFilter(chip.id)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                                filter === chip.id
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            }`}
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>
            )}

            {candidates.length === 0 ? (
                <div className="rounded-xl border border-border/40 bg-card p-8 text-center">
                    <Users className="mx-auto size-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Nenhum candidato nesta vaga ainda.</p>
                    {!isReadOnly && (
                        <Button size="sm" className="mt-4 gap-1.5" onClick={onAddCandidate}>
                            <UserPlus className="size-3.5" />
                            Adicionar candidato
                        </Button>
                    )}
                </div>
            ) : (
                <div className="rounded-xl border border-border/40 bg-card overflow-x-auto">
                    <table className="w-full text-sm min-w-[900px]">
                        <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                            <tr>
                                <th
                                    className="px-3 py-2 text-left cursor-pointer hover:text-foreground"
                                    onClick={() => setSortCol("nome")}
                                >
                                    Candidato {sortCol === "nome" && "▼"}
                                </th>
                                <th className="px-3 py-2 text-left">Status</th>
                                <th
                                    className="px-3 py-2 text-left cursor-pointer hover:text-foreground"
                                    onClick={() => setSortCol("data")}
                                >
                                    Data {sortCol === "data" && "▼"}
                                </th>
                                <th
                                    className="px-3 py-2 text-center min-w-[200px] cursor-pointer hover:text-foreground"
                                    onClick={() => setSortCol("score")}
                                >
                                    Match {sortCol === "score" && "▼"}
                                    <div className="text-[10px] font-normal normal-case text-muted-foreground/80">
                                        Breakdown · Análise IA
                                    </div>
                                </th>
                                <th className="px-3 py-2 text-center">Mínimo</th>
                                <th className="px-3 py-2 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                                        Nenhum candidato neste filtro.
                                    </td>
                                </tr>
                            ) : (
                                rows.map((r) => {
                                    const m = r.m;
                                    return (
                                        <tr key={r.id} className="hover:bg-muted/20 align-top">
                                            <td className="px-3 py-2">
                                                <div className="font-medium">{r.nome}</div>
                                                <div className="text-[11px] text-muted-foreground">{r.email ?? "—"}</div>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700">
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                                                {new Date(r.createdAtUtc).toLocaleDateString("pt-BR")}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {!temDescricaoCargo ? (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                ) : (
                                                    <MatchScoreCell
                                                        m={m}
                                                        onCalcular={() => void calcularMatch(r)}
                                                    />
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                {!temDescricaoCargo || !m?.calculated ? (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                ) : m.passou ? (
                                                    <span className="text-emerald-600 text-xs font-medium">✓ passou</span>
                                                ) : (
                                                    <span className="text-amber-700 text-xs">abaixo</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <RowActions
                                                    candidato={r}
                                                    m={m}
                                                    temDescricaoCargo={temDescricaoCargo}
                                                    isReadOnly={isReadOnly}
                                                    onCalcularMatch={() => void calcularMatch(r)}
                                                    onBreakdown={() => breakdownDialog.open(vagaId, r.id, r.nome)}
                                                    onAnaliseIa={() => llmDialog.open(vagaId, r.id, r.nome)}
                                                    onEdit={() => void onEditCandidate(r.id)}
                                                    onApprove={() => onApproveCandidate(r)}
                                                    onAcompanhar={() => void onAcompanharAdmissao(r.id)}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {temDescricaoCargo && candidates.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-1 px-1">
                    <div className="flex items-start gap-1.5">
                        <Sparkles className="size-3.5 shrink-0 mt-0.5 text-violet-600" />
                        <span>
                            Use <strong>Calcular match</strong> por candidato (breakdown híbrido).{" "}
                            <strong>Análise IA</strong> é opcional e mais demorada; scores em cache aparecem ao abrir a aba.
                            Diferença &gt; {MATCHING_SCORE_DIVERGENCE_THRESHOLD} pts entre métodos é esperada.
                        </span>
                    </div>
                </div>
            )}

            {breakdownDialog.target && (
                <MatchingBreakdownDialog
                    open
                    onClose={breakdownDialog.close}
                    vagaId={breakdownDialog.target.vagaId}
                    candidatoId={breakdownDialog.target.candidatoId}
                    candidatoNome={breakdownDialog.target.candidatoNome}
                />
            )}

            {llmDialog.target && (
                <LlmMatchingDialog
                    open
                    onClose={llmDialog.close}
                    vagaId={llmDialog.target.vagaId}
                    candidatoId={llmDialog.target.candidatoId}
                    candidatoNome={llmDialog.target.candidatoNome}
                    onAnalyzed={(result) => {
                        const cid = llmDialog.target!.candidatoId;
                        setMatchById((prev) => ({
                            ...prev,
                            [cid]: {
                                ...(prev[cid] ?? emptyMatchRow()),
                                llmScore: result.scoreFinal,
                                llmPassou: result.passouMatchMinimo,
                                llmCacheLoading: false,
                            },
                        }));
                    }}
                />
            )}
        </div>
    );
}

function emptyMatchRow(): MatchRow {
    return {
        calculated: false,
        loading: false,
        scoreFinal: 0,
        scoreLexico: null,
        scoreSemantico: null,
        distanciaKm: null,
        modo: "lexical",
        passou: false,
        reqsFaltando: 0,
        llmScore: null,
        llmPassou: null,
        llmCacheLoading: false,
    };
}

function MatchScoreCell({ m, onCalcular }: { m?: MatchRow; onCalcular: () => void }) {
    if (m?.loading) {
        return (
            <div className="flex flex-col items-center gap-1 py-1">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Calculando…</span>
            </div>
        );
    }

    if (m?.error) {
        return (
            <div className="flex flex-col items-center gap-1">
                <span className="text-red-600 text-xs max-w-[180px] line-clamp-2" title={m.error}>
                    {m.error}
                </span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCalcular}>
                    Tentar de novo
                </Button>
            </div>
        );
    }

    if (!m?.calculated) {
        return (
            <div className="flex flex-col items-center gap-1.5">
                {m?.llmCacheLoading ? (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                ) : m?.llmScore != null ? (
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">IA:</span>
                        <span className={`rounded-full px-2 py-0.5 font-semibold border border-violet-500/30 ${scoreBadge(m.llmScore)}`}>
                            {m.llmScore}%
                        </span>
                    </div>
                ) : null}
                <Button size="sm" variant="secondary" className="h-7 text-xs gap-1" onClick={onCalcular}>
                    <Sparkles className="size-3" />
                    Calcular match
                </Button>
            </div>
        );
    }

    return <DualScoreCell m={m} />;
}

function DualScoreCell({ m }: { m: MatchRow }) {
    const breakdown = m.scoreFinal;
    const llm = m.llmScore;
    const diverge =
        llm != null && Math.abs(breakdown - llm) > MATCHING_SCORE_DIVERGENCE_THRESHOLD;

    return (
        <div className="flex flex-col items-center gap-1 min-w-[160px]">
            <div className="flex items-center justify-center gap-2 flex-wrap">
                <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Breakdown</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${scoreBadge(breakdown)}`}>
                        {breakdown}%
                    </span>
                </div>
                <span className="text-muted-foreground/50 text-xs">|</span>
                <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Análise IA</span>
                    {m.llmCacheLoading ? (
                        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                    ) : llm != null ? (
                        <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold border border-violet-500/30 ${scoreBadge(llm)}`}
                        >
                            {llm}%
                        </span>
                    ) : (
                        <span className="text-[10px] text-muted-foreground italic">—</span>
                    )}
                </div>
            </div>
            {diverge && (
                <div
                    className="flex items-start gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-900 dark:text-amber-200 max-w-[200px] text-left"
                    title={`Breakdown (${breakdown}%) vs Análise IA (${llm}%) — métodos distintos.`}
                >
                    <AlertTriangle className="size-3 shrink-0 text-amber-600" />
                    <span>Δ {Math.abs(breakdown - (llm ?? 0))} pts</span>
                </div>
            )}
        </div>
    );
}

function RowActions({
    candidato,
    m,
    temDescricaoCargo,
    isReadOnly,
    onCalcularMatch,
    onBreakdown,
    onAnaliseIa,
    onEdit,
    onApprove,
    onAcompanhar,
}: {
    candidato: HubCandidateRow;
    m?: MatchRow;
    temDescricaoCargo: boolean;
    isReadOnly: boolean;
    onCalcularMatch: () => void;
    onBreakdown: () => void;
    onAnaliseIa: () => void;
    onEdit: () => void;
    onApprove: () => void;
    onAcompanhar: () => void;
}) {
    return (
        <div className="flex items-center justify-end gap-1">
            {temDescricaoCargo && (
                <>
                    {!m?.calculated && !m?.loading && (
                        <Button size="sm" variant="secondary" className="h-8 text-xs hidden lg:inline-flex gap-1" onClick={onCalcularMatch}>
                            <Sparkles className="size-3" />
                            Match
                        </Button>
                    )}
                    {m?.calculated && (
                        <Button size="sm" variant="outline" className="h-8 text-xs hidden xl:inline-flex" onClick={onBreakdown} disabled={m.loading}>
                            Breakdown
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1 border-violet-500/40 text-violet-700 hover:bg-violet-500/10 hidden xl:inline-flex"
                        onClick={onAnaliseIa}
                        disabled={m?.loading}
                    >
                        <Brain className="size-3" />
                        IA
                    </Button>
                </>
            )}

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">Ações</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                    {temDescricaoCargo && (
                        <>
                            <DropdownMenuItem onClick={onCalcularMatch} disabled={m?.loading}>
                                <Sparkles className="size-4 mr-2" />
                                {m?.calculated ? "Recalcular match" : "Calcular match"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onBreakdown} disabled={m?.loading}>
                                Ver breakdown detalhado
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onAnaliseIa}>
                                <Brain className="size-4 mr-2" />
                                Análise IA
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                        </>
                    )}
                    {!isReadOnly && (
                        <DropdownMenuItem onClick={onEdit}>
                            <PenSquare className="size-4 mr-2" />
                            Editar candidato
                        </DropdownMenuItem>
                    )}
                    {!isReadOnly && (
                        <DropdownMenuItem onClick={onApprove}>
                            <Mail className="size-4 mr-2" />
                            {candidato.status === "Aprovado" ? "Reenviar aprovação" : "Aprovar candidato"}
                        </DropdownMenuItem>
                    )}
                    {candidato.status === "Aprovado" && (
                        <DropdownMenuItem onClick={onAcompanhar}>Acompanhar admissão</DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

function scoreBadge(score: number): string {
    if (score >= 60) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    if (score >= 40) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    if (score >= 20) return "bg-orange-500/15 text-orange-700 dark:text-orange-400";
    return "bg-zinc-400/15 text-zinc-600 dark:text-zinc-400";
}
