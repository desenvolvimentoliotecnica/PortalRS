"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";
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
import {
  listEmailTemplates,
  htmlToPlainish,
  type EmailTemplateListItem,
} from "@/features/recrutamento/candidaturas/emailTemplatesClient";
import EmailMessagePreviewDialog from "@/features/recrutamento/candidaturas/EmailMessagePreviewDialog";

type Props = {
  open: boolean;
  vagaId: string;
  vagaTitulo: string;
  novoStatus: string;
  onClose: () => void;
  onConfirm: (enviarIds: string[] | null) => Promise<void>;
};

const DEFAULT_RETORNO_CODE = "EtapaRecusado";

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
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateListItem[]>([]);
  const [emailTemplateCode, setEmailTemplateCode] = useState(DEFAULT_RETORNO_CODE);
  const [selectionReady, setSelectionReady] = useState(false);
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  const [emailSubjectOverride, setEmailSubjectOverride] = useState<string | null>(null);
  const [emailBodyHtmlOverride, setEmailBodyHtmlOverride] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setEmailTemplateCode(DEFAULT_RETORNO_CODE);
      setPreview(null);
      setSelectionReady(false);
      setEmailPreviewOpen(false);
      setEmailSubjectOverride(null);
      setEmailBodyHtmlOverride(null);
      return;
    }
    if (!vagaId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [data, templates] = await Promise.all([
          previewRetornoNegativo(vagaId, emailTemplateCode),
          listEmailTemplates().catch(() => [] as EmailTemplateListItem[]),
        ]);
        if (cancelled) return;
        setPreview(data);
        setEmailTemplates(templates.filter((t) => t.isActive !== false));
        if (!selectionReady) {
          setSelected(new Set((data?.destinatarios ?? []).map((d) => d.candidaturaId)));
          setSelectionReady(true);
        }
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, vagaId, emailTemplateCode, selectionReady]);

  const destinatarios = preview?.destinatarios ?? [];
  const allSelected = destinatarios.length > 0 && destinatarios.every((d) => selected.has(d.candidaturaId));
  const selectedIds = useMemo(() => Array.from(selected), [selected]);
  const firstSelected = useMemo(
    () => destinatarios.find((d) => selected.has(d.candidaturaId)) ?? destinatarios[0] ?? null,
    [destinatarios, selected],
  );
  const hasCustomMessage = Boolean(emailBodyHtmlOverride?.trim());

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

  const handleFecharComEnvio = async () => {
    setSubmitting(true);
    try {
      if (selectedIds.length > 0) {
        const res = await enviarRetornoNegativo(
          vagaId,
          selectedIds,
          emailTemplateCode,
          emailSubjectOverride,
          emailBodyHtmlOverride,
        );
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
    <>
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

          {loading && !preview ? (
            <p className="text-muted-foreground">Carregando candidatos elegíveis…</p>
          ) : destinatarios.length === 0 ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
              Nenhum candidato elegível para retorno negativo nesta vaga.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-foreground">
                  Modelo de e-mail
                  <select
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={emailTemplateCode}
                    disabled={submitting}
                    onChange={(e) => {
                      setEmailTemplateCode(e.target.value);
                      setEmailSubjectOverride(null);
                      setEmailBodyHtmlOverride(null);
                    }}
                  >
                    {(emailTemplates.length > 0 ? emailTemplates : [
                      { name: DEFAULT_RETORNO_CODE, displayName: "Retorno negativo do processo seletivo" } as EmailTemplateListItem,
                    ]).map((t) => (
                      <option key={t.name} value={t.name}>{t.displayName}</option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submitting || !emailTemplateCode || !firstSelected}
                  onClick={() => setEmailPreviewOpen(true)}
                >
                  <Eye className="mr-1.5 size-3.5" />
                  Visualizar / editar mensagem
                </Button>
                {firstSelected && (
                  <p className="text-xs text-muted-foreground">
                    Prévia com <strong>{firstSelected.candidatoNome}</strong>
                    {selectedIds.length > 1
                      ? ". Se personalizar o texto, a mesma mensagem será enviada a todos os selecionados."
                      : "."}
                  </p>
                )}
                {hasCustomMessage && (
                  <p className="text-xs text-amber-700">
                    Mensagem personalizada será enviada igual para todos os selecionados.
                  </p>
                )}
              </div>
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
                      <WhatsAppContactButton size="xs" celular={d.candidatoCelular} fone={d.candidatoFone} candidatoNome={d.candidatoNome} />
                    </li>
                  ))}
                </ul>
              </div>
              {(hasCustomMessage || preview?.templateAssunto) && (
                <details className="rounded-md border border-border px-3 py-2" open={hasCustomMessage}>
                  <summary className="cursor-pointer font-medium">
                    {hasCustomMessage ? "Mensagem confirmada" : "Prévia do template de e-mail"}
                  </summary>
                  <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <div>
                      <strong>Assunto:</strong>{" "}
                      {hasCustomMessage ? emailSubjectOverride : preview?.templateAssunto}
                    </div>
                    <div className="whitespace-pre-wrap">
                      {hasCustomMessage
                        ? htmlToPlainish(emailBodyHtmlOverride ?? "")
                        : preview?.templateCorpo}
                    </div>
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

    <EmailMessagePreviewDialog
      open={emailPreviewOpen}
      onClose={() => setEmailPreviewOpen(false)}
      templateCode={emailTemplateCode}
      initialSubject={emailSubjectOverride}
      initialBodyHtml={emailBodyHtmlOverride}
      description={
        firstSelected
          ? `Prévia com ${firstSelected.candidatoNome}. Tags preenchidas. Se editar, a mesma mensagem será enviada a todos os selecionados.`
          : undefined
      }
      tokens={{
        CandidatoNome: firstSelected?.candidatoNome ?? "",
        VagaTitulo: vagaTitulo,
      }}
      onConfirm={(subject, bodyHtml) => {
        setEmailSubjectOverride(subject);
        setEmailBodyHtmlOverride(bodyHtml);
        setEmailPreviewOpen(false);
        toast.success("Mensagem confirmada para o envio.");
      }}
    />
    </>
  );
}
