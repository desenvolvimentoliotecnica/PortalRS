"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { MatchResult } from "@/features/recrutamento/matching/matchingHelpers";
import {
  type CandidatoMatchTabData,
  type MatchingBreakdownData,
  loadCandidatoMatchTab,
  recalculateCandidatoMatch,
} from "@/features/recrutamento/candidatos/candidatoMatchLoad";

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-700";
  if (score >= 50) return "text-amber-700";
  return "text-red-700";
}

function barColor(score: number): string {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function normalizeScore(v: number): number {
  return Math.round(v > 1 ? v : v * 100);
}

type Props = {
  vagaId: string;
  candidatoId: string;
  cvTexto: string | null;
};

export default function CandidatoMatchTabPanel({ vagaId, candidatoId, cvTexto }: Props) {
  const [data, setData] = useState<CandidatoMatchTabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const load = useCallback(async () => {
    if (!vagaId.trim() || !candidatoId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await loadCandidatoMatchTab(vagaId, candidatoId, (cvTexto ?? "").trim());
      setData(result);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Falha ao carregar matching.");
    } finally {
      setLoading(false);
    }
  }, [vagaId, candidatoId, cvTexto, reloadToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRecalculate = async () => {
    setRecalculating(true);
    try {
      await recalculateCandidatoMatch(vagaId, candidatoId);
      toast.success("Match recalculado com os dados atuais do candidato.");
      setReloadToken((t) => t + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao recalcular match.");
    } finally {
      setRecalculating(false);
    }
  };

  const cvEmpty = !(cvTexto ?? "").trim();

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[rgba(16,82,144,.14)] bg-white/55 p-3 text-sm text-muted-foreground space-y-2">
        <p>
          Esta aba mostra o <strong className="text-foreground">nível de aderência</strong> do candidato à vaga
          selecionada. O sistema usa o <strong className="text-foreground">texto do CV</strong>, resumo, competências
          e, quando disponível, a <strong className="text-foreground">Descrição de Cargo (DNALIO)</strong> da vaga.
        </p>
        <p className="text-xs">
          Com template DNALIO: score por critérios (competência, experiência, formação, localidade, etc.), podendo
          incluir similaridade semântica (IA). Sem template: comparação por{" "}
          <strong className="text-foreground">palavras-chave</strong> dos requisitos da vaga com o texto do CV.
        </p>
        {cvEmpty ? (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
            O texto do CV está vazio — envie ou extraia um currículo na aba <strong>Texto do CV</strong> para
            melhorar a precisão do match.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={loading || recalculating} onClick={() => void load()}>
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Atualizar
        </Button>
        <Button variant="outline" size="sm" disabled={recalculating || loading} onClick={() => void onRecalculate()}>
          {recalculating ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Recalcular e salvar score
        </Button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-muted-foreground text-sm">
          <Loader2 className="mx-auto size-6 animate-spin mb-2" />
          Calculando compatibilidade com a vaga…
        </div>
      ) : null}

      {error && !loading ? (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-900 p-3 text-sm space-y-2">
          <div className="font-semibold">Não foi possível exibir o match</div>
          <p>{error}</p>
          <p className="text-xs text-red-800/90">
            Verifique se a vaga existe, se o candidato está vinculado a ela e se há requisitos ou Descrição de
            Cargo configurados. Use <strong>Recalcular</strong> após atualizar o texto do CV.
          </p>
        </div>
      ) : null}

      {data?.kind === "breakdown" && !loading ? <BreakdownView data={data.data} /> : null}
      {data?.kind === "lexical" && !loading ? <LexicalView data={data.data} hint={data.hint} /> : null}
    </div>
  );
}

function BreakdownView({ data }: { data: MatchingBreakdownData }) {
  return (
    <div className="space-y-3">
      {data.modo ? (
        <p className="text-xs text-muted-foreground">
          Modo de cálculo:{" "}
          <strong>
            {data.modo === "ai"
              ? "IA híbrida (léxico + semântico + localidade)"
              : data.modo === "semantic"
                ? "Semântico (TF-IDF + localidade)"
                : "Léxico / DNALIO"}
          </strong>
          {data.scoreLexico != null && data.scoreSemantico != null
            ? ` — léxico ${data.scoreLexico}% · semântico ${data.scoreSemantico}%`
            : null}
        </p>
      ) : null}

      <div className="flex items-center justify-between rounded-lg border p-4 bg-white/60">
        <div>
          <div className="text-xs text-muted-foreground uppercase">Score final</div>
          <div className={`text-3xl font-bold ${scoreColor(data.scoreFinal)}`}>{data.scoreFinal}%</div>
        </div>
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            data.passouMatchMinimo ? "bg-emerald-500/15 text-emerald-700" : "bg-red-500/15 text-red-700"
          }`}
        >
          {data.passouMatchMinimo ? "Dentro do mínimo da vaga" : "Abaixo do mínimo da vaga"}
        </span>
      </div>

      {data.distanciaKm != null ? (
        <p className="text-xs text-muted-foreground">
          Distância estimada candidato × local da vaga: <strong>{data.distanciaKm.toFixed(1)} km</strong>
        </p>
      ) : null}

      {data.explicacaoIa ? (
        <div className="rounded-lg border border-violet-200 bg-violet-50/80 p-3 text-sm">{data.explicacaoIa}</div>
      ) : null}

      {data.evidenciasSemanticas && data.evidenciasSemanticas.length > 0 ? (
        <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 text-xs space-y-1">
          <div className="font-semibold text-violet-800">Evidências semânticas (IA)</div>
          <ul className="space-y-1">
            {data.evidenciasSemanticas.slice(0, 3).map((ev, i) => (
              <li key={i}>
                <span className="font-mono text-violet-700">{(ev.similaridade * 100).toFixed(0)}%</span>{" "}
                [{ev.categoria}] {ev.texto}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.temRequisitoObrigatorioFaltando ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <strong>Requisito(s) obrigatório(s) não atendido(s)</strong> — o score pode estar limitado:
          <ul className="list-disc list-inside mt-1 text-xs">
            {data.requisitosObrigatoriosFaltando.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="font-semibold text-sm">Critérios avaliados</div>
      {data.criterios.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum critério com peso configurado nesta vaga.</p>
      ) : (
        <div className="space-y-2">
          {data.criterios.map((c) => (
            <div key={c.nome} className="rounded-lg border p-3 bg-white/50 text-sm">
              <div className="flex justify-between gap-2 mb-1">
                <span className="font-medium">{c.nome}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  peso {c.peso} × {c.score}% = {c.contribuicao.toFixed(1)} pts
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
                <div className={`h-full ${barColor(c.score)}`} style={{ width: `${Math.min(100, c.score)}%` }} />
              </div>
              {(c.itensCobertos.length > 0 || c.itensFaltando.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {c.itensCobertos.length > 0 ? (
                    <div>
                      <span className="text-emerald-700 font-medium">Cobertos: </span>
                      {c.itensCobertos.slice(0, 8).join(", ")}
                    </div>
                  ) : null}
                  {c.itensFaltando.length > 0 ? (
                    <div>
                      <span className="text-red-700 font-medium">Faltando: </span>
                      {c.itensFaltando.slice(0, 8).join(", ")}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LexicalView({ data, hint }: { data: MatchResult; hint: string }) {
  const score = normalizeScore(data.score);
  const threshold = normalizeScore(data.threshold);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-950">{hint}</div>

      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold">Score por palavras-chave</div>
          <div className="text-muted-foreground text-sm">Requisitos da vaga × texto do CV</div>
        </div>
        <div className="text-2xl font-bold" style={{ color: "rgb(var(--lt-primary))" }}>
          {score}%
        </div>
      </div>

      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full rounded-full bg-[rgb(var(--lt-primary))]" style={{ width: `${Math.min(100, score)}%` }} />
      </div>

      <p className="text-sm text-muted-foreground">
        Mínimo da vaga: <strong>{threshold}%</strong>
        {" · "}
        <span className={data.pass ? "text-emerald-700" : "text-red-700"}>
          {data.pass ? "Aprovado no critério mínimo" : "Abaixo do mínimo"}
        </span>
        {" · "}
        Termos encontrados: <strong>{data.hits.length}</strong>
        {" · "}
        Obrigatórios faltando: <strong>{data.missMandatory.length}</strong>
      </p>

      {data.missMandatory.length > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
          <div className="font-medium text-red-900 mb-1">Obrigatórios não encontrados no CV</div>
          <div>{data.missMandatory.map((x) => x.termo).join(", ")}</div>
        </div>
      ) : null}

      {data.hits.length > 0 ? (
        <div>
          <div className="font-medium text-sm mb-1">Encontrados no texto do CV</div>
          <div className="text-sm text-muted-foreground">{data.hits.map((x) => x.termo).join(", ")}</div>
        </div>
      ) : null}
    </div>
  );
}

