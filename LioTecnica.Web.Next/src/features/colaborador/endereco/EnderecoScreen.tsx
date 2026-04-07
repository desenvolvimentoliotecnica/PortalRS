"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
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
import { EnderecoFormModal } from "./EnderecoFormModal";

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: "Rascunho", color: "bg-zinc-400/15 text-zinc-600" },
  1: { label: "Pendente", color: "bg-amber-500/15 text-amber-700" },
  2: { label: "Aprovada", color: "bg-emerald-500/15 text-emerald-700" },
  3: { label: "Reprovada", color: "bg-red-500/15 text-red-700" },
  4: { label: "Ajustes", color: "bg-orange-500/15 text-orange-700" },
};

interface SolicitacaoEnderecoGridRow {
  id: string;
  status: number;
  solicitanteNome: string | null;
  cep: string;
  cidade: string;
  uf: string;
  createdAtUtc: string;
}

interface SolicitacaoEnderecoDetail {
  id: string;
  status: number;
  solicitanteNome: string | null;
  cep: string;
  logradouro: string;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  cidade: string;
  uf: string;
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

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function StatusBadge({ status }: { status: number }) {
  const s = STATUS_MAP[status] ?? { label: String(status), color: "bg-zinc-400/15 text-zinc-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span>{" "}
      <span className="font-medium">{value ?? "—"}</span>
    </div>
  );
}

function AprovadorRow({
  label,
  nome,
  status,
  habilitado,
}: {
  label: string;
  nome: string | null;
  status: number | null;
  habilitado: boolean;
}) {
  if (!habilitado) return null;
  const s = status !== null ? STATUS_MAP[status] : null;
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{nome ?? "—"}</span>
      {s && (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}>
          {s.label}
        </span>
      )}
    </div>
  );
}

export default function EnderecoScreen() {
  useAuth();

  const [rows, setRows] = useState<SolicitacaoEnderecoGridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<SolicitacaoEnderecoDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson<SolicitacaoEnderecoGridRow[]>(
        "/api/colaborador/solicitacoes-endereco"
      );
      setRows(data ?? []);
    } catch (err) {
      toast.error("Erro ao carregar solicitações de endereço.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setDetailOpen(true);
    setDetail(null);
    try {
      const data = await fetchJson<SolicitacaoEnderecoDetail>(
        `/api/colaborador/solicitacoes-endereco/${id}`
      );
      setDetail(data);
    } catch (err) {
      toast.error("Erro ao carregar detalhes da solicitação.");
      console.error(err);
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  function handleFormSuccess() {
    setFormOpen(false);
    loadRows();
    toast.success("Solicitação enviada com sucesso!");
  }

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Alteração de Endereço</h4>
          <div className="text-muted-foreground text-sm">Solicite a atualização do seu endereço cadastral</div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => loadRows()}>
            <RefreshCw className="size-4" />
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>Solicitar Alteração</Button>
        </div>
      </div>

      {/* Table */}
      <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>CEP</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>UF</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  Nenhuma solicitação encontrada.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-sm">{row.cep}</TableCell>
                  <TableCell>{row.cidade}</TableCell>
                  <TableCell>{row.uf}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(row.createdAtUtc)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => openDetail(row.id)}>
                      Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Form Modal */}
      <EnderecoFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={handleFormSuccess}
      />

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da Solicitação</DialogTitle>
            <DialogDescription>
              Informações completas sobre a solicitação de alteração de endereço.
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              {detailLoading ? "Carregando..." : "Sem dados."}
            </div>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              {/* Status */}
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                <StatusBadge status={detail.status} />
              </div>

              {/* Endereço */}
              <div className="border rounded-md p-3 flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Endereço
                </p>
                <DetailRow label="CEP" value={<span className="font-mono">{detail.cep}</span>} />
                <DetailRow
                  label="Logradouro"
                  value={`${detail.logradouro}${detail.numero ? `, ${detail.numero}` : ""}`}
                />
                {detail.complemento && (
                  <DetailRow label="Complemento" value={detail.complemento} />
                )}
                {detail.bairro && <DetailRow label="Bairro" value={detail.bairro} />}
                <DetailRow label="Cidade / UF" value={`${detail.cidade} / ${detail.uf}`} />
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-x-4">
                <DetailRow label="Solicitado em" value={formatDate(detail.createdAtUtc)} />
                {detail.approvedAtUtc && (
                  <DetailRow label="Aprovado em" value={formatDate(detail.approvedAtUtc)} />
                )}
              </div>

              {/* Aprovadores */}
              <div className="border-t pt-3 flex flex-col gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Aprovadores
                </p>
                <AprovadorRow
                  label="Aprovador 1"
                  nome={detail.aprovador1Nome}
                  status={detail.aprovador1Status}
                  habilitado={true}
                />
                <AprovadorRow
                  label="Aprovador 2"
                  nome={detail.aprovador2Nome}
                  status={detail.aprovador2Status}
                  habilitado={detail.aprovador2Habilitado}
                />
              </div>

              {detail.observacaoAprovador && (
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Observação do Aprovador
                  </p>
                  <p className="text-sm bg-muted/50 rounded p-2">{detail.observacaoAprovador}</p>
                </div>
              )}

              {detail.observacoes && (
                <div className="border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Observações
                  </p>
                  <p className="text-sm bg-muted/50 rounded p-2">{detail.observacoes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
