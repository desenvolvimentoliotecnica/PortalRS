"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { MATCHING_FETCH_TIMEOUT_MS } from "@/features/recrutamento/matching/matchingHelpers";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

/**
 * Sessão 31.8 — Diálogo de explicabilidade do matching (FASE 1.4.b).
 *
 * Renderiza o breakdown retornado por `GET /api/vagas/{vagaId}/matching-breakdown/{candidatoId}`:
 * score final, distância em km, lista de critérios (Competência, Experiência,
 * Formação, Localidade, Idioma, Conhecimento Técnico, Vivência Específica) com
 * peso, sub-score, contribuição e itens cobertos/faltando.
 *
 * Pode ser plugado em qualquer tela que mostre par candidato × vaga (kanban,
 * detalhe de vaga, lista de candidatos da vaga). Aceita open/onClose externos
 * para integrar com o consumidor.
 */
interface Criterio {
  nome: string;
  peso: number;
  score: number;
  contribuicao: number;
  itensCobertos: string[];
  itensFaltando: string[];
}

interface SemanticEvidence {
  categoria: string;
  subcategoria: string | null;
  texto: string;
  similaridade: number;
}

interface Breakdown {
  candidatoId: string;
  vagaId: string;
  scoreFinal: number;
  passouMatchMinimo: boolean;
  distanciaKm: number | null;
  criterios: Criterio[];
  temRequisitoObrigatorioFaltando: boolean;
  requisitosObrigatoriosFaltando: string[];
  // Campos híbridos (Fase 4 — matching com Ollama + pgvector)
  modo?: "lexical" | "ai" | "semantic";
  scoreSemantico?: number | null;
  scoreLexico?: number | null;
  evidenciasSemanticas?: SemanticEvidence[] | null;
  explicacaoIa?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  vagaId: string;
  candidatoId: string;
  candidatoNome?: string;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-700 dark:text-emerald-400";
  if (score >= 50) return "text-amber-700 dark:text-amber-400";
  return "text-red-700 dark:text-red-400";
}

