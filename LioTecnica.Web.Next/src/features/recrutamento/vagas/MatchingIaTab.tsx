"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, Bot, Loader2, RefreshCw, Sparkles, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { AssistenteIaApi } from "@/features/assistente-ia/assistente-ia-api";
import MatchingBreakdownDialog, {
    useMatchingBreakdownDialog,
} from "@/features/recrutamento/matching/MatchingBreakdownDialog";
import LlmMatchingDialog, {
    useLlmMatchingDialog,
} from "@/features/recrutamento/matching/LlmMatchingDialog";

/**
 * Aba "Matching IA" dentro do hub da vaga.
 *
 * <para>Lista TODOS os candidatos da vaga com o score híbrido (léxico + semântico
 * + localidade), distância, modo de cálculo e badge "passou/não passou". Um clique
 * no candidato abre o <see cref="MatchingBreakdownDialog"/> com a explicação
 * completa (critérios, evidências semânticas, itens cobertos/faltando).</para>
 *
 * <para>Também expõe:</para>
 * <list type="bullet">
 *   <item>Sidebar de status do Ollama (alcançável, modelos carregados)</item>
 *   <item>Botão "Reindexar embeddings" (caso CVs/descrição tenham mudado)</item>
 *   <item>Alertas quando a vaga não tem DescricaoCargo vinculada</item>
 *   <item>Fallback automático para léxico quando Ollama está offline</item>
 * </list>
 */
interface CandidateRow {
    id: string;
    nome: string;
    email: string | null;
    status: string;
}

type MatchingModo = "ai" | "semantic" | "lexical";

interface BreakdownRow {
    scoreFinal: number;
    scoreLexico: number | null;
    scoreSemantico: number | null;
    distanciaKm: number | null;
    modo: MatchingModo;
    passou: boolean;
    reqsFaltando: number;
    loading?: boolean;
    error?: string;
}

export interface MatchingIaTabProps {
    vagaId: string;
    candidates: CandidateRow[];
    temDescricaoCargo: boolean;
}

type SortCol = "score" | "nome" | "distancia";

