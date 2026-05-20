"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiJson } from "@/lib/api";
import {
  avancarEtapa,
  bulkAvancarEtapa,
  ETAPAS_KANBAN,
  getKanban,
  resolveEtapa,
  type EtapaMacroCandidatura,
  type KanbanCandidaturaItem,
  type KanbanCandidaturasResponse,
} from "./candidaturaApi";
import CandidateKanbanDetailDialog from "./CandidateKanbanDetailDialog";
import MatchingBreakdownDialog, { useMatchingBreakdownDialog } from "@/features/recrutamento/matching/MatchingBreakdownDialog";

type VagaLite = { id: string; titulo: string | null };

const ETAPA_LABELS: Record<EtapaMacroCandidatura, string> = {
  Aplicada: "Aplicada",
  EmTriagem: "Em triagem",
  Entrevista: "Entrevista",
  Teste: "Teste",
  Proposta: "Proposta",
  Contratado: "Contratado",
  Recusado: "Recusado",
  Desistiu: "Desistiu",
};

const ETAPA_STYLES: Record<EtapaMacroCandidatura, { header: string; accent: string }> = {
  Aplicada:   { header: "bg-sky-50 text-sky-900",         accent: "border-sky-200" },
  EmTriagem:  { header: "bg-indigo-50 text-indigo-900",   accent: "border-indigo-200" },
  Entrevista: { header: "bg-violet-50 text-violet-900",   accent: "border-violet-200" },
  Teste:      { header: "bg-fuchsia-50 text-fuchsia-900", accent: "border-fuchsia-200" },
  Proposta:   { header: "bg-amber-50 text-amber-900",     accent: "border-amber-200" },
  Contratado: { header: "bg-emerald-50 text-emerald-900", accent: "border-emerald-200" },
  Recusado:   { header: "bg-rose-50 text-rose-900",       accent: "border-rose-200" },
  Desistiu:   { header: "bg-neutral-100 text-neutral-700", accent: "border-neutral-200" },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

export default function CandidaturasKanbanScreen() {
  const [data, setData] = useState<KanbanCandidaturasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [vagaId, setVagaId] = useState<string>("");
  const [vagas, setVagas] = useState<VagaLite[]>([]);
  const [dragging, setDragging] = useState<KanbanCandidaturaItem | null>(null);
  const [hoverEtapa, setHoverEtapa] = useState<EtapaMacroCandidatura | null>(null);
  const [detailItem, setDetailItem] = useState<KanbanCandidaturaItem | null>(null);
  // Sessão 31.8 — explicabilidade do matching
  const matchDialog = useMatchingBreakdownDialog();

  // Sessão 31.8 (FASE 3.B) — bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTargetEtapa, setBulkTargetEtapa] = useState<EtapaMacroCandidatura | "">("");
  const [bulkRunning, setBulkRunning] = useState(false);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function runBulkAvancar() {
    if (selectedIds.size === 0 || !bulkTargetEtapa) return;
    setBulkRunning(true);
    try {
      const result = await bulkAvancarEtapa(Array.from(selectedIds), bulkTargetEtapa as EtapaMacroCandidatura);
      if (result.sucesso > 0) toast.success(`${result.sucesso} de ${result.total} avançado(s)`);
      if (result.falha > 0) {
        const detalhes = result.itens
          .filter((i) => !i.sucesso)
          .map((i) => `• ${i.candidatoNome ?? i.candidaturaId.slice(0, 8)}: ${i.erro ?? "erro"}`)
          .join("\n");
        toast.error(`${result.falha} falha(s):\n${detalhes}`, { duration: 10000 });
      }
      clearSelection();
      setBulkTargetEtapa("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao executar ação em massa");
    } finally {
      setBulkRunning(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await getKanban(vagaId || null);
      setData(resp);
    } catch {
      toast.error("Falha ao carregar o kanban.");
    } finally {
      setLoading(false);
    }
  }, [vagaId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    (async () => {
      try {
        const vs = await apiJson<VagaLite[]>("/api/vagas").catch(() => [] as VagaLite[]);
        setVagas(vs);
      } catch { /* ignore */ }
    })();
  }, []);

  const columns = useMemo(() => {
    const map = new Map<EtapaMacroCandidatura, KanbanCandidaturaItem[]>();
    for (const e of ETAPAS_KANBAN) map.set(e, []);
    if (data) {
      for (const col of data.colunas) {
        const etapa = resolveEtapa(col.etapa);
        map.set(etapa, col.itens.map((it) => ({ ...it, etapaMacro: resolveEtapa(it.etapaMacro) })));
      }
    }
    return map;
  }, [data]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const [k, v] of columns) t[k] = v.length;
    return t;
  }, [columns]);

  const onDropTo = async (etapa: EtapaMacroCandidatura) => {
    setHoverEtapa(null);
    const item = dragging;
    setDragging(null);
    if (!item) return;
    const atual = resolveEtapa(item.etapaMacro);
    if (atual === etapa) return;

    const obs = window.prompt(
      `Mover "${item.candidatoNome}" de ${ETAPA_LABELS[atual]} para ${ETAPA_LABELS[etapa]}. Observação (opcional):`,
      "",
    );
    if (obs === null) return;

    try {
      await avancarEtapa(item.id, etapa, obs.trim() || null);
      toast.success(`Movido para ${ETAPA_LABELS[etapa]}.`);
      await load();
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao mover.");
    }
  };

  return (
    <section className="space-y-4 p-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Kanban de candidaturas</h1>
          <p className="text-sm text-neutral-600">
            Arraste os cards entre as colunas para avançar a etapa.
            {data ? ` ${data.total} candidatura${data.total === 1 ? "" : "s"}.` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-700">
            Vaga:{" "}
            <select
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              value={vagaId}
              onChange={(e) => setVagaId(e.target.value)}
            >
              <option value="">Todas</option>
              {vagas.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.titulo ?? v.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
          <Button variant="outline" onClick={() => void load()}>Atualizar</Button>
        </div>
      </header>

      {/* Sessão 31.8 (FASE 3.B) — Barra contextual de bulk actions */}
      {selectedIds.size > 0 && (
        <div className="rounded-md border border-sky-300 bg-sky-50 px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium text-sky-900">
            {selectedIds.size} candidatura(s) selecionada(s)
          </span>
          <select
            className="rounded-md border border-sky-300 px-3 py-1.5 text-sm bg-white"
            value={bulkTargetEtapa}
            onChange={(e) => setBulkTargetEtapa(e.target.value as EtapaMacroCandidatura | "")}
          >
            <option value="">Mover para...</option>
            {ETAPAS_KANBAN.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <Button
            size="sm"
            onClick={() => void runBulkAvancar()}
            disabled={!bulkTargetEtapa || bulkRunning}
          >
            {bulkRunning ? "Movendo…" : "Aplicar"}
          </Button>
          <Button size="sm" variant="outline" onClick={clearSelection} disabled={bulkRunning}>
            Limpar seleção
          </Button>
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
          Carregando…
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {ETAPAS_KANBAN.map((etapa) => {
            const style = ETAPA_STYLES[etapa];
            const itens = columns.get(etapa) ?? [];
            const isHover = hoverEtapa === etapa;
            return (
              <div
                key={etapa}
                className={`flex w-72 shrink-0 flex-col rounded-lg border bg-white ${style.accent} ${isHover ? "ring-2 ring-sky-400" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setHoverEtapa(etapa); }}
                onDragLeave={() => { if (hoverEtapa === etapa) setHoverEtapa(null); }}
                onDrop={(e) => { e.preventDefault(); void onDropTo(etapa); }}
              >
                <div className={`rounded-t-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide ${style.header}`}>
                  <div className="flex items-center justify-between">
                    <span>{ETAPA_LABELS[etapa]}</span>
                    <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] text-neutral-700">
                      {totals[etapa] ?? 0}
                    </span>
                  </div>
                </div>
                <div className="flex min-h-[120px] flex-1 flex-col gap-2 p-2">
                  {itens.length === 0 ? (
                    <div className="py-6 text-center text-xs text-neutral-400">Vazio</div>
                  ) : (
                    itens.map((it) => {
                      // Sessão 31.8 — SLA semáforo: borda esquerda colorida + tooltip
                      const slaBorder = it.slaSemaforo === "verde"
                        ? "border-l-emerald-500"
                        : it.slaSemaforo === "amarelo"
                          ? "border-l-amber-500"
                          : "border-l-red-500";
                      const slaBg = it.slaSemaforo === "verde"
                        ? "bg-emerald-50 text-emerald-800"
                        : it.slaSemaforo === "amarelo"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-red-50 text-red-800";
                      const slaTooltip = `${it.diasNaEtapa} dia(s) na etapa (SLA: ${it.slaDiasEtapa} dias)`;
                      const isSelected = selectedIds.has(it.id);
                      const hasMatchScore = typeof it.matchScore === "number" && Number.isFinite(it.matchScore);
                      return (
                        <article
                          key={it.id}
                          draggable
                          onDragStart={() => setDragging(it)}
                          onDragEnd={() => { setDragging(null); setHoverEtapa(null); }}
                          onClick={() => setDetailItem(it)}
                          className={`cursor-grab rounded-md border border-l-4 ${slaBorder} ${isSelected ? "border-sky-400 ring-2 ring-sky-200" : "border-neutral-200"} bg-white p-3 text-sm shadow-sm hover:shadow-md active:cursor-grabbing`}
                          title={slaTooltip}
                        >
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-1 accent-sky-600 cursor-pointer"
                              checked={isSelected}
                              onChange={(e) => { e.stopPropagation(); toggleSelected(it.id); }}
                              onClick={(e) => e.stopPropagation()}
                              title="Selecionar para ação em massa"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-neutral-900">{it.candidatoNome}</div>
                              {it.candidatoEmail && (
                                <div className="truncate text-xs text-neutral-500">{it.candidatoEmail}</div>
                              )}
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-neutral-600">
                            {it.vagaTitulo ?? it.vagaId.slice(0, 8)}
                            {it.vagaCodigo ? ` · ${it.vagaCodigo}` : ""}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                            <span className={`rounded-full px-2 py-0.5 font-medium ${slaBg}`} title={slaTooltip}>
                              {it.diasNaEtapa}d / {it.slaDiasEtapa}d
                            </span>
                            {hasMatchScore && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  matchDialog.open(it.vagaId, it.candidatoId, it.candidatoNome);
                                }}
                                className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-800 hover:bg-sky-100 cursor-pointer transition-colors"
                                title="Ver breakdown explicável (peso × score por critério)"
                              >
                                match {Math.round(it.matchScore ?? 0)}% →
                              </button>
                            )}
                          </div>
                          <div className="mt-1 text-[10px] text-neutral-400">
                            Aplicada: {formatDate(it.aplicadaEmUtc)}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sessão 31.8 — Breakdown explicável do matching */}
      {matchDialog.target && (
        <MatchingBreakdownDialog
          open={!!matchDialog.target}
          onClose={matchDialog.close}
          vagaId={matchDialog.target.vagaId}
          candidatoId={matchDialog.target.candidatoId}
          candidatoNome={matchDialog.target.candidatoNome}
        />
      )}

      <CandidateKanbanDetailDialog
        open={!!detailItem}
        item={detailItem}
        onClose={() => setDetailItem(null)}
      />
    </section>
  );
}
