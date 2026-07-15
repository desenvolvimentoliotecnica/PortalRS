"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmailRichTextEditor } from "@/features/admin/email-templates/EmailRichTextEditor";
import { applyBrandingDefaults, getTenantBrandingAdmin } from "@/lib/tenant-branding";
import {
  applyEmailTokens,
  getEmailTemplateByCode,
} from "./emailTemplatesClient";

export type EmailPreviewTokens = Record<string, string | null | undefined>;

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (subject: string, bodyHtml: string) => void;
  /** Código do catálogo; usado quando não há draft. */
  templateCode: string | null | undefined;
  tokens: EmailPreviewTokens;
  /** Se informado, reabre o draft em vez de regenerar do template. */
  initialSubject?: string | null;
  initialBodyHtml?: string | null;
  title?: string;
  description?: string;
};

let cachedEmpresaNome: string | null = null;

async function resolveEmpresaNome(): Promise<string> {
  if (cachedEmpresaNome) return cachedEmpresaNome;
  try {
    const branding = await getTenantBrandingAdmin();
    cachedEmpresaNome = applyBrandingDefaults(branding).nomePortal;
  } catch {
    cachedEmpresaNome = "Portal de RH";
  }
  return cachedEmpresaNome;
}

export async function loadRenderedEmailTemplate(
  templateCode: string,
  tokens: EmailPreviewTokens,
): Promise<{ subject: string; bodyHtml: string }> {
  const empresaNome = tokens.EmpresaNome?.trim() || (await resolveEmpresaNome());
  const merged: EmailPreviewTokens = {
    ...tokens,
    EmpresaNome: empresaNome,
  };
  const detail = await getEmailTemplateByCode(templateCode);
  return {
    subject: applyEmailTokens(detail.subjectTemplate ?? "", merged),
    bodyHtml: applyEmailTokens(detail.bodyHtml ?? "", merged),
  };
}

export default function EmailMessagePreviewDialog({
  open,
  onClose,
  onConfirm,
  templateCode,
  tokens,
  initialSubject,
  initialBodyHtml,
  title = "Visualizar / editar mensagem",
  description = "Confira exatamente o que o candidato receberá. Você pode ajustar o assunto e o corpo antes de confirmar.",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const hasDraft =
        (initialSubject != null && initialSubject.trim() !== "") ||
        (initialBodyHtml != null && initialBodyHtml.trim() !== "");

      if (hasDraft) {
        setSubject(initialSubject ?? "");
        setBodyHtml(initialBodyHtml ?? "");
        setEditorKey((k) => k + 1);
        return;
      }

      if (!templateCode?.trim()) {
        toast.error("Selecione um modelo de e-mail.");
        return;
      }

      setLoading(true);
      try {
        const rendered = await loadRenderedEmailTemplate(templateCode.trim(), tokens);
        if (cancelled) return;
        setSubject(rendered.subject);
        setBodyHtml(rendered.bodyHtml);
        setEditorKey((k) => k + 1);
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Falha ao carregar o modelo.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // tokens object identity pode mudar a cada render — usamos JSON estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, templateCode, initialSubject, initialBodyHtml, JSON.stringify(tokens)]);

  function handleConfirm() {
    const sub = subject.trim();
    const body = bodyHtml.trim();
    if (!sub || !body) {
      toast.error("Informe assunto e corpo da mensagem.");
      return;
    }
    onConfirm(sub, body);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onClose()}>
      <DialogContent
        className="z-[110] flex max-h-[min(92dvh,900px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        overlayClassName="z-[110]"
      >
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Carregando mensagem…
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Assunto</label>
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Corpo do e-mail</label>
                <EmailRichTextEditor
                  key={editorKey}
                  value={bodyHtml}
                  onChange={setBodyHtml}
                  placeholder="Conteúdo que o candidato receberá…"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" disabled={loading} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={loading} onClick={handleConfirm}>
            Usar esta mensagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
