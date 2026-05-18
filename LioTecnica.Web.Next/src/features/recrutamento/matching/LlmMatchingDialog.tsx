"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bot, Loader2, RefreshCw, Sparkles } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { MATCHING_LLM_FETCH_TIMEOUT_MS } from "@/features/recrutamento/matching/matchingHelpers";

/**
 * Dialog do "LLM-as-a-Judge" — modelo do tenant (ex.: Gemini) avalia candidato × vaga
 * profundo e retorna:
 *   • Score final 0-100 aplicando pesos da vaga
 *   • Justificativa em PT-BR em linguagem natural
 *   • Breakdown por critério (peso × score) com pontos fortes + gaps por critério
 *   • Pontos fortes gerais e gaps gerais
 *
 * <para>1ª chamada demora 10-15s (GPU) ou 40-60s (CPU). Respostas subsequentes
 * são instantâneas via cache (invalidação automática por hash).</para>
 */
interface LlmCriterio {
    nome: string;
    peso: number;
    score: number;
    contribuicao: number;
    pontosFortes: string[];
    gaps: string[];
}

interface LlmResult {
    candidatoId: string;
    vagaId: string;
    scoreFinal: number;
    passouMatchMinimo: boolean;
    justificativa: string;
    criterios: LlmCriterio[];
    pontosFortes: string[];
    gaps: string[];
    modelVersion: string;
    durationMs: number;
    usouCache: boolean;
}

export interface LlmMatchingDialogProps {
    open: boolean;
    onClose: () => void;
    vagaId: string;
    candidatoId: string;
    candidatoNome?: string;
    /** Chamado quando uma análise é obtida (cache ou nova) — atualiza score na tabela. */
    onAnalyzed?: (result: LlmResult) => void;
}

function scoreColor(score: number): string {
    if (score >= 80) return "text-emerald-700 dark:text-emerald-400";
    if (score >= 60) return "text-lime-700 dark:text-lime-400";
    if (score >= 40) return "text-amber-700 dark:text-amber-400";
    return "text-red-700 dark:text-red-400";
}

function barColor(score: number): string {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-lime-500";
    if (score >= 40) return "bg-amber-500";
    return "bg-red-500";
}

