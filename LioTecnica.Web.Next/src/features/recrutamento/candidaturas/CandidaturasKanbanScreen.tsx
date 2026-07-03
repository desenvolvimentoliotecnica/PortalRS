"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  avancarEtapa,
  bulkAvancarEtapa,
  ETAPA_KANBAN_LABELS,
  ETAPAS_KANBAN,
  getKanban,
  getKanbanVagas,
  isEtapaDeclinado,
  KANBAN_COLUNA_DECLINADO,
  labelEtapaKanban,
  resolveEtapa,
  type AgendarEntrevistaCandidaturaRequest,
  type EtapaMacroCandidatura,
  type KanbanCandidaturaItem,
  type KanbanCandidaturasResponse,
  type KanbanVagaFiltroItem,
} from "./candidaturaApi";
import CandidateKanbanDetailDialog from "./CandidateKanbanDetailDialog";
import MatchingBreakdownDialog, { useMatchingBreakdownDialog } from "@/features/recrutamento/matching/MatchingBreakdownDialog";
import { WhatsAppContactButton } from "@/components/contact/WhatsAppContactButton";

const ETAPA_LABELS = ETAPA_KANBAN_LABELS;

const ETAPA_STYLES: Record<EtapaMacroCandidatura, { header: string; accent: string }> = {
  Aplicada:   { header: "bg-sky-50 text-sky-900",         accent: "border-sky-200" },
  EmTriagem:  { header: "bg-indigo-50 text-indigo-900",   accent: "border-indigo-200" },
  Entrevista: { header: "bg-violet-50 text-violet-900",   accent: "border-violet-200" },
  EntrevistaTecnica: { header: "bg-purple-50 text-purple-900", accent: "border-purple-200" },
  Teste:      { header: "bg-fuchsia-50 text-fuchsia-900", accent: "border-fuchsia-200" },
  Proposta:   { header: "bg-amber-50 text-amber-900",     accent: "border-amber-200" },
  Contratado: { header: "bg-emerald-50 text-emerald-900", accent: "border-emerald-200" },
  ReprovadoRh: { header: "bg-orange-50 text-orange-900", accent: "border-orange-200" },
  ReprovadoGestor: { header: "bg-rose-50 text-rose-900", accent: "border-rose-200" },
  Recusado:   { header: "bg-red-50 text-red-900",       accent: "border-red-200" },
  Desistiu:   { header: "bg-neutral-100 text-neutral-700", accent: "border-neutral-200" },
};

type ResponsavelEntrevistaOption = {
  id: string;
  nome: string;
  email?: string | null;
  origem?: "funcionario" | "usuario";
};

type EntrevistaParticipante = {
  funcionarioId?: string | null;
  userId?: string | null;
  nome: string;
  email?: string | null;
  origem?: "funcionario" | "usuario";
};