export default function MatchingIaTab({ vagaId, candidates, temDescricaoCargo }: MatchingIaTabProps) {
    const [scores, setScores] = useState<Record<string, BreakdownRow>>({});
    const [loadingAll, setLoadingAll] = useState(false);
    const [reindexando, setReindexando] = useState(false);
    const [ollamaUp, setOllamaUp] = useState<boolean | null>(null);
    const [sortCol, setSortCol] = useState<SortCol>("score");
    const breakdownDialog = useMatchingBreakdownDialog();
    const llmDialog = useLlmMatchingDialog();

    // Checa health do Ollama uma vez (não bloqueia UI — info passiva)
    useEffect(() => {
        AssistenteIaApi.health()
            .then((h) => setOllamaUp(!!h.ollama?.reachable))
            .catch(() => setOllamaUp(false));
    }, []);

    const loadAllScores = useCallback(async () => {
        if (!temDescricaoCargo || candidates.length === 0) return;
        setLoadingAll(true);
        // Inicializa todos com loading=true
        setScores(() => {
            const init: Record<string, BreakdownRow> = {};
            candidates.forEach((c) => {
                init[c.id] = { loading: true, scoreFinal: 0, scoreLexico: null, scoreSemantico: null, distanciaKm: null, modo: "lexical", passou: false, reqsFaltando: 0 };
            });
            return init;
        });

        // Busca em paralelo com concorrência limitada (4 de cada vez)
        const queue = [...candidates];
        const MAX_PARALLEL = 4;
        async function worker() {
            while (queue.length > 0) {
                const c = queue.shift();
                if (!c) return;
                try {
                    const res = await apiFetch(
                        `/api/vagas/${vagaId}/matching-breakdown-hybrid/${c.id}`,
                        { cache: "no-store" },
                        60_000,
                    );
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = (await res.json()) as {
                        scoreFinal: number;
                        scoreLexico: number | null;
                        scoreSemantico: number | null;
                        distanciaKm: number | null;
                        modo: MatchingModo;
                        passouMatchMinimo: boolean;
                        requisitosObrigatoriosFaltando: string[];
                    };
                    setScores((prev) => ({
                        ...prev,
                        [c.id]: {
                            scoreFinal: data.scoreFinal,
                            scoreLexico: data.scoreLexico,
                            scoreSemantico: data.scoreSemantico,
                            distanciaKm: data.distanciaKm,
                            modo: data.modo ?? "semantic",
                            passou: data.passouMatchMinimo,
                            reqsFaltando: data.requisitosObrigatoriosFaltando?.length ?? 0,
                        },
                    }));
                } catch (err) {
                    setScores((prev) => ({
                        ...prev,
                        [c.id]: { ...prev[c.id], loading: false, error: (err as Error).message, scoreFinal: 0, scoreLexico: null, scoreSemantico: null, distanciaKm: null, modo: "lexical", passou: false, reqsFaltando: 0 },
                    }));
                }
            }
        }

        await Promise.all(Array.from({ length: MAX_PARALLEL }, () => worker()));
        setLoadingAll(false);
    }, [vagaId, candidates, temDescricaoCargo]);

    useEffect(() => {
        void loadAllScores();
    }, [loadAllScores]);

    const reindexar = useCallback(async () => {
        setReindexando(true);
        try {
            const r = await AssistenteIaApi.reindexar(true);
            toast.success(`Reindexado: ${r.itensIndexados} itens + ${r.candidatosIndexados} candidatos`);
            await loadAllScores();
        } catch (err) {
            toast.error(`Erro: ${(err as Error).message}`);
        } finally {
            setReindexando(false);
        }
    }, [loadAllScores]);

    const rows = useMemo(() => {
        const list = candidates.map((c) => ({ ...c, bd: scores[c.id] }));
        return list.sort((a, b) => {
            if (sortCol === "score") return (b.bd?.scoreFinal ?? -1) - (a.bd?.scoreFinal ?? -1);
            if (sortCol === "nome") return a.nome.localeCompare(b.nome, "pt-BR");
            if (sortCol === "distancia") return (a.bd?.distanciaKm ?? 1e9) - (b.bd?.distanciaKm ?? 1e9);
            return 0;
        });
    }, [candidates, scores, sortCol]);

    if (!temDescricaoCargo) {
        return (
            <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 p-6">
                <div className="flex items-start gap-3">
                    <AlertCircle className="size-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-amber-900 dark:text-amber-300">Descrição de Cargo não vinculada</h3>
                        <p className="text-sm text-amber-800/80 dark:text-amber-400/80 mt-1">
                            Esta vaga precisa apontar para uma <strong>Descrição de Cargo (DNALIO)</strong> para que o matching por IA funcione.
                            A descrição é a fonte de comparação — cada item DNALIO (atividades, competências, requisitos) é transformado em embedding
                            e comparado com o CV do candidato.
                        </p>
                        <p className="text-sm text-amber-800/80 dark:text-amber-400/80 mt-2">
                            <strong>Como resolver:</strong> clique em <em>Editar</em> nesta vaga → aba <em>Identificação</em> → campo <em>Descrição de Cargo</em>.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (candidates.length === 0) {
        return (
            <div className="mt-4 rounded-xl border border-border/40 bg-card p-6 text-center">
                <Bot className="mx-auto size-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                    Nenhum candidato nesta vaga ainda. Quando houver candidaturas, o matching será calculado automaticamente.
                </p>
            </div>
        );
    }

    return (
        <div className="mt-4 space-y-3">
            {/* Header com resumo + ações */}
            <div className="rounded-xl border border-border/40 bg-card p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-2">
                        <Sparkles className="size-4 text-primary" />
                    </div>
                    <div>
                        <div className="font-semibold text-sm">Matching por IA</div>
                        <div className="text-xs text-muted-foreground">
                            {candidates.length} candidato(s) • Ollama:{" "}
                            {ollamaUp === null && <span className="text-muted-foreground">verificando…</span>}
                            {ollamaUp === true && <span className="text-emerald-600">online</span>}
                            {ollamaUp === false && <span className="text-red-600">offline (fallback léxico)</span>}
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void loadAllScores()} disabled={loadingAll} className="gap-1.5">
                        {loadingAll ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                        Recalcular
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void reindexar()} disabled={reindexando} className="gap-1.5">
                        {reindexando ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />}
                        Reindexar embeddings
                    </Button>
                </div>
            </div>

            {/* Tabela */}
            <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                        <tr>
                            <th className="px-3 py-2 text-left cursor-pointer hover:text-foreground" onClick={() => setSortCol("nome")}>Candidato</th>
                            <th className="px-3 py-2 text-center cursor-pointer hover:text-foreground" onClick={() => setSortCol("score")}>
                                Score {sortCol === "score" && "▼"}
                            </th>
                            <th className="px-3 py-2 text-center">Léxico</th>
                            <th className="px-3 py-2 text-center">Semântico</th>
                            <th className="px-3 py-2 text-center cursor-pointer hover:text-foreground" onClick={() => setSortCol("distancia")}>
                                Distância {sortCol === "distancia" && "▲"}
                            </th>
                            <th className="px-3 py-2 text-center">Modo</th>
                            <th className="px-3 py-2 text-center">Status</th>
                            <th className="px-3 py-2 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                        {rows.map((r) => {
                            const bd = r.bd;
                            return (
                                <tr key={r.id} className="hover:bg-muted/20">
                                    <td className="px-3 py-2">
                                        <div className="font-medium">{r.nome}</div>
                                        <div className="text-[11px] text-muted-foreground">{r.email ?? "—"}</div>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {bd?.loading ? (
                                            <Loader2 className="inline size-4 animate-spin text-muted-foreground" />
                                        ) : bd?.error ? (
                                            <span className="text-red-600 text-xs">erro</span>
                                        ) : (
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${scoreBadge(bd?.scoreFinal ?? 0)}`}>
                                                {bd?.scoreFinal ?? 0}%
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                                        {bd?.loading ? "—" : bd?.scoreLexico ?? "—"}
                                    </td>
                                    <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                                        {bd?.loading ? "—" : bd?.scoreSemantico ?? "—"}
                                    </td>
                                    <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                                        {bd?.loading ? "—" : bd?.distanciaKm != null ? `${bd.distanciaKm.toFixed(1)} km` : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {bd?.loading ? (
                                            "—"
                                        ) : (
                                            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${modoBadge(bd?.modo)}`}>
                                                {modoLabel(bd?.modo)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {bd?.loading ? (
                                            "—"
                                        ) : bd?.passou ? (
                                            <span className="text-emerald-600 text-xs font-medium">✓ passou</span>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">abaixo</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <div className="flex gap-1.5 justify-end">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => breakdownDialog.open(vagaId, r.id, r.nome)}
                                                disabled={bd?.loading}
                                                title="Ver breakdown algorítmico (rápido)"
                                            >
                                                Breakdown
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => llmDialog.open(vagaId, r.id, r.nome)}
                                                disabled={bd?.loading || !ollamaUp}
                                                title="Análise profunda pela IA (Qwen 2.5) — 10-60s na 1ª vez, cache depois"
                                                className="gap-1 border-violet-500/40 text-violet-700 hover:bg-violet-500/10"
                                            >
                                                <Brain className="size-3" />
                                                Análise IA
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Legenda dos modos — descreve exatamente o que cada um faz no backend */}
            <div className="text-xs text-muted-foreground space-y-1">
                <div>
                    <strong className="text-violet-700 dark:text-violet-400">🧠 IA (híbrido)</strong> —
                    Ollama ativo: <strong>30% léxico</strong> (TF-IDF + stems + sinônimos) +
                    <strong> 50% embeddings semânticos</strong> (bge-m3, pgvector kNN cosine) +
                    <strong> 20% localidade</strong> (Haversine).
                </div>
                <div>
                    <strong className="text-amber-700 dark:text-amber-400">📊 Semântico</strong> —
                    Ollama offline (fallback automático do híbrido): TF-IDF + stems + sinônimos +
                    localidade (Haversine). <em>Mesmo cálculo do "Léxico" abaixo; nome diferente só sinaliza que o
                    sistema tentou IA e caiu em fallback.</em>
                </div>
                <div>
                    <strong className="text-zinc-600">📏 Léxico</strong> —
                    endpoint alternativo (sem tentar IA): TF-IDF + stems + sinônimos + localidade (Haversine).
                    Útil para auditoria ou debug.
                </div>
            </div>

            {/* Dialog de breakdown algorítmico (híbrido rápido) */}
            {breakdownDialog.target && (
                <MatchingBreakdownDialog
                    open={true}
                    onClose={breakdownDialog.close}
                    vagaId={breakdownDialog.target.vagaId}
                    candidatoId={breakdownDialog.target.candidatoId}
                    candidatoNome={breakdownDialog.target.candidatoNome}
                />
            )}

            {/* Dialog de análise profunda pelo Qwen 2.5 (LLM-as-Judge) */}
            {llmDialog.target && (
                <LlmMatchingDialog
                    open={true}
                    onClose={llmDialog.close}
                    vagaId={llmDialog.target.vagaId}
                    candidatoId={llmDialog.target.candidatoId}
                    candidatoNome={llmDialog.target.candidatoNome}
                />
            )}
        </div>
    );
}

function scoreBadge(score: number): string {
    if (score >= 60) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    if (score >= 40) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    if (score >= 20) return "bg-orange-500/15 text-orange-700 dark:text-orange-400";
    return "bg-zinc-400/15 text-zinc-600 dark:text-zinc-400";
}

function modoBadge(modo?: string): string {
    if (modo === "ai") return "bg-violet-500/15 text-violet-700 dark:text-violet-400";
    if (modo === "semantic") return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    return "bg-zinc-400/15 text-zinc-600";
}

function modoLabel(modo?: string): string {
    if (modo === "ai") return "🧠 IA";
    if (modo === "semantic") return "📊 Semântico";
    return "📏 Léxico";
}
