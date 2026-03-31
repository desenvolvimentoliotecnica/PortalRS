"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const TIPO_SOLICITACAO_OPTIONS = [
  { value: 0, label: "Inclusão" },
  { value: 1, label: "Alteração" },
  { value: 2, label: "Exclusão" },
];

const PARENTESCO_OPTIONS = [
  { value: 0, label: "Cônjuge" },
  { value: 1, label: "Filho(a)" },
  { value: 2, label: "Pai" },
  { value: 3, label: "Mãe" },
  { value: 4, label: "Outro" },
];

interface DependenteOption {
  id: string;
  nomeCompleto: string;
}

interface FormDraft {
  tipoSolicitacao: number;
  dependenteId: string;
  nomeCompleto: string;
  parentesco: number;
  cpf: string;
  dataNascimento: string;
  isPcd: boolean;
  dependenteIR: boolean;
  observacoes: string;
}

const EMPTY_DRAFT: FormDraft = {
  tipoSolicitacao: 0,
  dependenteId: "",
  nomeCompleto: "",
  parentesco: 0,
  cpf: "",
  dataNascimento: "",
  isPcd: false,
  dependenteIR: false,
  observacoes: "",
};

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

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SolicitacaoDependenteFormModal({ open, onClose, onSuccess }: Props) {
  const [draft, setDraft] = useState<FormDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [dependentes, setDependentes] = useState<DependenteOption[]>([]);
  const [dependentesLoading, setDependentesLoading] = useState(false);

  const tipoSolicitacao = draft.tipoSolicitacao;
  const isExclusao = tipoSolicitacao === 2;
  const needsDependentePicker = tipoSolicitacao === 1 || tipoSolicitacao === 2;
  const showPersonalFields = !isExclusao;

  useEffect(() => {
    if (!open) return;
    setDraft(EMPTY_DRAFT);
  }, [open]);

  useEffect(() => {
    if (!open || !needsDependentePicker) return;
    setDependentesLoading(true);
    fetchJson<DependenteOption[]>("/api/colaborador/dependentes")
      .then((data) => setDependentes(data ?? []))
      .catch(() => toast.warning("Não foi possível carregar os dependentes."))
      .finally(() => setDependentesLoading(false));
  }, [open, needsDependentePicker]);

  function setField<K extends keyof FormDraft>(key: K, value: FormDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (isExclusao && !draft.dependenteId) {
      toast.error("Selecione o dependente a ser excluído.");
      return;
    }
    if (!isExclusao && !draft.nomeCompleto.trim()) {
      toast.error("Informe o nome completo do dependente.");
      return;
    }
    if (!isExclusao && !draft.dataNascimento) {
      toast.error("Informe a data de nascimento.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        tipoSolicitacao: draft.tipoSolicitacao,
        observacoes: draft.observacoes || null,
      };

      if (needsDependentePicker) {
        payload.dependenteId = draft.dependenteId || null;
      }

      if (!isExclusao) {
        payload.nomeCompleto = draft.nomeCompleto;
        payload.parentesco = draft.parentesco;
        payload.cpf = draft.cpf || null;
        payload.dataNascimento = draft.dataNascimento;
        payload.isPcd = draft.isPcd;
        payload.dependenteIR = draft.dependenteIR;
      }

      await fetchJson<unknown>("/api/colaborador/solicitacoes-dependente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      onSuccess();
    } catch (err) {
      toast.error("Erro ao enviar solicitação. Tente novamente.");
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Solicitação de Dependente</DialogTitle>
          <DialogDescription>
            Preencha os dados para solicitar inclusão, alteração ou exclusão de um dependente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Tipo de Solicitação */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Tipo de Solicitação</label>
            <select
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={draft.tipoSolicitacao}
              onChange={(e) => setField("tipoSolicitacao", Number(e.target.value))}
              disabled={submitting}
            >
              {TIPO_SOLICITACAO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Dependente Picker (Alteração / Exclusão) */}
          {needsDependentePicker && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                {isExclusao ? "Dependente a excluir" : "Dependente a alterar"}
              </label>
              <select
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={draft.dependenteId}
                onChange={(e) => setField("dependenteId", e.target.value)}
                disabled={submitting || dependentesLoading}
              >
                <option value="">
                  {dependentesLoading ? "Carregando..." : "Selecione um dependente"}
                </option>
                {dependentes.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nomeCompleto}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Personal Fields (Inclusão / Alteração) */}
          {showPersonalFields && (
            <>
              {/* Nome Completo */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Nome Completo <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="Nome completo do dependente"
                  value={draft.nomeCompleto}
                  onChange={(e) => setField("nomeCompleto", e.target.value)}
                  disabled={submitting}
                />
              </div>

              {/* Parentesco */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Parentesco</label>
                <select
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={draft.parentesco}
                  onChange={(e) => setField("parentesco", Number(e.target.value))}
                  disabled={submitting}
                >
                  {PARENTESCO_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* CPF + Data Nascimento */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">CPF</label>
                  <Input
                    placeholder="000.000.000-00"
                    value={draft.cpf}
                    onChange={(e) => setField("cpf", e.target.value)}
                    maxLength={14}
                    disabled={submitting}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">
                    Data de Nascimento <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="date"
                    value={draft.dataNascimento}
                    onChange={(e) => setField("dataNascimento", e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 accent-primary"
                    checked={draft.isPcd}
                    onChange={(e) => setField("isPcd", e.target.checked)}
                    disabled={submitting}
                  />
                  Pessoa com deficiência
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 accent-primary"
                    checked={draft.dependenteIR}
                    onChange={(e) => setField("dependenteIR", e.target.checked)}
                    disabled={submitting}
                  />
                  Dependente para IR
                </label>
              </div>
            </>
          )}

          {/* Observações */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Observações</label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              placeholder="Observações adicionais (opcional)"
              value={draft.observacoes}
              onChange={(e) => setField("observacoes", e.target.value)}
              disabled={submitting}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