type InterviewDraft = {
  data: string;
  horario: string;
  duracaoMinutos: number;
  formato: "Presencial" | "Online";
  responsavel: string;
  responsavelBusca: string;
  participanteBusca: string;
  participantes: EntrevistaParticipante[];
  local: string;
  observacao: string;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

type MoveDialogState = {
  item: KanbanCandidaturaItem;
  origem: EtapaMacroCandidatura;
  destino: EtapaMacroCandidatura;
  observacao: string;
  entrevista: InterviewDraft;
  saving: boolean;
};

function toDateInputValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function toTimeInputValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function defaultInterviewDraft(responsavel: string): InterviewDraft {
  const nextHour = new Date();
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  return {
    data: toDateInputValue(nextHour),
    horario: toTimeInputValue(nextHour),
    duracaoMinutos: 60,
    formato: "Online",
    responsavel,
    responsavelBusca: responsavel,
    participanteBusca: "",
    participantes: [],
    local: "Online",
    observacao: "",
  };
}

function shouldScheduleInterview(etapa: EtapaMacroCandidatura) {
  return etapa === "Entrevista" || etapa === "EntrevistaTecnica";
}

type EntrevistaCriadaDialogState = {
  candidatoNome: string;
  etapaLabel: string;
  onlineMeetingJoinUrl: string;
};

function participanteKey(p: EntrevistaParticipante) {
  return p.funcionarioId ?? p.userId ?? `${p.nome}|${p.email ?? ""}`;
}

function optionLabel(option: ResponsavelEntrevistaOption) {
  return option.email ? `${option.nome} <${option.email}>` : option.nome;
}

function participanteLabel(p: EntrevistaParticipante) {
  return p.email ? `${p.nome} <${p.email}>` : p.nome;
}

function toParticipante(option: ResponsavelEntrevistaOption): EntrevistaParticipante {
  const origem = option.origem ?? "funcionario";
  return {
    funcionarioId: origem === "funcionario" ? option.id : null,
    userId: origem === "usuario" ? option.id : null,
    nome: option.nome,
    email: option.email,
    origem,
  };
}

async function fetchParticipantesAgenda(q: string): Promise<ResponsavelEntrevistaOption[]> {
  const params = new URLSearchParams({ pageSize: "30" });
  if (q.trim()) params.set("q", q.trim());
  const res = await apiFetch(`/api/lookup/participantes-agenda?${params.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: Array<{ id?: string; nome?: string; email?: string | null; origem?: string }> };
  return (data.items ?? [])
    .map((item) => ({
      id: String(item.id ?? ""),
      nome: String(item.nome ?? ""),
      email: item.email ?? null,
      origem: item.origem === "usuario" ? "usuario" as const : "funcionario" as const,
    }))
    .filter((item) => item.id && item.nome);
}

export default function CandidaturasKanbanScreen() {
  const router = useRouter();
  const { me } = useAuth();
  const [data, setData] = useState<KanbanCandidaturasResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [vagaId, setVagaId] = useState<string>("");
  const [vagas, setVagas] = useState<KanbanVagaFiltroItem[]>([]);
  const [dragging, setDragging] = useState<KanbanCandidaturaItem | null>(null);
  const [hoverEtapa, setHoverEtapa] = useState<EtapaMacroCandidatura | null>(null);
  const [detailItem, setDetailItem] = useState<KanbanCandidaturaItem | null>(null);
  const [moveDialog, setMoveDialog] = useState<MoveDialogState | null>(null);
  const [lookupOptions, setLookupOptions] = useState<ResponsavelEntrevistaOption[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [responsavelOpen, setResponsavelOpen] = useState(false);
  const [participanteOpen, setParticipanteOpen] = useState(false);
  const [entrevistaCriadaDialog, setEntrevistaCriadaDialog] = useState<EntrevistaCriadaDialogState | null>(null);
  const lookupSearchGen = useRef(0);
  const [proposalRedirect, setProposalRedirect] = useState<KanbanCandidaturaItem | null>(null);
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
        const vs = await getKanbanVagas().catch(() => [] as KanbanVagaFiltroItem[]);
        setVagas(vs);
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    if (!moveDialog || (!responsavelOpen && !participanteOpen)) return;

    const q = responsavelOpen
      ? moveDialog.entrevista.responsavelBusca.trim()
      : moveDialog.entrevista.participanteBusca.trim();

    if (q.length > 0 && q.length < 2) {
      setLookupOptions([]);
      setLookupLoading(false);
      return;
    }

    const timer = window.setTimeout(() => {
      const gen = ++lookupSearchGen.current;
      setLookupLoading(true);
      void fetchParticipantesAgenda(q)
        .then((items) => {
          if (gen !== lookupSearchGen.current) return;
          setLookupOptions(items);
        })
        .catch(() => {
          if (gen !== lookupSearchGen.current) return;
          setLookupOptions([]);
        })
        .finally(() => {
          if (gen !== lookupSearchGen.current) return;
          setLookupLoading(false);
        });
    }, q ? 250 : 0);

    return () => window.clearTimeout(timer);
  }, [
    moveDialog,
    moveDialog?.entrevista.participanteBusca,
    moveDialog?.entrevista.responsavelBusca,
    participanteOpen,
    responsavelOpen,
  ]);

  const filteredResponsaveis = useMemo(() => lookupOptions.slice(0, 30), [lookupOptions]);

  const filteredParticipantes = useMemo(() => {
    const selected = new Set(moveDialog?.entrevista.participantes.map((p) => participanteKey(p)) ?? []);
    return lookupOptions
      .filter((r) => !selected.has(r.id))
      .slice(0, 30);
  }, [lookupOptions, moveDialog?.entrevista.participantes]);

  const columns = useMemo(() => {
    const map = new Map<EtapaMacroCandidatura, KanbanCandidaturaItem[]>();
    for (const e of ETAPAS_KANBAN) map.set(e, []);
    if (data) {
      for (const col of data.colunas) {
        const etapa = resolveEtapa(col.etapa);
        const destino = isEtapaDeclinado(etapa) ? KANBAN_COLUNA_DECLINADO : etapa;
        const bucket = map.get(destino) ?? [];
        bucket.push(...col.itens.map((it) => ({ ...it, etapaMacro: resolveEtapa(it.etapaMacro) })));
        map.set(destino, bucket);
      }
    }
    return map;
  }, [data]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const [k, v] of columns) t[k] = v.length;
    return t;
  }, [columns]);

  const onDropTo = (etapa: EtapaMacroCandidatura) => {
    setHoverEtapa(null);
    const item = dragging;
    setDragging(null);
    if (!item) return;
    const atual = resolveEtapa(item.etapaMacro);
    if (atual === etapa) return;

    setMoveDialog({
      item,
      origem: atual,
      destino: etapa,
      observacao: "",
      entrevista: defaultInterviewDraft(me?.displayName || me?.email || "Analista de RH"),
      saving: false,
    });
  };

  async function confirmMove() {
    if (!moveDialog) return;
    const { item, destino, observacao, entrevista } = moveDialog;
    let entrevistaPayload: AgendarEntrevistaCandidaturaRequest | null = null;

    if (shouldScheduleInterview(destino)) {
      if (!entrevista.data || !entrevista.horario) {
        toast.error("Informe a data e o horário da entrevista.");
        return;
      }
      if (!entrevista.responsavel.trim()) {
        toast.error("Informe o responsável pela entrevista.");
        return;
      }
      const inicioLocal = new Date(`${entrevista.data}T${entrevista.horario}:00`);
      if (Number.isNaN(inicioLocal.getTime())) {
        toast.error("Data ou horário da entrevista inválidos.");
        return;
      }
      entrevistaPayload = {
        inicioUtc: inicioLocal.toISOString(),
        duracaoMinutos: entrevista.duracaoMinutos,
        formato: entrevista.formato,
        responsavel: entrevista.responsavel.trim(),
        participantesOpcionais: entrevista.participantes.map((p) => participanteLabel(p)),
        participantes: entrevista.participantes.map((p) => ({
          funcionarioId: p.funcionarioId ?? null,
          userId: p.userId ?? null,
          nome: p.nome,
          email: p.email ?? null,
          origem: p.origem ?? null,
        })),
        local: entrevista.local.trim() || null,
        observacao: entrevista.observacao.trim() || null,
      };
    }

    setMoveDialog((prev) => prev ? { ...prev, saving: true } : prev);
    try {
      const result = await avancarEtapa(item.id, destino, observacao.trim() || null, entrevistaPayload);
      toast.success(shouldScheduleInterview(destino) ? `Movido para ${ETAPA_LABELS[destino]} e compromisso criado na agenda.` : `Movido para ${ETAPA_LABELS[destino]}.`);
      setMoveDialog(null);
      await load();
      const joinUrl = result.entrevista?.onlineMeetingJoinUrl?.trim();
      if (joinUrl && shouldScheduleInterview(destino)) {
        setEntrevistaCriadaDialog({
          candidatoNome: item.candidatoNome,
          etapaLabel: ETAPA_LABELS[destino],
          onlineMeetingJoinUrl: joinUrl,
        });
      }
      if (destino === "Proposta") {
        setProposalRedirect(item);
      }
    } catch (err) {
      toast.error((err as Error).message ?? "Falha ao mover.");
      setMoveDialog((prev) => prev ? { ...prev, saving: false } : prev);
    }
  }

  return (
    <section className="flex min-h-[calc(100vh-5rem)] flex-col space-y-4 p-4">
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
                  {v.codigo ? ` · ${v.codigo}` : ""}
                  {v.totalCandidaturas > 0 ? ` (${v.totalCandidaturas})` : ""}
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
            {ETAPAS_KANBAN
              .filter((e) => !shouldScheduleInterview(e))
              .map((e) => <option key={e} value={e}>{labelEtapaKanban(e)}</option>)}
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
        <div className="flex min-h-[calc(100vh-14rem)] flex-1 rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
          Carregando…
        </div>
      ) : (
        <div className="flex min-h-[calc(100vh-14rem)] flex-1 gap-3 overflow-x-auto pb-2">
          {ETAPAS_KANBAN.map((etapa) => {
            const style = ETAPA_STYLES[etapa];
            const itens = columns.get(etapa) ?? [];
            const isHover = hoverEtapa === etapa;
            return (
              <div
                key={etapa}
                className={`flex min-h-full w-72 shrink-0 flex-col rounded-lg border bg-white ${style.accent} ${isHover ? "ring-2 ring-sky-400" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setHoverEtapa(etapa); }}
                onDragLeave={() => { if (hoverEtapa === etapa) setHoverEtapa(null); }}
                onDrop={(e) => { e.preventDefault(); void onDropTo(etapa); }}
              >
                <div className={`rounded-t-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide ${style.header}`}>
                  <div className="flex items-center justify-between">
                    <span>{labelEtapaKanban(etapa)}</span>
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
                              <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                <WhatsAppContactButton
                                  size="xs"
                                  celular={it.candidatoCelular}
                                  fone={it.candidatoFone}
                                />
                              </div>
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
                                  matchDialog.open(it.vagaId, it.candidatoId, it.candidatoNome, it.candidatoCelular, it.candidatoFone);
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
          candidatoCelular={matchDialog.target.candidatoCelular}
          candidatoFone={matchDialog.target.candidatoFone}
        />
      )}

      <CandidateKanbanDetailDialog
        open={!!detailItem}
        item={detailItem}
        onClose={() => setDetailItem(null)}
      />

      <Dialog
        open={!!moveDialog}
        onOpenChange={(open) => {
          if (!open && !moveDialog?.saving) setMoveDialog(null);
        }}
      >
        <DialogContent className={moveDialog && shouldScheduleInterview(moveDialog.destino) ? "sm:max-w-2xl" : "sm:max-w-md"}>
          <DialogHeader>
            <DialogTitle>Mover candidato</DialogTitle>
            <DialogDescription>
              Confirme a alteração de etapa e registre uma observação, se necessário.
            </DialogDescription>
          </DialogHeader>

          {moveDialog && (
            <div className="space-y-4">
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{moveDialog.item.candidatoNome}</div>
                  <WhatsAppContactButton
                    size="xs"
                    celular={moveDialog.item.candidatoCelular}
                    fone={moveDialog.item.candidatoFone}
                  />
                </div>
                <div className="mt-1 text-xs">
                  De <strong>{ETAPA_LABELS[moveDialog.origem]}</strong> para{" "}
                  <strong>{ETAPA_LABELS[moveDialog.destino]}</strong>
                </div>
              </div>

              {shouldScheduleInterview(moveDialog.destino) && (
                <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3">
                  <div>
                    <h3 className="text-sm font-semibold text-violet-950">Dados da entrevista</h3>
                    <p className="mt-0.5 text-xs text-violet-800">
                      Estes dados serão gravados como compromisso na agenda.
                    </p>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-medium text-neutral-700">
                      Data desejada
                      <input
                        type="date"
                        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-70"
                        value={moveDialog.entrevista.data}
                        disabled={moveDialog.saving}
                        onChange={(e) => setMoveDialog((prev) => prev ? {
                          ...prev,
                          entrevista: { ...prev.entrevista, data: e.target.value },
                        } : prev)}
                      />
                    </label>

                    <label className="block text-xs font-medium text-neutral-700">
                      Horário
                      <input
                        type="time"
                        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-70"
                        value={moveDialog.entrevista.horario}
                        disabled={moveDialog.saving}
                        onChange={(e) => setMoveDialog((prev) => prev ? {
                          ...prev,
                          entrevista: { ...prev.entrevista, horario: e.target.value },
                        } : prev)}
                      />
                    </label>

                    <label className="block text-xs font-medium text-neutral-700">
                      Tempo da entrevista
                      <select
                        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-70"
                        value={moveDialog.entrevista.duracaoMinutos}
                        disabled={moveDialog.saving}
                        onChange={(e) => setMoveDialog((prev) => prev ? {
                          ...prev,
                          entrevista: { ...prev.entrevista, duracaoMinutos: Number(e.target.value) },
                        } : prev)}
                      >
                        <option value={30}>30 minutos</option>
                        <option value={45}>45 minutos</option>
                        <option value={60}>1 hora</option>
                        <option value={90}>1h30</option>
                        <option value={120}>2 horas</option>
                      </select>
                    </label>

                    <label className="block text-xs font-medium text-neutral-700">
                      Formato
                      <select
                        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-70"
                        value={moveDialog.entrevista.formato}
                        disabled={moveDialog.saving}
                        onChange={(e) => {
                          const formato = e.target.value as "Presencial" | "Online";
                          setMoveDialog((prev) => prev ? {
                            ...prev,
                            entrevista: {
                              ...prev.entrevista,
                              formato,
                              local: formato === "Online" ? "Online" : "",
                            },
                          } : prev);
                        }}
                      >
                        <option value="Online">Online</option>
                        <option value="Presencial">Presencial</option>
                      </select>
                    </label>

                    <div className="relative sm:col-span-2">
                      <label className="block text-xs font-medium text-neutral-700">
                        Responsável pela entrevista
                      </label>
                      <input
                        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-70"
                        value={moveDialog.entrevista.responsavelBusca}
                        disabled={moveDialog.saving}
                        placeholder="Busque pelo nome ou e-mail do responsável"
                        onFocus={() => setResponsavelOpen(true)}
                        onChange={(e) => {
                          const value = e.target.value;
                          setResponsavelOpen(true);
                          setMoveDialog((prev) => prev ? {
                            ...prev,
                            entrevista: { ...prev.entrevista, responsavelBusca: value, responsavel: "" },
                          } : prev);
                        }}
                      />
                      {responsavelOpen && !moveDialog.saving && (
                        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-violet-200 bg-white py-1 text-sm shadow-lg">
                          {lookupLoading ? (
                            <div className="px-3 py-2 text-xs text-neutral-500">Buscando…</div>
                          ) : filteredResponsaveis.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-neutral-500">Nenhum usuário encontrado.</div>
                          ) : (
                            filteredResponsaveis.map((r) => {
                              const label = optionLabel(r);
                              return (
                                <button
                                  key={r.id}
                                  type="button"
                                  className="block w-full px-3 py-2 text-left hover:bg-violet-50"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    setMoveDialog((prev) => prev ? {
                                      ...prev,
                                      entrevista: { ...prev.entrevista, responsavel: label, responsavelBusca: label },
                                    } : prev);
                                    setResponsavelOpen(false);
                                  }}
                                >
                                  <span className="block font-medium text-neutral-900">{r.nome}</span>
                                  {r.email && <span className="block text-xs text-neutral-500">{r.email}</span>}
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>

                    <div className="relative sm:col-span-2">
                      <label className="block text-xs font-medium text-neutral-700">
                        Participantes opcionais
                      </label>
                      <div className="mt-1 flex gap-2">
                        <input
                          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-70"
                          value={moveDialog.entrevista.participanteBusca}
                          disabled={moveDialog.saving}
                          placeholder="Busque e adicione gestor, técnico ou convidado"
                          onFocus={() => setParticipanteOpen(true)}
                          onChange={(e) => {
                            const value = e.target.value;
                            setParticipanteOpen(true);
                            setMoveDialog((prev) => prev ? {
                              ...prev,
                              entrevista: { ...prev.entrevista, participanteBusca: value },
                            } : prev);
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={moveDialog.saving || !moveDialog.entrevista.participanteBusca.trim()}
                          onClick={() => {
                            const value = moveDialog.entrevista.participanteBusca.trim();
                            if (!value) return;
                            const match = lookupOptions.find((r) => optionLabel(r).toLowerCase() === value.toLowerCase() || r.nome.toLowerCase() === value.toLowerCase());
                            const participante = match ? toParticipante(match) : { nome: value, email: null };
                            const key = participanteKey(participante);
                            setMoveDialog((prev) => prev ? {
                              ...prev,
                              entrevista: {
                                ...prev.entrevista,
                                participanteBusca: "",
                                participantes: prev.entrevista.participantes.some((p) => participanteKey(p) === key)
                                  ? prev.entrevista.participantes
                                  : [...prev.entrevista.participantes, participante],
                              },
                            } : prev);
                            setParticipanteOpen(false);
                          }}
                        >
                          Adicionar
                        </Button>
                      </div>
                      {participanteOpen && !moveDialog.saving && (
                        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-violet-200 bg-white py-1 text-sm shadow-lg">
                          {lookupLoading ? (
                            <div className="px-3 py-2 text-xs text-neutral-500">Buscando…</div>
                          ) : filteredParticipantes.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-neutral-500">Nenhum usuário encontrado.</div>
                          ) : (
                            filteredParticipantes.map((r) => {
                              const label = optionLabel(r);
                              return (
                                <button
                                  key={r.id}
                                  type="button"
                                  className="block w-full px-3 py-2 text-left hover:bg-violet-50"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    const participante = toParticipante(r);
                                    setMoveDialog((prev) => prev ? {
                                      ...prev,
                                      entrevista: {
                                        ...prev.entrevista,
                                        participanteBusca: "",
                                        participantes: [...prev.entrevista.participantes, participante],
                                      },
                                    } : prev);
                                    setParticipanteOpen(false);
                                  }}
                                >
                                  <span className="block font-medium text-neutral-900">{r.nome}</span>
                                  {r.email && <span className="block text-xs text-neutral-500">{r.email}</span>}
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                      {moveDialog.entrevista.participantes.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {moveDialog.entrevista.participantes.map((participante) => (
                            <span
                              key={participanteKey(participante)}
                              className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-white px-2 py-1 text-xs text-violet-900"
                            >
                              {participanteLabel(participante)}
                              <button
                                type="button"
                                className="font-semibold text-violet-500 hover:text-violet-800"
                                disabled={moveDialog.saving}
                                onClick={() => setMoveDialog((prev) => prev ? {
                                  ...prev,
                                  entrevista: {
                                    ...prev.entrevista,
                                    participantes: prev.entrevista.participantes.filter((p) => participanteKey(p) !== participanteKey(participante)),
                                  },
                                } : prev)}
                              >
                                x
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <label className="block text-xs font-medium text-neutral-700 sm:col-span-2">
                      Local ou link da entrevista
                      <input
                        className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-70"
                        value={moveDialog.entrevista.local}
                        disabled={moveDialog.saving}
                        placeholder={moveDialog.entrevista.formato === "Online" ? "Ex.: Teams, Google Meet ou link" : "Ex.: Sala, unidade ou endereço"}
                        onChange={(e) => setMoveDialog((prev) => prev ? {
                          ...prev,
                          entrevista: { ...prev.entrevista, local: e.target.value },
                        } : prev)}
                      />
                    </label>

                    <label className="block text-xs font-medium text-neutral-700 sm:col-span-2">
                      Observações da entrevista
                      <textarea
                        className="mt-1 min-h-[72px] w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-70"
                        value={moveDialog.entrevista.observacao}
                        disabled={moveDialog.saving}
                        placeholder="Ex.: entrevista técnica com gestor, levar portfólio, link será enviado posteriormente..."
                        onChange={(e) => setMoveDialog((prev) => prev ? {
                          ...prev,
                          entrevista: { ...prev.entrevista, observacao: e.target.value },
                        } : prev)}
                      />
                    </label>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-neutral-600">
                  Observação opcional
                </label>
                <textarea
                  className="min-h-[96px] w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-70"
                  placeholder="Ex.: candidato validado em triagem, aguardando entrevista..."
                  value={moveDialog.observacao}
                  disabled={moveDialog.saving}
                  onChange={(e) => setMoveDialog((prev) => prev ? { ...prev, observacao: e.target.value } : prev)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMoveDialog(null)}
              disabled={moveDialog?.saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void confirmMove()}
              disabled={!moveDialog || moveDialog.saving}
            >
              {moveDialog?.saving ? "Movendo..." : "Confirmar movimentação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!proposalRedirect}
        onOpenChange={(open) => {
          if (!open) setProposalRedirect(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar proposta para o candidato?</DialogTitle>
            <DialogDescription>
              A candidatura foi movida para Envio da Proposta. Deseja abrir a criação da proposta agora para enviar ao candidato?
            </DialogDescription>
          </DialogHeader>

          {proposalRedirect && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <div className="font-medium">{proposalRedirect.candidatoNome}</div>
              <div className="mt-1 text-xs">
                {proposalRedirect.vagaTitulo ?? proposalRedirect.vagaId.slice(0, 8)}
                {proposalRedirect.vagaCodigo ? ` · ${proposalRedirect.vagaCodigo}` : ""}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setProposalRedirect(null)}>
              Agora não
            </Button>
            <Button
              onClick={() => {
                if (!proposalRedirect) return;
                const params = new URLSearchParams({
                  new: "1",
                  vagaId: proposalRedirect.vagaId,
                  candidatoId: proposalRedirect.candidatoId,
                });
                router.push(`/recrutamento/propostas-vaga?${params.toString()}`);
              }}
            >
              Criar proposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!entrevistaCriadaDialog}
        onOpenChange={(open) => {
          if (!open) setEntrevistaCriadaDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Entrevista agendada</DialogTitle>
            <DialogDescription>
              Compromisso criado na agenda{entrevistaCriadaDialog ? ` — ${entrevistaCriadaDialog.etapaLabel}` : ""}.
            </DialogDescription>
          </DialogHeader>

          {entrevistaCriadaDialog && (
            <div className="space-y-3">
              <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">
                <div className="font-medium">{entrevistaCriadaDialog.candidatoNome}</div>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">Link de ingresso Teams</div>
                <a
                  href={entrevistaCriadaDialog.onlineMeetingJoinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block break-all text-sm text-violet-700 underline"
                >
                  {entrevistaCriadaDialog.onlineMeetingJoinUrl}
                </a>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (!entrevistaCriadaDialog) return;
                void navigator.clipboard.writeText(entrevistaCriadaDialog.onlineMeetingJoinUrl)
                  .then(() => toast.success("Link copiado."))
                  .catch(() => toast.error("Não foi possível copiar o link."));
              }}
            >
              Copiar link
            </Button>
            {entrevistaCriadaDialog ? (
              <Button asChild>
                <a href={entrevistaCriadaDialog.onlineMeetingJoinUrl} target="_blank" rel="noopener noreferrer">
                  Entrar na reunião
                </a>
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
