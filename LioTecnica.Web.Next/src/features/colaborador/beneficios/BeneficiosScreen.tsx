"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Eye } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import BeneficioFormModal from "./BeneficioFormModal";

const API = "/api/colaborador/solicitacoes-beneficio";

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: "Rascunho",  color: "bg-zinc-400/15 text-zinc-600" },
  1: { label: "Pendente",  color: "bg-amber-500/15 text-amber-700" },
  2: { label: "Aprovada",  color: "bg-emerald-500/15 text-emerald-700" },
  3: { label: "Reprovada", color: "bg-red-500/15 text-red-700" },
  4: { label: "Ajustes",   color: "bg-orange-500/15 text-orange-700" },
};

const TIPO_BENEFICIO_MAP: Record<number, string> = {
  0: "Vale Refeição",
  1: "Vale Alimentação",
  2: "Plano de Saúde",
  3: "Plano Odontológico",
  4: "Vale Transporte",
  5: "Seguro de Vida",
  6: "Aux. Creche",
  7: "Gympass",
  8: "Outro",
};

const TIPO_ALTERACAO_MAP: Record<number, string> = {
  0: "Inclusão",
  1: "Exclusão",
  2: "Alteração de Plano",
};

interface BeneficioGrid {
  id: string;
  status: number;
  solicitanteNome: string | null;
  tipoBeneficio: number;
  tipoAlteracao: number;
  createdAtUtc: string;
}

interface BeneficioDetail {
  id: string;
  status: number;
  solicitanteNome: string | null;
  tipoBeneficio: number;
  tipoAlteracao: number;
  descricao: string;
  incluirDependentes: boolean;
  dependenteIdsJson: string | null;
  aprovador1Id: string | null;
  aprovador1Nome: string | null;
  aprovador1Status: number;
  aprovador2Id: string | null;
  aprovador2Nome: string | null;
  observacaoAprovador: string | null;
  observacoes: string | null;
  createdAtUtc: string;
  approvedAtUtc: string | null;
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

function AprovadorRow({
  label,
  nome,
  status,
}: {
  label: string;
  nome: string | null;
  status: number | null;
}) {
  const s = status !== null ? STATUS_MAP[status] : null;
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="flex items-center justify-between text-sm">
        <span>{nome || "—"}</span>
        {s ? (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>
            {s.label}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Aguardando</span>
        )}
      </div>
    </div>
  );
}

export default function BeneficiosScreen() {
  const { me } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<BeneficioGrid[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [detail, setDetail] = useState<BeneficioDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchJson<BeneficioGrid[]>(API);
    setItems(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => toast.error("Falha ao carregar solicitações de benefício."))
      .finally(() => setLoading(false));
  }, [load]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const data = await fetchJson<BeneficioDetail>(`${API}/${id}`);
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
          <h4 className="text-lg font-bold">Meus Benefícios</h4>
          <div className="text-muted-foreground text-sm">Solicite alterações em seus benefícios</div>
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
            <Plus className="size-4" /> Nova Solicitação
          </Button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Benefício</TableHead>
              <TableHead>Alteração</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nenhuma solicitação encontrada.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-sm">
                    {TIPO_BENEFICIO_MAP[item.tipoBeneficio] ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {TIPO_ALTERACAO_MAP[item.tipoAlteracao] ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
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
        <BeneficioFormModal
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
              Informações completas sobre a solicitação de benefício.
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

              {/* Benefício / Alteração */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/40 bg-muted/30 p-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Benefício</div>
                  <div className="font-medium">
                    {TIPO_BENEFICIO_MAP[detail.tipoBeneficio] ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Tipo de Alteração</div>
                  <div className="font-medium">
                    {TIPO_ALTERACAO_MAP[detail.tipoAlteracao] ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Solicitado em</div>
                  <div className="font-medium">{formatDateTime(detail.createdAtUtc)}</div>
                </div>
                {detail.approvedAtUtc && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Aprovado em</div>
                    <div className="font-medium">{formatDateTime(detail.approvedAtUtc)}</div>
                  </div>
                )}
              </div>

              {/* Descrição */}
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Descrição</div>
                <div className="rounded-md border border-border/40 bg-muted/30 px-3 py-2">
                  {detail.descricao || "—"}
                </div>
              </div>

              {/* Dependentes */}
              <div className="flex items-center gap-2">
                <div className="text-xs text-muted-foreground">Inclui Dependentes:</div>
                <span className="font-medium text-sm">{detail.incluirDependentes ? "Sim" : "Não"}</span>
              </div>

              {/* Aprovadores */}
              {(detail.aprovador1Id || detail.aprovador2Id) && (
                <div className="space-y-2 rounded-lg border border-border/40 bg-muted/30 p-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Aprovadores</div>
                  {detail.aprovador1Id && (
                    <AprovadorRow
                      label="1º Aprovador"
                      nome={detail.aprovador1Nome}
                      status={detail.aprovador1Status}
                    />
                  )}
                  {detail.aprovador2Id && (
                    <AprovadorRow
                      label="2º Aprovador"
                      nome={detail.aprovador2Nome}
                      status={null}
                    />
                  )}
                </div>
              )}

              {/* Observação do aprovador */}
              {detail.observacaoAprovador && (
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Observação do Aprovador</div>
                  <div className="rounded-md border border-border/40 bg-muted/30 px-3 py-2">
                    {detail.observacaoAprovador}
                  </div>
                </div>
              )}

              {/* Observações do solicitante */}
              {detail.observacoes && (
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Suas Observações</div>
                  <div className="rounded-md border border-border/40 bg-muted/30 px-3 py-2">
                    {detail.observacoes}
                  </div>
                </div>
              )}

              {/* Admin: nome do solicitante */}
              {isAdmin && detail.solicitanteNome && (
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Solicitante</div>
                  <div className="font-medium">{detail.solicitanteNome}</div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