function barColor(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export default function MatchingBreakdownDialog({ open, onClose, vagaId, candidatoId, candidatoNome }: Props) {
  const [data, setData] = useState<Breakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Modo de cálculo: "auto" prefere híbrido (Ollama); "lexical" força apenas TF-IDF.
  const [mode, setMode] = useState<"auto" | "lexical">("auto");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        // Fase 4 — tenta híbrido por default; fallback já é tratado pelo backend.
        const endpoint = mode === "lexical"
          ? `/api/vagas/${vagaId}/matching-breakdown/${candidatoId}`
          : `/api/vagas/${vagaId}/matching-breakdown-hybrid/${candidatoId}`;
        const res = await apiFetch(endpoint, { cache: "no-store" }, MATCHING_FETCH_TIMEOUT_MS);
        if (!res.ok) {
          if (res.status === 404) {
            const body = await res.json().catch(() => ({ message: "Sem detalhes disponíveis" }));
            throw new Error(body?.message ?? "Vaga sem Descrição de Cargo vinculada — atribua um template DNALIO para ver a compatibilidade.");
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as Breakdown;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar compatibilidade");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, vagaId, candidatoId, mode]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Match {candidatoNome ? `de ${candidatoNome}` : "do candidato"} com a vaga
          </DialogTitle>
          <DialogDescription>
            Explicação granular: peso configurado por critério, sub-score, contribuição e itens da Descrição de Cargo cobertos/faltando.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="py-8 text-center text-sm text-muted-foreground">Calculando…</div>
        )}

        {error && !loading && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <strong>Não foi possível calcular:</strong> {error}
            <p className="text-xs text-muted-foreground mt-1">
              Para ver o detalhamento da compatibilidade, a vaga precisa apontar para uma <strong>Descrição de Cargo</strong> (cadastro
              em /app/descricao-cargo seguindo o template DNALIO). Vagas sem template usam o algoritmo legado, sem detalhamento por critério.
            </p>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-4">
            {/* Toggle modo cálculo */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Cálculo:</span>
                <button
                  type="button"
                  className={`rounded px-2 py-1 border ${mode === "auto" ? "bg-primary text-primary-foreground border-primary" : "bg-transparent"}`}
                  onClick={() => setMode("auto")}
                  title="Prioriza IA (Ollama) — cai em Semântico automaticamente se indisponível"
                >
                  🧠 Auto (IA priorizado)
                </button>
                <button
                  type="button"
                  className={`rounded px-2 py-1 border ${mode === "lexical" ? "bg-primary text-primary-foreground border-primary" : "bg-transparent"}`}
                  onClick={() => setMode("lexical")}
                  title="Força modo léxico puro sem IA (para auditoria)"
                >
                  📏 Léxico (debug)
                </button>
              </div>
              {data.modo && (
                <span className="text-muted-foreground">
                  {data.modo === "ai" && (
                    <span className="text-violet-700 dark:text-violet-400" title="Blend: léxico + embeddings (bge-m3) + localidade">
                      🧠 <strong>IA (híbrido)</strong> — léxico {data.scoreLexico} + semântico {data.scoreSemantico}
                    </span>
                  )}
                  {data.modo === "semantic" && (
                    <span className="text-amber-700 dark:text-amber-400" title="Ollama indisponível — fallback com TF-IDF + stems + sinônimos + Haversine">
                      📊 <strong>Semântico</strong> (fallback) — sem embeddings, TF-IDF + stems + sinônimos + localidade
                    </span>
                  )}
                  {data.modo === "lexical" && (
                    <span title="Mesmo algoritmo do 'Semântico', mas chamado via endpoint direto sem tentar IA">
                      📏 <strong>Léxico</strong> — TF-IDF + stems + sinônimos + localidade
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Score final + status */}
            <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 p-4">
              <div>
                <div className="text-xs text-muted-foreground uppercase">Score final</div>
                <div className={`text-4xl font-bold ${scoreColor(data.scoreFinal)}`}>{data.scoreFinal}<span className="text-2xl">%</span></div>
              </div>
              <div className="text-right space-y-1">
                <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold ${data.passouMatchMinimo ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-zinc-400/15 text-zinc-600 dark:text-zinc-400"}`}>
                  {data.passouMatchMinimo ? "Passa no mínimo" : "Abaixo do mínimo"}
                </span>
                {data.distanciaKm != null && (
                  <div className="text-xs text-muted-foreground">
                    Distância candidato × empresa: <strong>{data.distanciaKm.toFixed(1)} km</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Evidências semânticas (Fase 4) */}
            {data.evidenciasSemanticas && data.evidenciasSemanticas.length > 0 && (
              <div className="rounded-md border border-violet-500/40 bg-violet-500/5 p-3">
                <div className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wider mb-2">
                  🧠 Por que a IA acha que bate (top-3 similaridade semântica)
                </div>
                <ul className="space-y-1.5">
                  {data.evidenciasSemanticas.map((ev, i) => (
                    <li key={i} className="text-xs">
                      <span className="inline-flex items-center rounded bg-violet-500/15 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 font-mono mr-2">
                        {(ev.similaridade * 100).toFixed(0)}%
                      </span>
                      <span className="text-muted-foreground">[{ev.categoria}{ev.subcategoria ? ` / ${ev.subcategoria}` : ""}]</span>{" "}
                      <span>{ev.texto}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Penalidade por requisitos obrigatórios faltando */}
            {data.temRequisitoObrigatorioFaltando && (
              <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">
                <strong className="text-red-700 dark:text-red-400">Score capado em 60</strong> — requisito(s) obrigatório(s) não atendido(s):
                <ul className="list-disc list-inside mt-1 text-xs">
                  {data.requisitosObrigatoriosFaltando.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            {/* Critérios — barras */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Critérios usados (peso × score = contribuição)</div>
              {data.criterios.length === 0 ? (
                <div className="text-sm text-muted-foreground italic">Nenhum critério com peso configurado nesta vaga.</div>
              ) : (
                data.criterios.map((c) => (
                  <div key={c.nome} className="rounded-md border border-border/40 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold text-sm">{c.nome}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        peso {c.peso} × <span className={scoreColor(c.score)}>{c.score}%</span> = <strong>{c.contribuicao.toFixed(1)} pts</strong>
                      </div>
                    </div>
                    {/* Barra de progresso */}
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden mb-2">
                      <div className={`h-full ${barColor(c.score)} transition-all`} style={{ width: `${c.score}%` }} />
                    </div>
                    {(c.itensCobertos.length > 0 || c.itensFaltando.length > 0) && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {c.itensCobertos.length > 0 && (
                          <div>
                            <div className="text-emerald-700 dark:text-emerald-400 font-semibold mb-1">✓ Cobertos ({c.itensCobertos.length})</div>
                            <ul className="text-muted-foreground space-y-0.5">
                              {c.itensCobertos.slice(0, 6).map((t, i) => <li key={i}>• {t}</li>)}
                              {c.itensCobertos.length > 6 && <li className="italic">…e mais {c.itensCobertos.length - 6}</li>}
                            </ul>
                          </div>
                        )}
                        {c.itensFaltando.length > 0 && (
                          <div>
                            <div className="text-red-700 dark:text-red-400 font-semibold mb-1">✗ Faltando ({c.itensFaltando.length})</div>
                            <ul className="text-muted-foreground space-y-0.5">
                              {c.itensFaltando.slice(0, 6).map((t, i) => <li key={i}>• {t}</li>)}
                              {c.itensFaltando.length > 6 && <li className="italic">…e mais {c.itensFaltando.length - 6}</li>}
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
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Hook utilitário pra abrir o breakdown a partir de qualquer card. */
export function useMatchingBreakdownDialog() {
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
