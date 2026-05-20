"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail, Paperclip } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { CandidatoPortalPerfilReadonly, type CandidatoPortalPerfilCompleto } from "@/features/recrutamento/candidatos/CandidatoPortalPerfilReadonly";
import { fetchCandidatoPortalPerfil } from "@/features/recrutamento/candidatos/portalPerfilClient";
import {
  buildCandidatoDocumentoDownloadPath,
  downloadCandidatoDocumento,
} from "@/features/recrutamento/candidatos/candidatoDocumentoDownload";
import type { KanbanCandidaturaItem } from "./candidaturaApi";

type MatchBreakdown = {
  scoreFinal: number;
  passouMatchMinimo: boolean;
  modo?: "lexical" | "ai" | "semantic";
  scoreSemantico?: number | null;
  scoreLexico?: number | null;
  temRequisitoObrigatorioFaltando: boolean;
  requisitosObrigatoriosFaltando: string[];
  criterios: Array<{
    nome: string;
    peso: number;
    score: number;
    contribuicao: number;
  }>;
};

type Props = {
  open: boolean;
  item: KanbanCandidaturaItem | null;
  onClose: () => void;
};

const tabContentClass = "mt-4 min-h-0 flex-1 overflow-y-auto pr-2";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function readApiMessage(raw: string, fallback: string) {
  if (!raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw) as { message?: string; detail?: string; title?: string };
    return parsed.message || parsed.detail || parsed.title || fallback;
  } catch {
    return raw;
  }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm text-foreground break-words">{value || "—"}</div>
    </div>
  );
}

