"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
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
import { SolicitacaoDependenteFormModal } from "./SolicitacaoDependenteFormModal";

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: "Rascunho", color: "bg-zinc-400/15 text-zinc-600" },
  1: { label: "Pendente", color: "bg-amber-500/15 text-amber-700" },
  2: { label: "Aprovada", color: "bg-emerald-500/15 text-emerald-700" },
  3: { label: "Reprovada", color: "bg-red-500/15 text-red-700" },
  4: { label: "Ajustes", color: "bg-orange-500/15 text-orange-700" },
};

const TIPO_SOLICITACAO_MAP: Record<number, string> = {
  0: "Inclusão",
  1: "Alteração",
  2: "Exclusão",
};

const PARENTESCO_MAP: Record<number, string> = {
  0: "Cônjuge",
  1: "Filho(a)",
  2: "Pai",
  3: "Mãe",
  4: "Outro",
};

interface SolicitacaoDependenteGridRow {
  id: string;
  status: number;
  solicitanteNome: string | null;
  tipoSolicitacao: number;
  nomeCompleto: string;
  parentesco: number;
  createdAtUtc: string;
}

interface SolicitacaoDependenteDetail {
  id: string;
  status: number;
  solicitanteNome: string | null;
  tipoSolicitacao: number;
  dependenteId: string | null;
  nomeCompleto: string;
  parentesco: number;
  cpf: string | null;
  dataNascimento: string;
  isPcd: boolean;
  dependenteIR: boolean;
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
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR");
}

function StatusBadge({ status }: { status: number }) {
  const s = STATUS_MAP[status] ?? { label: String(status), color: "bg-zinc-400/15 text-zinc-600" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.color}`}>
      {s.label}
    </span>
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

export default function SolicitacaoDependentesScreen() {
  useAuth();

  const [rows, setRows] = useState<SolicitacaoDependenteGridRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<SolicitacaoDependenteDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson<SolicitacaoDependenteGridRow[]>(
        "/api/colaborador/solicitacoes-dependente"
      );
      setRows(data ?? []);
    } catch (err) {
      toast.error("Erro ao carregar solicitações de dependentes.");
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
      const data = await fetchJson<SolicitacaoDependenteDetail>(
        `/api/colaborador/solicitacoes-dependente/${id}`
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
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Solicitações de Dependentes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Solicite inclusão, alteração ou exclusão de dependentes
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>Nova Solicitação</Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Dependente</TableHead>
              <TableHead>Parentesco</TableHead>
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
                  <TableCell>{TIPO_SOLICITACAO_MAP[row.tipoSolicitacao] ?? "—"}</TableCell>
                  <TableCell className="font-medium">{row.nomeCompleto}</TableCell>
                  <TableCell>{PARENTESCO_MAP[row.parentesco] ?? "—"}</TableCell>
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
      <SolicitacaoDependenteFormModal
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
              Informações completas sobre a solicitação de dependente.
            </DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <div className="py-10 text-center text-muted-foreground text-sm">
              {detailLoading ? "Carregando..." : "Sem dados."}
            </div>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <span className="text-muted-foreground">Tipo:</span>{" "}
                  <span className="font-medium">
                    {TIPO_SOLICITACAO_MAP[detail.tipoSolicitacao] ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <StatusBadge status={detail.status} />
                </div>
                <div>
                  <span className="text-muted-foreground">Nome:</span>{" "}
                  <span className="font-medium">{detail.nomeCompleto}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Parentesco:</span>{" "}
                  <span className="font-medium">
                    {PARENTESCO_MAP[detail.parentesco] ?? "—"}
                  </span>
                </div>
                {detail.cpf && (
                  <div>
                    <span className="text-muted-foreground">CPF:</span>{" "}
                    <span className="font-medium">{detail.cpf}</span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Nascimento:</span>{" "}
                  <span className="font-medium">{formatDate(detail.dataNascimento)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">PcD:</span>{" "}
                  <span className="font-medium">{detail.isPcd ? "Sim" : "Não"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Dependente IR:</span>{" "}
                  <span className="font-medium">{detail.dependenteIR ? "Sim" : "Não"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Solicitado em:</span>{" "}
                  <span className="font-medium">{formatDate(detail.createdAtUtc)}</span>
                </div>
                {detail.approvedAtUtc && (
                  <div>
                    <span className="text-muted-foreground">Aprovado em:</span>{" "}
                    <span className="font-medium">{formatDate(detail.approvedAtUtc)}</span>
                  </div>
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
    </div>
  );
}
