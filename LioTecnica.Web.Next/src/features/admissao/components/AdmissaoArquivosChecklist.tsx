"use client";

import { useMemo, useState, type ElementType } from "react";
import { toast } from "sonner";
import {
    CheckCircle2, Download, Eye, FileText, Loader2, Mail, XCircle, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";
import DocumentPreviewLightbox, { type PreviewItem } from "@/components/documents/DocumentPreviewLightbox";
import { toPreviewItem } from "@/components/documents/DocumentThumbnail";
import { sortDocumentosSolicitados } from "@/features/admissaoportal/admissaoDocumentoCatalog";
import { TIPOS_COM_VERSO } from "@/features/admissaoportal/constants";
import {
    resolveLadoDocumentoCode,
    resolveStatusDocumentoCode,
    tipoDocumentoToCode,
} from "@/features/admissao/admissaoDocumentosPadrao";

export interface ArquivoDocumento {
    id: string;
    tipo: number | string;
    lado: number | string;
    nomeArquivo: string;
    contentType: string;
    tamanhoBytes: number;
    status: number;
    observacaoRh: string | null;
    createdAtUtc: string;
    presignedUrl: string;
}

export interface ArquivoSolicitado {
    tipoDocumento: number | string;
    label: string;
    obrigatorio: boolean;
}

interface Props {
    preAdmissaoId: string;
    candidatoEmail?: string | null;
    documentos: ArquivoDocumento[];
    documentosSolicitados: ArquivoSolicitado[];
    canSolicitarReenvio: boolean;
    onSuccess: () => void;
}

type EnvioStatus = "pendente" | "enviado" | "rejeitado" | "parcial";

function byDate(a: ArquivoDocumento, b: ArquivoDocumento) {
    return new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime();
}

function splitByLado(arquivos: ArquivoDocumento[]) {
    return {
        frentes: arquivos.filter((d) => resolveLadoDocumentoCode(d.lado) === 1).sort(byDate),
        versos: arquivos.filter((d) => resolveLadoDocumentoCode(d.lado) === 2).sort(byDate),
        unicos: arquivos.filter((d) => resolveLadoDocumentoCode(d.lado) === 0).sort(byDate),
    };
}

function isValidDoc(d: ArquivoDocumento) {
    return resolveStatusDocumentoCode(d.status) !== 2;
}

function resolveTipoEnvioStatus(arquivos: ArquivoDocumento[], tipo: number): EnvioStatus {
    const { frentes, versos, unicos } = splitByLado(arquivos);
    if (TIPOS_COM_VERSO.has(tipo)) {
        const frenteOk = frentes.find(isValidDoc);
        const versoOk = versos.find(isValidDoc);
        if (frenteOk && versoOk) return "enviado";
        const hasAny = frentes.length > 0 || versos.length > 0;
        if (!hasAny) return "pendente";
        const allRejected = frentes.every((d) => !isValidDoc(d)) && versos.every((d) => !isValidDoc(d))
            && (frentes.length > 0 || versos.length > 0);
        if (allRejected && !frenteOk && !versoOk) return "rejeitado";
        return "parcial";
    }
    const latest = [...unicos, ...frentes].sort(byDate)[0];
    if (!latest) return "pendente";
    if (isValidDoc(latest)) return "enviado";
    return "rejeitado";
}

const STATUS_BADGE: Record<EnvioStatus, { label: string; className: string; icon: ElementType }> = {
    pendente: { label: "Pendente", className: "bg-red-500/10 text-red-700 dark:text-red-400", icon: XCircle },
    enviado: { label: "Enviado", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
    rejeitado: { label: "Rejeitado", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: AlertTriangle },
    parcial: { label: "Incompleto", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: AlertTriangle },
};

function fmtDate(d: string) {
    return new Date(d).toLocaleString("pt-BR");
}

function DocFileActions({
    doc,
    onPreview,
}: {
    doc: ArquivoDocumento;
    onPreview: (item: PreviewItem) => void;
}) {
    if (!doc.presignedUrl) return null;
    return (
        <div className="flex gap-1 shrink-0">
            <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 px-2"
                onClick={() => onPreview(toPreviewItem(doc.presignedUrl, doc.nomeArquivo, doc.contentType))}
            >
                <Eye className="size-3.5" />
                <span className="hidden sm:inline text-xs">Visualizar</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1 px-2" asChild>
                <a href={doc.presignedUrl} download={doc.nomeArquivo} target="_blank" rel="noopener noreferrer">
                    <Download className="size-3.5" />
                    <span className="hidden sm:inline text-xs">Baixar</span>
                </a>
            </Button>
        </div>
    );
}

function FileSideRow({
    doc,
    sideLabel,
    onPreview,
}: {
    doc: ArquivoDocumento;
    sideLabel?: string;
    onPreview: (item: PreviewItem) => void;
}) {
    const valid = isValidDoc(doc);
    return (
        <div className={`flex items-center justify-between gap-2 px-3 py-2 ${!valid ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}>
            <div className="flex items-center gap-2 min-w-0">
                <FileText className="size-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {sideLabel && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground shrink-0">
                                {sideLabel}
                            </span>
                        )}
                        <span className="text-sm truncate">{doc.nomeArquivo}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {(doc.tamanhoBytes / 1024).toFixed(0)} KB • {fmtDate(doc.createdAtUtc)}
                    </div>
                    {!valid && doc.observacaoRh && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{doc.observacaoRh}</p>
                    )}
                </div>
            </div>
            <DocFileActions doc={doc} onPreview={onPreview} />
        </div>
    );
}

export default function AdmissaoArquivosChecklist({
    preAdmissaoId,
    candidatoEmail,
    documentos,
    documentosSolicitados,
    canSolicitarReenvio,
    onSuccess,
}: Props) {
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [mensagem, setMensagem] = useState("");
    const [sending, setSending] = useState(false);
    const [preview, setPreview] = useState<PreviewItem | null>(null);

    const docsByTipo = useMemo(() => {
        const map = new Map<number, ArquivoDocumento[]>();
        for (const d of documentos) {
            const code = tipoDocumentoToCode(d.tipo);
            if (code < 0) continue;
            if (!map.has(code)) map.set(code, []);
            map.get(code)!.push(d);
        }
        return map;
    }, [documentos]);

    const sortedSolicitados = useMemo(
        () => sortDocumentosSolicitados(
            documentosSolicitados.map((s) => ({
                tipo: tipoDocumentoToCode(s.tipoDocumento),
                label: s.label,
                obrigatorio: s.obrigatorio,
            })),
        ),
        [documentosSolicitados],
    );

    const solicitadosKeys = useMemo(
        () => new Set(sortedSolicitados.map((s) => s.tipo)),
        [sortedSolicitados],
    );

    const extras = useMemo(
        () => documentos.filter((d) => !solicitadosKeys.has(tipoDocumentoToCode(d.tipo))),
        [documentos, solicitadosKeys],
    );

    function toggleTipo(tipo: number) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(tipo)) next.delete(tipo);
            else next.add(tipo);
            return next;
        });
    }

    async function handleSolicitarReenvio() {
        if (selected.size === 0) {
            toast.error("Selecione ao menos um documento.");
            return;
        }
        const labels = sortedSolicitados
            .filter((s) => selected.has(s.tipo))
            .map((s) => s.label);
        const ok = await confirmDialog({
            title: "Solicitar reenvio por e-mail?",
            description: `O candidato receberá um e-mail com link para reenviar: ${labels.join(", ")}.${candidatoEmail ? ` Destino: ${candidatoEmail}` : ""}`,
            confirmText: "Enviar e-mail",
            cancelText: "Cancelar",
        });
        if (!ok) return;

        setSending(true);
        try {
            const res = await apiFetch(`/api/pre-admissao/${preAdmissaoId}/solicitar-reenvio-documentos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tiposDocumento: Array.from(selected),
                    observacaoRh: mensagem.trim() || null,
                    enviarEmail: true,
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null) as { message?: string } | null;
                toast.error(body?.message || "Não foi possível solicitar o reenvio.");
                return;
            }
            const body = await res.json() as { emailEnviado?: boolean; publicUrl?: string };
            if (body.emailEnviado) {
                toast.success("E-mail de reenvio enviado ao candidato.");
            } else if (candidatoEmail) {
                toast.warning("Status atualizado, mas o e-mail não foi enviado. Verifique a configuração de e-mail.");
            } else {
                toast.success("Status atualizado para permitir novo envio pelo candidato.");
            }
            setSelected(new Set());
            setMensagem("");
            onSuccess();
        } catch {
            toast.error("Erro de conexão ao solicitar reenvio.");
        } finally {
            setSending(false);
        }
    }

    if (sortedSolicitados.length === 0 && documentos.length === 0) {
        return (
            <div className="text-center py-8 text-sm text-muted-foreground">
                Nenhum documento solicitado ou enviado.
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {canSolicitarReenvio && sortedSolicitados.length > 0 && (
                <div className="rounded-xl border border-border/40 bg-muted/10 p-4 space-y-3">
                    <div>
                        <h3 className="text-sm font-semibold">Solicitar reenvio ao candidato</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Marque os documentos que precisam ser enviados novamente. O candidato receberá um e-mail com o link do formulário.
                        </p>
                    </div>
                    <Textarea
                        value={mensagem}
                        onChange={(e) => setMensagem(e.target.value)}
                        placeholder="Mensagem ao candidato (opcional) — ex.: documento ilegível, data vencida…"
                        rows={2}
                        className="text-sm resize-none"
                    />
                    <div className="flex justify-end">
                        <Button
                            size="sm"
                            onClick={() => void handleSolicitarReenvio()}
                            disabled={sending || selected.size === 0}
                        >
                            {sending ? (
                                <><Loader2 className="size-4 mr-1 animate-spin" /> Enviando…</>
                            ) : (
                                <><Mail className="size-4 mr-1" /> Solicitar novamente por e-mail ({selected.size})</>
                            )}
                        </Button>
                    </div>
                </div>
            )}

            {sortedSolicitados.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Documentos solicitados ({sortedSolicitados.length})
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    {sortedSolicitados.map((sol) => {
                        const tipo = sol.tipo;
                        const arquivos = docsByTipo.get(tipo) ?? [];
                        const envioStatus = resolveTipoEnvioStatus(arquivos, tipo);
                        const badge = STATUS_BADGE[envioStatus];
                        const BadgeIcon = badge.icon;
                        const { frentes, versos, unicos } = splitByLado(arquivos);
                        const hasSides = TIPOS_COM_VERSO.has(tipo);
                        const latestFrente = frentes[0];
                        const latestVerso = versos[0];
                        const latestUnico = unicos[0];

                        return (
                            <div
                                key={tipo}
                                className={`flex flex-col rounded-lg border overflow-hidden h-full ${
                                    envioStatus === "enviado"
                                        ? "border-emerald-200/80 bg-emerald-50/30 dark:border-emerald-800/60 dark:bg-emerald-950/10"
                                        : envioStatus === "pendente"
                                            ? "border-red-200/80 bg-red-50/20 dark:border-red-800/60 dark:bg-red-950/10"
                                            : "border-amber-200/80 bg-amber-50/20 dark:border-amber-800/60 dark:bg-amber-950/10"
                                }`}
                            >
                                <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/20">
                                    {canSolicitarReenvio && (
                                        <input
                                            type="checkbox"
                                            checked={selected.has(tipo)}
                                            onChange={() => toggleTipo(tipo)}
                                            className="size-4 rounded border-gray-300 accent-primary shrink-0"
                                            aria-label={`Selecionar ${sol.label}`}
                                        />
                                    )}
                                    <BadgeIcon className={`size-4 shrink-0 ${badge.className.split(" ")[1]}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium leading-snug">{sol.label}</div>
                                        {sol.obrigatorio && (
                                            <span className="text-[10px] text-muted-foreground">Obrigatório</span>
                                        )}
                                    </div>
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${badge.className}`}>
                                        {badge.label}
                                    </span>
                                </div>

                                {hasSides ? (
                                    <div className="divide-y divide-border/20">
                                        {latestFrente ? (
                                            <FileSideRow doc={latestFrente} sideLabel="Frente" onPreview={setPreview} />
                                        ) : (
                                            <div className="px-3 py-2 text-xs text-muted-foreground">Frente não enviada</div>
                                        )}
                                        {latestVerso ? (
                                            <FileSideRow doc={latestVerso} sideLabel="Verso" onPreview={setPreview} />
                                        ) : (
                                            <div className="px-3 py-2 text-xs text-muted-foreground">Verso não enviado</div>
                                        )}
                                    </div>
                                ) : latestUnico || latestFrente ? (
                                    <FileSideRow
                                        doc={latestUnico ?? latestFrente!}
                                        onPreview={setPreview}
                                    />
                                ) : (
                                    <div className="px-3 py-2.5 text-xs text-muted-foreground">
                                        Nenhum arquivo enviado ainda.
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    </div>
                </div>
            )}

            {extras.length > 0 && (
                <details className="rounded-lg border border-border/30 bg-muted/5">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Outros arquivos enviados ({extras.length})
                    </summary>
                    <div className="divide-y divide-border/20 border-t border-border/20">
                        {extras.map((d) => (
                            <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-2">
                                <div className="min-w-0">
                                    <div className="text-sm truncate">{d.nomeArquivo}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {(d.tamanhoBytes / 1024).toFixed(0)} KB • {fmtDate(d.createdAtUtc)}
                                    </div>
                                </div>
                                <DocFileActions doc={d} onPreview={setPreview} />
                            </div>
                        ))}
                    </div>
                </details>
            )}

            <DocumentPreviewLightbox preview={preview} onClose={() => setPreview(null)} />
        </div>
    );
}