export default function CandidateKanbanDetailDialog({ open, item, onClose }: Props) {
  const [tab, setTab] = useState("resumo");
  const [portalPerfil, setPortalPerfil] = useState<CandidatoPortalPerfilCompleto | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [match, setMatch] = useState<MatchBreakdown | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailFiles, setEmailFiles] = useState<File[]>([]);
  const [emailSending, setEmailSending] = useState(false);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  const docs = portalPerfil?.portalDocuments?.items ?? [];

  useEffect(() => {
    if (!open || !item) return;
    setTab("resumo");
    setPortalPerfil(null);
    setPortalError(null);
    setMatch(null);
    setMatchError(null);
    setEmailSubject(`Contato sobre sua candidatura${item.vagaTitulo ? ` - ${item.vagaTitulo}` : ""}`);
    setEmailBody(`Olá ${item.candidatoNome},\n\n`);

    let cancelled = false;
    void (async () => {
      setPortalLoading(true);
      const result = await fetchCandidatoPortalPerfil(item.candidatoId);
      if (!cancelled) {
        setPortalPerfil(result.data);
        setPortalError(result.error);
        setPortalLoading(false);
      }
    })();

    void (async () => {
      setMatchLoading(true);
      try {
        const res = await apiFetch(
          `/api/vagas/${encodeURIComponent(item.vagaId)}/matching-breakdown-hybrid/${encodeURIComponent(item.candidatoId)}`,
          { cache: "no-store" },
          120_000,
        );
        const raw = await res.text().catch(() => "");
        if (!res.ok) throw new Error(readApiMessage(raw, `HTTP ${res.status}`));
        const data = JSON.parse(raw) as MatchBreakdown;
        if (!cancelled) setMatch(data);
      } catch (e) {
        if (!cancelled) setMatchError(e instanceof Error ? e.message : "Falha ao carregar match.");
      } finally {
        if (!cancelled) setMatchLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, item]);

  const emailFilesLabel = useMemo(() => {
    if (emailFiles.length === 0) return "Nenhum anexo selecionado";
    return `${emailFiles.length} anexo(s): ${emailFiles.map((f) => f.name).join(", ")}`;
  }, [emailFiles]);

  async function sendEmail() {
    if (!item || emailSending) return;
    const subject = emailSubject.trim();
    const body = emailBody.trim();
    if (!subject || !body) {
      toast.error("Informe assunto e corpo do email.");
      return;
    }

    setEmailSending(true);
    try {
      const fd = new FormData();
      fd.append("vagaId", item.vagaId);
      fd.append("candidaturaId", item.id);
      fd.append("assunto", subject);
      fd.append("corpo", body);
      for (const file of emailFiles) fd.append("anexos", file);

      const res = await apiFetch(
        `/api/candidatos/${encodeURIComponent(item.candidatoId)}/portal-notificacoes/enviar-mensagem`,
        { method: "POST", body: fd },
        120_000,
      );
      const raw = await res.text().catch(() => "");
      if (!res.ok) throw new Error(readApiMessage(raw, `HTTP ${res.status}`));

      toast.success("Email e notificação enviados ao candidato.");
      setEmailFiles([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar email.");
    } finally {
      setEmailSending(false);
    }
  }

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex h-[85vh] flex-col overflow-hidden sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Detalhes de {item.candidatoNome}</DialogTitle>
          <DialogDescription>
            Perfil público do portal, documentos, compatibilidade e comunicação com o candidato.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="match">Match</TabsTrigger>
            <TabsTrigger value="perfil">Perfil do Portal</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="email">Enviar Email</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className={`${tabContentClass} space-y-4`}>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Candidato" value={item.candidatoNome} />
              <Field label="Email" value={item.candidatoEmail ?? "—"} />
              <Field label="Vaga" value={[item.vagaTitulo, item.vagaCodigo].filter(Boolean).join(" · ")} />
              <Field label="Aplicada em" value={formatDate(item.aplicadaEmUtc)} />
              <Field label="SLA da etapa" value={`${item.diasNaEtapa}d / ${item.slaDiasEtapa}d`} />
              <Field label="Match do card" value={typeof item.matchScore === "number" ? `${Math.round(item.matchScore)}%` : "—"} />
            </div>
            <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-sm text-muted-foreground">
              Use as abas para conferir o perfil completo informado pelo candidato no portal, baixar documentos e enviar uma mensagem formal por email e notificação interna.
            </div>
          </TabsContent>

          <TabsContent value="match" className={`${tabContentClass} space-y-4`}>
            {matchLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Calculando match...</div>
            ) : matchError ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">{matchError}</div>
            ) : match ? (
              <>
                <div className="rounded-xl border border-border/40 bg-muted/20 p-5">
                  <div className="text-sm uppercase tracking-wide text-muted-foreground">Score final</div>
                  <div className="mt-1 text-5xl font-bold text-[rgb(var(--lt-primary))]">{match.scoreFinal}%</div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {match.passouMatchMinimo ? "Passa no mínimo" : "Abaixo do mínimo"}
                    {match.modo ? ` · ${match.modo}` : ""}
                    {match.scoreLexico != null ? ` · léxico ${match.scoreLexico}` : ""}
                    {match.scoreSemantico != null ? ` · semântico ${match.scoreSemantico}` : ""}
                  </div>
                </div>
                {match.temRequisitoObrigatorioFaltando ? (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm">
                    <div className="font-semibold text-red-700">Requisitos obrigatórios faltando</div>
                    <ul className="mt-2 list-disc pl-5">
                      {match.requisitosObrigatoriosFaltando.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                ) : null}
                <div className="space-y-2">
                  {match.criterios.map((c) => (
                    <div key={c.nome} className="rounded-xl border border-border/40 p-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold">{c.nome}</span>
                        <span className="font-mono text-muted-foreground">peso {c.peso} x {c.score}% = {c.contribuicao.toFixed(1)} pts</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-[rgb(var(--lt-primary))]" style={{ width: `${Math.max(0, Math.min(100, c.score))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="perfil" className={tabContentClass}>
            <CandidatoPortalPerfilReadonly
              data={portalPerfil}
              loading={portalLoading}
              loadError={portalError}
              candidatoId={item.candidatoId}
            />
          </TabsContent>

          <TabsContent value="documentos" className={`${tabContentClass} space-y-3`}>
            {portalLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando documentos...</div>
            ) : docs.length === 0 ? (
              <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-sm text-muted-foreground">Nenhum documento do portal.</div>
            ) : (
              docs.map((doc) => (
                <div key={String(doc.id ?? doc.nome)} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-semibold break-words">{doc.nome ?? doc.fileName ?? "Documento"}</div>
                    <div className="text-muted-foreground">{[doc.tipo, doc.data || doc.createdAtUtc].filter(Boolean).join(" · ") || "—"}</div>
                    {doc.observacoes ? <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{doc.observacoes}</div> : null}
                  </div>
                  {doc.id && doc.temArquivo ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={downloadingDocId === doc.id}
                      onClick={() => {
                        const name = doc.nome ?? doc.fileName ?? "documento";
                        const path = buildCandidatoDocumentoDownloadPath(item.candidatoId, doc.id!);
                        void (async () => {
                          setDownloadingDocId(doc.id!);
                          try {
                            await downloadCandidatoDocumento(path, name);
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Falha ao baixar documento.");
                          } finally {
                            setDownloadingDocId(null);
                          }
                        })();
                      }}
                    >
                      {downloadingDocId === doc.id ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                      Baixar
                    </Button>
                  ) : doc.link ? (
                    <Button type="button" variant="outline" asChild>
                      <a href={doc.link} target="_blank" rel="noopener noreferrer">Abrir link</a>
                    </Button>
                  ) : null}
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="email" className={`${tabContentClass} space-y-4`}>
            <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-sm text-muted-foreground">
              O mesmo assunto e corpo serão enviados por email e aparecerão como mensagem interna no portal do candidato.
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Assunto</label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                maxLength={160}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Corpo do email/notificação</label>
              <textarea
                className="min-h-48 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                maxLength={4000}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Anexos</label>
              <input
                type="file"
                multiple
                className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                onChange={(e) => setEmailFiles(Array.from(e.target.files ?? []))}
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Paperclip className="size-3" />
                {emailFilesLabel}
              </div>
            </div>
            <Button type="button" onClick={() => void sendEmail()} disabled={emailSending}>
              {emailSending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Mail className="mr-2 size-4" />}
              {emailSending ? "Enviando..." : "Enviar email e notificação"}
            </Button>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
