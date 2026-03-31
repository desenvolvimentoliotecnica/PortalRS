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

interface FormDraft {
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  complemento: string;
  cidade: string;
  uf: string;
  observacoes: string;
}

const EMPTY_DRAFT: FormDraft = {
  cep: "",
  logradouro: "",
  numero: "",
  bairro: "",
  complemento: "",
  cidade: "",
  uf: "",
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

export function EnderecoFormModal({ open, onClose, onSuccess }: Props) {
  const [draft, setDraft] = useState<FormDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(EMPTY_DRAFT);
  }, [open]);

  function setField<K extends keyof FormDraft>(key: K, value: FormDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function fetchCep(rawCep: string) {
    const digits = rawCep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.warning("CEP não encontrado.");
        return;
      }
      setDraft((d) => ({
        ...d,
        logradouro: data.logradouro || d.logradouro,
        bairro: data.bairro || d.bairro,
        cidade: data.localidade || d.cidade,
        uf: data.uf || d.uf,
      }));
    } catch {
      toast.warning("Não foi possível consultar o CEP.");
    } finally {
      setCepLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!draft.cep.replace(/\D/g, "")) {
      toast.error("Informe o CEP.");
      return;
    }
    if (!draft.logradouro.trim()) {
      toast.error("Informe o logradouro.");
      return;
    }
    if (!draft.cidade.trim()) {
      toast.error("Informe a cidade.");
      return;
    }
    if (!draft.uf.trim()) {
      toast.error("Informe o UF.");
      return;
    }

    setSubmitting(true);
    try {
      await fetchJson<unknown>("/api/colaborador/solicitacoes-endereco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cep: draft.cep.replace(/\D/g, ""),
          logradouro: draft.logradouro,
          numero: draft.numero || null,
          bairro: draft.bairro || null,
          complemento: draft.complemento || null,
          cidade: draft.cidade,
          uf: draft.uf.toUpperCase(),
          observacoes: draft.observacoes || null,
        }),
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
          <DialogTitle>Solicitar Alteração de Endereço</DialogTitle>
          <DialogDescription>
            Preencha os dados do novo endereço. Os campos serão preenchidos automaticamente ao
            informar o CEP.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* CEP */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">
              CEP <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Input
                placeholder="00000-000"
                value={draft.cep}
                onChange={(e) => setField("cep", e.target.value)}
                onBlur={(e) => fetchCep(e.target.value)}
                maxLength={9}
                disabled={submitting}
                className={cepLoading ? "pr-8" : ""}
              />
              {cepLoading && (
                <div className="absolute inset-y-0 right-2 flex items-center">
                  <svg
                    className="animate-spin h-4 w-4 text-muted-foreground"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Logradouro + Número */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-sm font-medium">
                Logradouro <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="Rua, Avenida, etc."
                value={draft.logradouro}
                onChange={(e) => setField("logradouro", e.target.value)}
                disabled={submitting || cepLoading}
              />
            </div>
            <div className="flex flex-col gap-1.5 w-24">
              <label className="text-sm font-medium">Número</label>
              <Input
                placeholder="Nº"
                value={draft.numero}
                onChange={(e) => setField("numero", e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Bairro */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Bairro</label>
            <Input
              placeholder="Bairro"
              value={draft.bairro}
              onChange={(e) => setField("bairro", e.target.value)}
              disabled={submitting || cepLoading}
            />
          </div>

          {/* Complemento */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Complemento</label>
            <Input
              placeholder="Apto, Bloco, etc. (opcional)"
              value={draft.complemento}
              onChange={(e) => setField("complemento", e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Cidade + UF */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-sm font-medium">
                Cidade <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="Cidade"
                value={draft.cidade}
                onChange={(e) => setField("cidade", e.target.value)}
                disabled={submitting || cepLoading}
              />
            </div>
            <div className="flex flex-col gap-1.5 w-20">
              <label className="text-sm font-medium">
                UF <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="UF"
                value={draft.uf}
                onChange={(e) => setField("uf", e.target.value.toUpperCase())}
                maxLength={2}
                disabled={submitting || cepLoading}
                className="uppercase"
              />
            </div>
          </div>

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
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting || cepLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || cepLoading}>
              {submitting ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