export default function LlmMatchingDialog({ open, onClose, vagaId, candidatoId, candidatoNome, onAnalyzed }: LlmMatchingDialogProps) {
    const [data, setData] = useState<LlmResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [regenerating, setRegenerating] = useState(false);

    const fetchScore = async (force: boolean) => {
        setLoading(!force);
        setRegenerating(force);
        setError(null);
        try {
            const res = await apiFetch(
                `/api/vagas/${vagaId}/matching-llm/${candidatoId}?force=${force}`,
                { cache: "no-store" },
                MATCHING_LLM_FETCH_TIMEOUT_MS,
            );
            if (!res.ok) {
                if (res.status === 503) {
                    const body = await res.json().catch(() => ({ message: "Ollama indisponível" }));
                    throw new Error(body?.message || "Serviço IA indisponível");
                }
                throw new Error(`HTTP ${res.status}`);
            }
            const json = (await res.json()) as LlmResult;
            setData(json);
            onAnalyzed?.(json);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
            setRegenerating(false);
        }
    };

    useEffect(() => {
        if (!open) return;
        setData(null);
        setError(null);
        void fetchScore(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, vagaId, candidatoId]);

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bot className="size-5 text-violet-600" />
                        Análise por IA {candidatoNome ? `— ${candidatoNome}` : ""}
                    </DialogTitle>
                    <DialogDescription>
                        O modelo configurado em Admin → IA lê o CV + descrição de cargo + pesos da vaga e produz avaliação em PT-BR.
                        Cache automático — mesma combinação de CV/descrição/pesos retorna instantânea.
                    </DialogDescription>
                </DialogHeader>

                {loading && (
                    <LoadingWithElapsed />
                )}

                {error && !loading && (
                    <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm">
                        <strong className="text-red-700 dark:text-red-400">Não foi possível gerar análise:</strong> {error}
                        <p className="text-xs text-muted-foreground mt-2">
                            Verifique: (1) vaga tem Descrição de Cargo vinculada, (2) Admin → IA com provider Gemini
                            e chave ativa em Owner → IA, (3) módulo IA habilitado para o tenant.
                        </p>
                        <Button size="sm" variant="outline" className="mt-3" onClick={() => void fetchScore(false)}>
                            <RefreshCw className="size-3.5 mr-1" /> Tentar de novo
                        </Button>
                    </div>
                )}

                {data && !loading && (
                    <div className="space-y-4">
                        {/* Score final */}
                        <div className="rounded-lg border border-violet-500/40 bg-gradient-to-br from-violet-500/10 to-transparent p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Score IA</div>
                                    <div className={`text-5xl font-bold ${scoreColor(data.scoreFinal)}`}>
                                        {data.scoreFinal}<span className="text-2xl">/100</span>
                                    </div>
                                </div>
                                <div className="text-right space-y-1">
                                    <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${data.passouMatchMinimo ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-400/15 text-zinc-600"}`}>
                                        {data.passouMatchMinimo ? "✓ Passa no mínimo" : "Abaixo do mínimo"}
                                    </span>
                                    <div className="text-[10px] text-muted-foreground">
                                        {data.modelVersion} · {data.usouCache ? "📋 cache" : `⚡ ${(data.durationMs / 1000).toFixed(1)}s`}
                                    </div>
                                </div>
                            </div>

                            {data.justificativa && (
                                <blockquote className="mt-3 pt-3 border-t border-border/40 text-sm italic text-muted-foreground">
                                    <Sparkles className="inline size-3.5 mr-1 text-violet-500" />
                                    &ldquo;{data.justificativa}&rdquo;
                                </blockquote>
                            )}
                        </div>

                        {/* Pontos fortes + gaps gerais */}
                        {(data.pontosFortes?.length > 0 || data.gaps?.length > 0) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {data.pontosFortes?.length > 0 && (
                                    <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
                                        <div className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold mb-2">
                                            🌟 Pontos Fortes
                                        </div>
                                        <ul className="text-sm space-y-1">
                                            {data.pontosFortes.map((p, i) => <li key={i}>• {p}</li>)}
                                        </ul>
                                    </div>
                                )}
                                {data.gaps?.length > 0 && (
                                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                                        <div className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold mb-2">
                                            🔍 Gaps identificados
                                        </div>
                                        <ul className="text-sm space-y-1">
                                            {data.gaps.map((g, i) => <li key={i}>• {g}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Breakdown por critério */}
                        <div className="space-y-2">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Breakdown por critério (peso × score = contribuição)
                            </div>
                            {data.criterios.length === 0 ? (
                                <div className="text-sm text-muted-foreground italic">Nenhum critério retornado pela IA.</div>
                            ) : (
                                data.criterios.map((c, i) => (
                                    <div key={i} className="rounded-md border border-border/40 p-3">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="font-semibold text-sm">{c.nome}</div>
                                            <div className="text-xs text-muted-foreground font-mono">
                                                peso {c.peso} × <span className={scoreColor(c.score)}>{c.score}%</span> = <strong>{c.contribuicao.toFixed(1)} pts</strong>
                                            </div>
                                        </div>
                                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden mb-2">
                                            <div className={`h-full ${barColor(c.score)} transition-all`} style={{ width: `${c.score}%` }} />
                                        </div>
                                        {(c.pontosFortes?.length > 0 || c.gaps?.length > 0) && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                                {c.pontosFortes?.length > 0 && (
                                                    <div>
                                                        <div className="text-emerald-700 dark:text-emerald-400 font-semibold mb-0.5">Evidências ({c.pontosFortes.length})</div>
                                                        <ul className="text-muted-foreground space-y-0.5">
                                                            {c.pontosFortes.map((p, j) => <li key={j}>+ {p}</li>)}
                                                        </ul>
                                                    </div>
                                                )}
                                                {c.gaps?.length > 0 && (
                                                    <div>
                                                        <div className="text-amber-700 dark:text-amber-400 font-semibold mb-0.5">Gaps ({c.gaps.length})</div>
                                                        <ul className="text-muted-foreground space-y-0.5">
                                                            {c.gaps.map((g, j) => <li key={j}>− {g}</li>)}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {data && !loading && (
                        <Button variant="outline" onClick={() => void fetchScore(true)} disabled={regenerating} className="gap-1.5">
                            {regenerating ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                            Regenerar análise
                        </Button>
                    )}
                    <Button variant="default" onClick={onClose}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Loading com contador de segundos e mensagens dinâmicas conforme tempo passa —
 * ajuda a calibrar expectativa do usuário (CPU pode levar até 3min na cold start).
 */
function LoadingWithElapsed() {
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    const stage =
        elapsed < 15 ? "Conectando ao modelo de IA do tenant…"
        : elapsed < 45 ? "Analisando perfil do candidato e descrição da vaga…"
        : elapsed < 90 ? "Aplicando os pesos e gerando breakdown…"
        : elapsed < 150 ? "Ainda processando — aguarde."
        : "Quase lá — próxima chamada será instantânea (cache).";

    return (
        <div className="py-10 text-center space-y-3">
            <Loader2 className="mx-auto size-8 animate-spin text-violet-600" />
            <div className="text-sm text-muted-foreground">
                A IA está analisando o candidato…
                <div className="mt-2 text-xs">
                    <span className="inline-block min-w-[3rem] font-mono text-violet-700 dark:text-violet-400">
                        {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, "0")}
                    </span>
                    {" · "}
                    <span>{stage}</span>
                </div>
                <div className="mt-3 text-[11px] text-muted-foreground/70 max-w-md mx-auto">
                    Primeira avaliação pode levar 30–90s (Gemini na nuvem). Depois fica em cache.
                    Depois de processado, fica em cache e próximas chamadas são instantâneas.
                </div>
            </div>
        </div>
    );
}

/** Hook para abrir o dialog de qualquer lugar. */
export function useLlmMatchingDialog() {
    const [target, setTarget] = useState<{ vagaId: string; candidatoId: string; candidatoNome?: string } | null>(null);
    return {
        target,
        open: (vagaId: string, candidatoId: string, candidatoNome?: string) => {
            if (!vagaId || !candidatoId) {
                toast.error("IDs de vaga e candidato são obrigatórios");
                return;
            }
            setTarget({ vagaId, candidatoId, candidatoNome });
        },
        close: () => setTarget(null),
    };
}
