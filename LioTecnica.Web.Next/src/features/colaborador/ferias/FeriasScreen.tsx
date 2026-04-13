"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Eye } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import FeriasFormModal from "./FeriasFormModal";
import { mapEtapasToSteps, type EtapaAprovacaoResponse } from "@/features/gestao/shared/etapaUtils";
import AcompanhamentoModal from "@/features/gestao/shared/AcompanhamentoModal";

const API = "/api/colaborador/solicitacoes-ferias";

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: "Rascunho",   color: "bg-zinc-400/15 text-zinc-600" },
  1: { label: "Pendente",   color: "bg-amber-500/15 text-amber-700" },
  2: { label: "Aprovada",   color: "bg-emerald-500/15 text-emerald-700" },
  3: { label: "Reprovada",  color: "bg-red-500/15 text-red-700" },
  4: { label: "Ajustes",    color: "bg-orange-500/15 text-orange-700" },
  5: { label: "Cancelada",  color: "bg-zinc-500/15 text-zinc-500" },
  6: { label: "Aguarda RH", color: "bg-purple-500/15 text-purple-700" },
};

interface FeriasGrid {
  id: string;
  status: number;
  solicitanteNome: string | null;
  dataInicio: string;
  dataFim: string;
  qtdDias: number;
  abonoPecuniario: boolean;
  createdAtUtc: string;
  etapaPendenteLabel: string | null;
  etapaPendenteCom: string | null;
}

