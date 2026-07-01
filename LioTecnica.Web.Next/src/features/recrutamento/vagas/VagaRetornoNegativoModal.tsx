"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  enviarRetornoNegativo,
  previewRetornoNegativo,
  type VagaRetornoNegativoPreviewResponse,
} from "./vagaRetornoNegativoApi";
import { WhatsAppContactButton } from "@/components/contact/WhatsAppContactButton";

type Props = {
  open: boolean;
  vagaId: string;
  vagaTitulo: string;
  novoStatus: string;
  onClose: () => void;
  onConfirm: (enviarIds: string[] | null) => Promise<void>;
};

export default function VagaRetornoNegativoModal({
  open,
  vagaId,
  vagaTitulo,
  novoStatus,
  onClose,
  onConfirm,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<VagaRetornoNegativoPreviewResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !vagaId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await previewRetornoNegativo(vagaId);
        if (cancelled) return;
        setPreview(data);
        setSelected(new Set((data?.destinatarios ?? []).map((d) => d.candidaturaId)));
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, vagaId]);

  const destinatarios = preview?.destinatarios ?? [];
  const allSelected = destinatarios.length > 0 && destinatarios.every((d) => selected.has(d.candidaturaId));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(destinatarios.map((d) => d.candidaturaId)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const handleFecharComEnvio = async () => {
    setSubmitting(true);
    try {
      if (selectedIds.length > 0) {
        const res = await enviarRetornoNegativo(vagaId, selectedIds);
        if (res.falhas > 0 && res.enviados === 0) {
          throw new Error("Não foi possível enviar o retorno negativo.");
        }
      }
      await onConfirm(selectedIds.length > 0 ? selectedIds : null);
    } catch (err) {
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleFecharSemEnvio = async () => {
    setSubmitting(true);
    try {
      await onConfirm(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !submitting && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fechar vaga — retorno aos candidatos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            A vaga <strong>{vagaTitulo}</strong> será alterada para <strong>{novoStatus}</strong>.
            Você pode enviar e-mail de retorno negativo aos candidatos ainda ativos (exceto contratado).
          </p>

          {loading ? (
            <p className="text-muted-foreground">Carregando candidatos elegíveis…</p>
          ) : destinatarios.length === 0 ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
              Nenhum candidato elegível para retorno negativo nesta vaga.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="font-medium">{destinatarios.length} candidato(s) elegível(is)</span>
                <button type="button" className="text-xs text-primary underline" onClick={toggleAll}>
                  {allSelected ? "Desmarcar todos" : "Marcar todos"}
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                <ul className="divide-y divide-border">
                  {destinatarios.map((d) => (
                    <li key={d.candidaturaId} className="flex items-start gap-3 px-3 py-2">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected.has(d.candidaturaId)}
                        onChange={() => toggleOne(d.candidaturaId)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{d.candidatoNome}</div>
                        <div className="text-xs text-muted-foreground">{d.candidatoEmail ?? "Sem e-mail"}</div>
                      </div>
                      <WhatsAppContactButton size="xs" celular={d.candidatoCelular} fone={d.candidatoFone} />
                    </li>
                  ))}
                </ul>
              </div>
              {preview?.templateAssunto && (
                <details className="rounded-md border border-border px-3 py-2">
                  <summary className="cursor-pointer font-medium">Prévia do template de e-mail</summary>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div><strong>Assunto:</strong> {preview.templateAssunto}</div>
                    <div className="whitespace-pre-wrap">{preview.templateCorpo}</div>
                  </div>
                </details>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" disabled={submitting} onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="outline" disabled={submitting} onClick={() => void handleFecharSemEnvio()}>
            Fechar sem enviar
          </Button>
          <Button
            disabled={submitting || loading}
            onClick={() => {
              void handleFecharComEnvio().catch((err) => {
                toast.error(err instanceof Error ? err.message : "Falha ao processar fechamento.");
              });
            }}
          >
            {submitting
              ? "Processando…"
              : selectedIds.length > 0
                ? `Fechar e enviar (${selectedIds.length})`
                : "Fechar vaga"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
