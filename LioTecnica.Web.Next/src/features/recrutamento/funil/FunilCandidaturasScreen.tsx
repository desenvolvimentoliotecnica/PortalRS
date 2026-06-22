"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiJson } from "@/lib/api";
import { getFunil, type FunilCandidaturasResponse } from "@/features/recrutamento/candidaturas/candidaturaApi";

/**
 * Sessão 31.8 (FASE 3.A) — Tela de Funil de Conversão de Candidaturas.
 *
 * Mostra o funil cumulativo (Aplicada → Triagem → Entrevista → Teste → Proposta
 * → Contratado) com total por etapa e taxa de conversão entre etapas adjacentes.
 *
 * Filtros: vaga (opcional) e período de aplicação (opcional).
 * Visual: barra horizontal por etapa, largura proporcional ao total da etapa
 * inicial; badge mostrando "X% → próxima".
 */
interface VagaLite { id: string; titulo: string | null; codigo: string | null }

export default function FunilCandidaturasScreen() {
  const [data, setData] = useState<FunilCandidaturasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [vagaId, setVagaId] = useState<string>("");
  const [inicio, setInicio] = useState<string>("");
  const [fim, setFim] = useState<string>("");
  const [vagas, setVagas] = useState<VagaLite[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await getFunil({
        vagaId: vagaId || null,
        inicioUtc: inicio ? new Date(inicio).toISOString() : null,
        fimUtc: fim ? new Date(fim).toISOString() : null,
      });
      setData(d);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar funil");
    } finally {
      setLoading(false);
    }
  }, [vagaId, inicio, fim]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const list = await apiJson<VagaLite[]>("/api/vagas?take=2000");
        setVagas(Array.isArray(list) ? list : []);
      } catch { setVagas([]); }
    })();
  }, []);

  const totalInicial = data?.etapas?.[0]?.total ?? 0;

  return (
    <section className="space-y-4 p-4">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Funil de Conversão</h1>
          <p className="text-sm text-neutral-600">
            Total cumulativo por etapa do recrutamento + taxa de conversão entre etapas adjacentes.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-sm text-neutral-700 flex items-center gap-2">
            Vaga:
            <select
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
              value={vagaId}
              onChange={(e) => setVagaId(e.target.value)}
            >
              <option value="">Todas</option>
              {vagas.map((v) => (
                <option key={v.id} value={v.id}>{v.titulo ?? v.id.slice(0, 8)}{v.codigo ? ` · ${v.codigo}` : ""}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-neutral-700 flex items-center gap-2">
            De:
            <Input type="date" className="w-40" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label className="text-sm text-neutral-700 flex items-center gap-2">
            Até:
            <Input type="date" className="w-40" value={fim} onChange={(e) => setFim(e.target.value)} />
          </label>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="size-4" /><span className="ml-1">Atualizar</span>
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
          Carregando…
        </div>
      ) : !data ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
          Nenhum dado.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="text-xs text-muted-foreground uppercase">Total geral</div>
              <div className="mt-1 text-2xl font-bold text-neutral-900">{data.totalGeral}</div>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="text-xs text-muted-foreground uppercase">Aplicaram</div>
              <div className="mt-1 text-2xl font-bold text-sky-600">{totalInicial}</div>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="text-xs text-muted-foreground uppercase">Contratados</div>
              <div className="mt-1 text-2xl font-bold text-emerald-600">
                {data.etapas.find((e) => e.titulo === "Em processo de admissão")?.total ?? 0}
              </div>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="text-xs text-muted-foreground uppercase">Conv. Aplicada → Contratado</div>
              <div className="mt-1 text-2xl font-bold text-violet-600">
                {(() => {
                  const aplicada = data.etapas.find((e) => e.titulo === "Aplicada")?.total ?? 0;
                  const contratado = data.etapas.find((e) => e.titulo === "Em processo de admissão")?.total ?? 0;
                  if (aplicada === 0) return "—";
                  return `${((contratado * 100) / aplicada).toFixed(1)}%`;
                })()}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white p-6 space-y-3">
            <div className="text-sm font-semibold mb-2">Funil por etapa</div>
            {data.etapas.map((etapa) => {
              const widthPct = totalInicial > 0 ? Math.max(5, (etapa.total / totalInicial) * 100) : 100;
              return (
                <div key={etapa.titulo} className="space-y-1">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium text-neutral-900">{etapa.titulo}</span>
                    <span className="text-neutral-600 font-mono">
                      {etapa.total} candidato(s)
                      {etapa.taxaConversaoPercent !== null && (
                        <span className={`ml-2 text-xs ${etapa.taxaConversaoPercent >= 50 ? "text-emerald-700" : etapa.taxaConversaoPercent >= 25 ? "text-amber-700" : "text-red-700"}`}>
                          → {etapa.taxaConversaoPercent.toFixed(1)}% para a próxima
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="h-8 w-full bg-neutral-100 rounded-md overflow-hidden">
                    <div
                      className="h-full bg-sky-500 transition-all flex items-center justify-end pr-2 text-xs font-semibold text-white"
                      style={{ width: `${widthPct}%` }}
                    >
                      {widthPct >= 15 && etapa.total > 0 ? etapa.total : ""}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {data.vagaTitulo && (
            <p className="text-xs text-muted-foreground">
              Filtrado por vaga: <strong>{data.vagaTitulo}</strong>
            </p>
          )}
        </>
      )}
    </section>
  );
}