interface FeriasDetail {
  id: string;
  status: number;
  solicitanteNome: string | null;
  periodoAquisitivo: string | null;
  dataInicio: string;
  dataFim: string;
  qtdDias: number;
  abonoPecuniario: boolean;
  diasAbono: number;
  adiantamento13: boolean;
  aprovador1Id: string | null;
  aprovador1Nome: string | null;
  aprovador1Status: number;
  aprovador2Id: string | null;
  aprovador2Nome: string | null;
  aprovador2Status: number | null;
  aprovador2Habilitado: boolean;
  observacaoAprovador: string | null;
  observacoes: string | null;
  createdAtUtc: string;
  approvedAtUtc: string | null;
  etapas?: EtapaAprovacaoResponse[];
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function formatDate(iso: string) {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

function StatusBadge({ status }: { status: number }) {
  const s = STATUS_MAP[status] ?? { label: String(status), color: "bg-zinc-400/15 text-zinc-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

function AprovadorRow({ nome, status, habilitado }: { nome: string | null; status: number | null; habilitado: boolean }) {
  if (!habilitado) return null;
  const s = status !== null ? STATUS_MAP[status] : null;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{nome || "—"}</span>
      {s ? (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>{s.label}</span>
      ) : (
        <span className="text-xs text-muted-foreground">Aguardando</span>
      )}
    </div>
  );
}

export default function FeriasScreen() {
  const { me } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<FeriasGrid[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<FeriasDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [timelineStatus, setTimelineStatus] = useState<number | string | null>(null);

  const load = useCallback(async () => {
    const data = await fetchJson<FeriasGrid[]>(API);
    setItems(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => toast.error("Falha ao carregar solicitações de férias."))
      .finally(() => setLoading(false));
  }, [load]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const data = await fetchJson<FeriasDetail>(`${API}/${id}`);
      setDetail(data);
    } catch {
      toast.error("Falha ao carregar detalhes.");
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  function handleFormSuccess() {
    setFormOpen(false);
    setLoading(true);
    load()
      .catch(() => toast.error("Falha ao recarregar."))
      .finally(() => setLoading(false));
  }

  const isAdmin = me?.isAdmin ?? false;

  return (
    <section className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Minhas Férias</h4>
          <div className="text-muted-foreground text-sm">Solicite e acompanhe suas férias</div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setLoading(true); load().finally(() => setLoading(false)); }}
          >
            <RefreshCw className="size-4" />
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" /> Solicitar Férias
          </Button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Fim</TableHead>
              <TableHead className="text-center">Dias</TableHead>
              <TableHead className="text-center">Abono Pecuniário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aguardando</TableHead>
              <TableHead>Data Solicitação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Nenhuma solicitação encontrada.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(item.dataInicio)} – {formatDate(item.dataFim)}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(item.dataInicio)}</TableCell>
                  <TableCell className="text-sm">{formatDate(item.dataFim)}</TableCell>
                  <TableCell className="text-center text-sm font-medium">{item.qtdDias}</TableCell>
                  <TableCell className="text-center text-sm">
                    {item.abonoPecuniario ? (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-500/15 text-blue-700">Sim</span>
                    ) : (
                      <span className="text-muted-foreground">Não</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>
                    {(item.status === 1 || item.status === 6) && item.etapaPendenteCom ? (
                      <div className="text-xs leading-tight">
                        <div className="text-muted-foreground">{item.etapaPendenteLabel}</div>
                        <div className="font-medium truncate max-w-[120px]" title={item.etapaPendenteCom}>{item.etapaPendenteCom}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(item.createdAtUtc)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="icon-xs"
                      title="Ver detalhes"
                      onClick={() => void openDetail(item.id)}
                    >
                      <Eye />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── New Request Modal ── */}
      {formOpen && (
        <FeriasFormModal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* ── Detail Dialog ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Solicitação</DialogTitle>
            <DialogDescription>
              Informações completas sobre a solicitação de férias.
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-t-transparent border-primary" />
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">Status</span>
                <StatusBadge status={detail.status} />
              </div>

              {/* Period / Dates */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/40 bg-muted/30 p-3">
                {detail.periodoAquisitivo && (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground mb-0.5">Período Aquisitivo</div>
                    <div className="font-medium">{detail.periodoAquisitivo}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Início</div>
                  <div className="font-medium">{formatDate(detail.dataInicio)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Fim</div>
                  <div className="font-medium">{formatDate(detail.dataFim)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Dias de Férias</div>
                  <div className="font-medium">{detail.qtdDias} dias</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Solicitado em</div>
                  <div className="font-medium">{formatDateTime(detail.createdAtUtc)}</div>
                </div>
                {detail.approvedAtUtc && (
                  <div className="col-span-2">
                    <div className="text-xs text-muted-foreground mb-0.5">Aprovado em</div>
                    <div className="font-medium">{formatDateTime(detail.approvedAtUtc)}</div>
                  </div>
                )}
              </div>

              {/* Extras */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Abono Pecuniário</div>
                  <div className="font-medium">
                    {detail.abonoPecuniario ? `Sim — ${detail.diasAbono} dias` : "Não"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Antecipação 13º</div>
                  <div className="font-medium">{detail.adiantamento13 ? "Sim" : "Não"}</div>
                </div>
              </div>

              {/* Cadeia de aprovação */}
              {(detail.etapas && detail.etapas.length > 0) ? (
                <div className="space-y-1 rounded-lg border border-border/40 bg-muted/30 p-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">Cadeia de Aprovação</div>
                  {detail.etapas.map((e) => {
                    const statusLabel = e.status.toLowerCase() === "aprovado"
                      ? "Aprovado" : e.status.toLowerCase() === "reprovado"
                      ? "Reprovado" : "Aguardando";
                    const statusColor = e.status.toLowerCase() === "aprovado"
                      ? "bg-emerald-500/15 text-emerald-700"
                      : e.status.toLowerCase() === "reprovado"
                      ? "bg-red-500/15 text-red-700"
                      : "bg-amber-500/15 text-amber-700";
                    return (
                      <div key={e.ordem} className="flex items-center justify-between text-sm py-1">
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-muted-foreground leading-tight">{e.label}</span>
                          <span className="font-medium truncate">{e.aprovadorNome ?? e.roleFilaNome ?? "—"}</span>
                        </div>
                        <span className={`shrink-0 ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (detail.aprovador1Id || detail.aprovador2Habilitado) ? (
                <div className="space-y-2 rounded-lg border border-border/40 bg-muted/30 p-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Aprovadores</div>
                  {detail.aprovador1Id && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">1º Aprovador</div>
                      <AprovadorRow
                        nome={detail.aprovador1Nome}
                        status={detail.aprovador1Status}
                        habilitado
                      />
                    </div>
                  )}
                  {detail.aprovador2Habilitado && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-0.5">2º Aprovador</div>
                      <AprovadorRow
                        nome={detail.aprovador2Nome}
                        status={detail.aprovador2Status}
                        habilitado={detail.aprovador2Habilitado}
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {/* Observação do aprovador */}
              {detail.observacaoAprovador && (
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Observação do Aprovador</div>
                  <div className="rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-sm">
                    {detail.observacaoAprovador}
                  </div>
                </div>
              )}

              {/* Observações do solicitante */}
              {detail.observacoes && (
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Suas Observações</div>
                  <div className="rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-sm">
                    {detail.observacoes}
                  </div>
                </div>
              )}

              {/* Admin info */}
              {isAdmin && detail.solicitanteNome && (
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Solicitante</div>
                  <div className="font-medium">{detail.solicitanteNome}</div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {detail?.etapas && detail.etapas.length > 0 && (
              <Button variant="outline" onClick={() => { setTimelineStatus(detail?.status ?? null); setTimelineOpen(true); }}>
                Acompanhamento
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Timeline Modal ── */}
      {detail && (
        <AcompanhamentoModal
          open={timelineOpen}
          steps={mapEtapasToSteps(detail.etapas ?? [], detail.solicitanteNome, detail.createdAtUtc)}
          solicitacaoStatus={timelineStatus}
          onClose={() => setTimelineOpen(false)}
        />
      )}
    </section>
  );
}
