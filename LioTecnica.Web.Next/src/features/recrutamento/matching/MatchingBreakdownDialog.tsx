"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
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

interface Breakdown {
  candidatoId: string;
  vagaId: string;
  scoreFinal: number;
  passouMatchMinimo: boolean;
  distanciaKm: number | null;
  criterios: Criterio[];
  temRequisitoObrigatorioFaltando: boolean;
  requisitosObrigatoriosFaltando: string[];
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

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const res = await apiFetch(`/api/vagas/${vagaId}/matching-breakdown/${candidatoId}`, { cache: "no-store" });
        if (!res.ok) {
          if (res.status === 404) {
            const body = await res.json().catch(() => ({ message: "Sem breakdown disponível" }));
            throw new Error(body?.message ?? "Vaga sem Descrição de Cargo vinculada — atribua um template DNALIO para ver o breakdown.");
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as Breakdown;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar breakdown");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, vagaId, candidatoId]);

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
              Para ver o breakdown explicável, a vaga precisa apontar para uma <strong>Descrição de Cargo</strong> (cadastro
              em /app/descricao-cargo seguindo o template DNALIO). Vagas sem template usam o algoritmo legado, sem breakdown.
            </p>
          </div>
        )}

        {data && !loading && (
          <div className="space-y-4">
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
