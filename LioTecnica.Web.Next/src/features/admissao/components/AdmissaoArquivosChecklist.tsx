"use client";

import { useMemo, useState, type ElementType } from "react";
import { toast } from "sonner";
import {
    AlertTriangle, CheckCircle2, Eye, FileText, Loader2, Upload, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";
import DocumentPreviewLightbox, { type PreviewItem, isPdfPreview } from "@/components/documents/DocumentPreviewLightbox";
import DocumentFileActions from "@/components/documents/DocumentFileActions";
import DocumentoTipoIcon from "@/components/documents/DocumentoTipoIcon";
import { toPreviewItem } from "@/components/documents/DocumentThumbnail";
import { sortDocumentosSolicitados } from "@/features/admissaoportal/admissaoDocumentoCatalog";
import { TIPOS_COM_VERSO } from "@/features/admissaoportal/constants";
import {
    resolveLadoDocumentoCode,
    resolveStatusDocumentoCode,
    tipoDocumentoToCode,
} from "@/features/admissao/admissaoDocumentosPadrao";
import {
    downloadPreAdmissaoDocument,
    usePreAdmissaoDocumentPreview,
} from "@/features/admissao/usePreAdmissaoDocumentPreview";

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

function latestRejectionObs(arquivos: ArquivoDocumento[]): string | null {
    const rejected = arquivos.filter((d) => !isValidDoc(d) && d.observacaoRh?.trim());
    if (rejected.length === 0) return null;
    return rejected.sort(byDate)[0].observacaoRh;
}

const STATUS_BADGE: Record<EnvioStatus, { label: string; className: string; icon: ElementType }> = {
    pendente: {
        label: "Pendente",
        className: "bg-red-50 text-red-700 border border-red-200",
        icon: XCircle,
    },
    enviado: {
        label: "Enviado",
        className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        icon: CheckCircle2,
    },
    rejeitado: {
        label: "Rejeitado",
        className: "bg-red-50 text-red-700 border border-red-200",
        icon: AlertTriangle,
    },
    parcial: {
        label: "Incompleto",
        className: "bg-amber-50 text-amber-800 border border-amber-200",
        icon: AlertTriangle,
    },
};

function DocPreviewThumb({
    preAdmissaoId,
    doc,
    onPreview,
}: {
    preAdmissaoId: string;
    doc: ArquivoDocumento;
    onPreview: (item: PreviewItem) => void;
}) {
    const previewUrl = usePreAdmissaoDocumentPreview(preAdmissaoId, doc);
    const isPdf = isPdfPreview({ url: previewUrl ?? "", nomeArquivo: doc.nomeArquivo, contentType: doc.contentType });

    if (!previewUrl) {
        return (
            <div className="flex h-16 w-full items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20">
                <FileText className="size-5 text-muted-foreground" />
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={() => onPreview(toPreviewItem(previewUrl, doc.nomeArquivo, doc.contentType))}
            className="group relative flex h-16 w-full items-center justify-center overflow-hidden rounded-lg border border-border/40 bg-muted/10"
            aria-label={`Visualizar ${doc.nomeArquivo}`}
        >
            {isPdf ? (
                <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
                    <FileText className="size-5 text-red-500/80" />
                    <span className="text-[9px] font-semibold uppercase">PDF</span>
                </div>
            ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="" className="h-full w-full object-cover object-top" />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/25 group-hover:opacity-100">
                <Eye className="size-4 text-white drop-shadow" />
            </span>
        </button>
    );
}

function DocSideBlock({
    preAdmissaoId,
    doc,
    sideLabel,
    onPreview,
}: {
    preAdmissaoId: string;
    doc: ArquivoDocumento;
    sideLabel?: string;
    onPreview: (item: PreviewItem) => void;
}) {
    const previewUrl = usePreAdmissaoDocumentPreview(preAdmissaoId, doc);
    const [downloading, setDownloading] = useState(false);

    return (
        <div className="space-y-2">
            {sideLabel ? (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{sideLabel}</p>
            ) : null}
            <DocPreviewThumb preAdmissaoId={preAdmissaoId} doc={doc} onPreview={onPreview} />
            <DocumentFileActions
                url={previewUrl ?? ""}
                nomeArquivo={doc.nomeArquivo}
                contentType={doc.contentType}
                onPreview={onPreview}
                onDownload={() => {
                    setDownloading(true);
                    void downloadPreAdmissaoDocument(preAdmissaoId, doc, previewUrl)
                        .catch(() => toast.error("Não foi possível baixar o arquivo."))
                        .finally(() => setDownloading(false));
                }}
                disabled={!previewUrl || downloading}
                className="w-full"
            />
        </div>
    );
}

function DocumentReviewCard({
    index,
    tipo,
    label,
    obrigatorio,
    arquivos,
    envioStatus,
    preAdmissaoId,
    canSolicitarReenvio,
    candidatoEmail,
    onPreview,
    onReenvioSuccess,
}: {
    index: number;
    tipo: number;
    label: string;
    obrigatorio: boolean;
    arquivos: ArquivoDocumento[];
    envioStatus: EnvioStatus;
    preAdmissaoId: string;
    canSolicitarReenvio: boolean;
    candidatoEmail?: string | null;
    onPreview: (item: PreviewItem) => void;
    onReenvioSuccess: () => void;
}) {
    const badge = STATUS_BADGE[envioStatus];
    const BadgeIcon = badge.icon;
    const { frentes, versos, unicos } = splitByLado(arquivos);
    const hasSides = TIPOS_COM_VERSO.has(tipo);
    const latestFrente = frentes[0];
    const latestVerso = versos[0];
    const latestUnico = unicos[0] ?? frentes[0];
    const rejectionObs = latestRejectionObs(arquivos);
    const [reenviando, setReenviando] = useState(false);

    async function handleReenviar() {
        const ok = await confirmDialog({
            title: "Solicitar reenvio?",
            description: `O candidato receberá um e-mail para reenviar: ${label}.${candidatoEmail ? ` Destino: ${candidatoEmail}` : ""}`,
            confirmText: "Solicitar reenvio",
            cancelText: "Cancelar",
        });
        if (!ok) return;

        setReenviando(true);
        try {
            const res = await apiFetch(`/api/pre-admissao/${preAdmissaoId}/solicitar-reenvio-documentos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tiposDocumento: [tipo],
                    observacaoRh: rejectionObs,
                    enviarEmail: true,
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null) as { message?: string } | null;
                toast.error(body?.message || "Não foi possível solicitar o reenvio.");
                return;
            }
            toast.success("Reenvio solicitado ao candidato.");
            onReenvioSuccess();
        } catch {
            toast.error("Erro de conexão ao solicitar reenvio.");
        } finally {
            setReenviando(false);
        }
    }

    const showReenviar = canSolicitarReenvio && (envioStatus === "rejeitado" || envioStatus === "parcial");

    return (
        <article className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_1px_8px_rgba(15,23,42,0.05)]">
            <div className="flex gap-3 p-4 pb-3">
                <DocumentoTipoIcon tipo={tipo} label={label} size="sm" className="shrink-0" />
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                            {index > 0 && (
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[rgb(var(--lt-primary))] text-xs font-bold text-white">
                                    {index}
                                </span>
                            )}
                            <div className="min-w-0">
                                <h3 className="text-sm font-semibold leading-snug text-slate-900">{label}</h3>
                                {obrigatorio && (
                                    <p className="text-[11px] text-muted-foreground">Obrigatório</p>
                                )}
                            </div>
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.className}`}>
                            <BadgeIcon className="size-3" />
                            {badge.label}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 flex-col gap-3 px-4 pb-4">
                {showReenviar && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        <p>
                            <span className="font-semibold">Reenvio necessário.</span>
                            {rejectionObs ? ` ${rejectionObs}` : " Verifique a observação do RH."}
                        </p>
                    </div>
                )}

                {hasSides ? (
                    <div className="grid grid-cols-2 gap-3">
                        {latestFrente ? (
                            <DocSideBlock preAdmissaoId={preAdmissaoId} doc={latestFrente} sideLabel="Frente" onPreview={onPreview} />
                        ) : (
                            <div className="space-y-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Frente</p>
                                <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-border/50 text-xs text-muted-foreground">
                                    Não enviada
                                </div>
                            </div>
                        )}
                        {latestVerso ? (
                            <DocSideBlock preAdmissaoId={preAdmissaoId} doc={latestVerso} sideLabel="Verso" onPreview={onPreview} />
                        ) : (
                            <div className="space-y-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Verso</p>
                                <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-border/50 text-xs text-muted-foreground">
                                    Não enviado
                                </div>
                            </div>
                        )}
                    </div>
                ) : latestUnico ? (
                    <DocSideBlock preAdmissaoId={preAdmissaoId} doc={latestUnico} onPreview={onPreview} />
                ) : (
                    <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border/50 text-xs text-muted-foreground">
                        Nenhum arquivo enviado
                    </div>
                )}

                {showReenviar && (
                    <Button
                        type="button"
                        size="sm"
                        className="w-full gap-1.5 bg-red-600 hover:bg-red-700"
                        disabled={reenviando}
                        onClick={() => void handleReenviar()}
                    >
                        {reenviando ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Upload className="size-4" />
                        )}
                        Reenviar
                    </Button>
                )}
            </div>
        </article>
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

    const obrigatorios = useMemo(
        () => sortedSolicitados.filter((s) => s.obrigatorio),
        [sortedSolicitados],
    );

    const progress = useMemo(() => {
        let enviados = 0;
        for (const sol of obrigatorios) {
            const arquivos = docsByTipo.get(sol.tipo) ?? [];
            if (resolveTipoEnvioStatus(arquivos, sol.tipo) === "enviado") enviados++;
        }
        const total = obrigatorios.length;
        const pendentes = total - enviados;
        const pct = total > 0 ? Math.round((enviados / total) * 100) : 0;
        return { enviados, pendentes, total, pct };
    }, [obrigatorios, docsByTipo]);

    const solicitadosKeys = useMemo(
        () => new Set(sortedSolicitados.map((s) => s.tipo)),
        [sortedSolicitados],
    );

    const extras = useMemo(
        () => documentos.filter((d) => !solicitadosKeys.has(tipoDocumentoToCode(d.tipo))),
        [documentos, solicitadosKeys],
    );

    if (sortedSolicitados.length === 0 && documentos.length === 0) {
        return (
            <div className="py-12 text-center text-sm text-muted-foreground">
                Nenhum documento solicitado ou enviado.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Documentos Solicitados</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                        {progress.total > 0
                            ? `${progress.total} documento${progress.total !== 1 ? "s" : ""} obrigatório${progress.total !== 1 ? "s" : ""} para conferência`
                            : `${sortedSolicitados.length} documento${sortedSolicitados.length !== 1 ? "s" : ""} para conferência`}
                    </p>
                </div>

                {progress.total > 0 && (
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                        <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-slate-700">
                                    {progress.enviados} de {progress.total} enviados
                                </span>
                                <span className="tabular-nums text-muted-foreground">{progress.pct}% concluído</span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                                <div
                                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                    style={{ width: `${progress.pct}%` }}
                                />
                            </div>
                        </div>

                        <div className="flex shrink-0 gap-3">
                            <div className="flex min-w-[8.5rem] items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                                <div>
                                    <p className="text-lg font-bold leading-none text-emerald-700">{progress.enviados}</p>
                                    <p className="text-[11px] text-emerald-700/80">enviados</p>
                                    <p className="text-[10px] text-emerald-600/70">Documentos recebidos</p>
                                </div>
                            </div>
                            <div className="flex min-w-[8.5rem] items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                                <AlertTriangle className="size-5 shrink-0 text-red-600" />
                                <div>
                                    <p className="text-lg font-bold leading-none text-red-700">{progress.pendentes}</p>
                                    <p className="text-[11px] text-red-700/80">pendentes</p>
                                    <p className="text-[10px] text-red-600/70">Requerem atenção</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {sortedSolicitados.length > 0 && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {sortedSolicitados.map((sol) => {
                        const arquivos = docsByTipo.get(sol.tipo) ?? [];
                        const envioStatus = resolveTipoEnvioStatus(arquivos, sol.tipo);
                        const obrigatorioIndex = obrigatorios.findIndex((o) => o.tipo === sol.tipo);
                        const index = obrigatorioIndex >= 0 ? obrigatorioIndex + 1 : 0;

                        return (
                            <DocumentReviewCard
                                key={sol.tipo}
                                index={index}
                                tipo={sol.tipo}
                                label={sol.label}
                                obrigatorio={sol.obrigatorio}
                                arquivos={arquivos}
                                envioStatus={envioStatus}
                                preAdmissaoId={preAdmissaoId}
                                canSolicitarReenvio={canSolicitarReenvio}
                                candidatoEmail={candidatoEmail}
                                onPreview={setPreview}
                                onReenvioSuccess={onSuccess}
                            />
                        );
                    })}
                </div>
            )}

            {extras.length > 0 && (
                <details className="rounded-xl border border-border/30 bg-muted/5">
                    <summary className="cursor-pointer px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Outros arquivos enviados ({extras.length})
                    </summary>
                    <div className="divide-y divide-border/20 border-t border-border/20">
                        {extras.map((d) => (
                            <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                                <span className="text-sm font-medium">{d.nomeArquivo}</span>
                                <DocumentFileActions
                                    url={d.presignedUrl}
                                    nomeArquivo={d.nomeArquivo}
                                    contentType={d.contentType}
                                    onPreview={setPreview}
                                    onDownload={() => {
                                        void downloadPreAdmissaoDocument(preAdmissaoId, d, d.presignedUrl)
                                            .catch(() => toast.error("Não foi possível baixar o arquivo."));
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </details>
            )}

            <DocumentPreviewLightbox preview={preview} onClose={() => setPreview(null)} />
        </div>
    );
}
