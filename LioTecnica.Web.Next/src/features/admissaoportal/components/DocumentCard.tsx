"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, XCircle, AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import type { AiExtractionResult, UploadedDoc } from "../useAdmissaoWizardStore";
import { ACCEPTED_DOC_MIME, TIPO_DOC_LABELS, TIPOS_COM_VERSO } from "../constants";
import { DOC_FRENTE_LABELS, DOC_HINTS, DOC_VERSO_LABELS } from "../admissaoDocumentoCatalog";
import DocumentPreviewLightbox, { type PreviewItem } from "@/components/documents/DocumentPreviewLightbox";
import DocumentThumbnail, { toPreviewItem } from "@/components/documents/DocumentThumbnail";

interface Props {
    tipo: number;
    obrigatorio: boolean;
    labelOverride?: string;
    uploadedDoc?: UploadedDoc;
    uploadedDocVerso?: UploadedDoc;
    aiResult?: AiExtractionResult;
    aiResultVerso?: AiExtractionResult;
    onFileSelected: (tipo: number, file: File, side: "frente" | "verso") => void;
    disabled?: boolean;
}

export default function DocumentCard({
    tipo, obrigatorio, labelOverride,
    uploadedDoc, uploadedDocVerso,
    aiResult, aiResultVerso,
    onFileSelected, disabled,
}: Props) {
    const fileRefFrente = useRef<HTMLInputElement>(null);
    const fileRefVerso = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<PreviewItem | null>(null);
    const label = labelOverride || TIPO_DOC_LABELS[tipo] || "Documento";
    const hint = DOC_HINTS[tipo];
    const hasVerso = TIPOS_COM_VERSO.has(tipo);

    return (
        <>
            <div className="rounded-xl border-2 border-border/60 bg-card p-4 space-y-3">
                <div className="flex items-start gap-2 flex-wrap">
                    <span className="text-sm font-semibold flex-1 min-w-0">{label}</span>
                    {obrigatorio && (
                        <span className="text-red-500 font-bold text-base leading-none shrink-0" title="Obrigatório">*</span>
                    )}
                </div>
                {hint && (
                    <p className="text-xs text-muted-foreground leading-relaxed -mt-1">{hint}</p>
                )}

                <DocumentSide
                    sideLabel={hasVerso ? (DOC_FRENTE_LABELS[tipo] || "Frente") : undefined}
                    uploadedDoc={uploadedDoc}
                    aiResult={aiResult}
                    disabled={disabled}
                    onFileSelected={() => fileRefFrente.current?.click()}
                    onPreview={setPreview}
                />
                <input
                    ref={fileRefFrente}
                    type="file"
                    accept={ACCEPTED_DOC_MIME}
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onFileSelected(tipo, f, "frente");
                        e.target.value = "";
                    }}
                />

                {hasVerso && (
                    <>
                        <DocumentSide
                            sideLabel={DOC_VERSO_LABELS[tipo] || "Verso"}
                            uploadedDoc={uploadedDocVerso}
                            aiResult={aiResultVerso}
                            disabled={disabled}
                            onFileSelected={() => fileRefVerso.current?.click()}
                            onPreview={setPreview}
                        />
                        <input
                            ref={fileRefVerso}
                            type="file"
                            accept={ACCEPTED_DOC_MIME}
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) onFileSelected(tipo, f, "verso");
                                e.target.value = "";
                            }}
                        />
                    </>
                )}
            </div>

            <DocumentPreviewLightbox preview={preview} onClose={() => setPreview(null)} />
        </>
    );
}

interface SideProps {
    sideLabel?: string;
    uploadedDoc?: UploadedDoc;
    aiResult?: AiExtractionResult;
    disabled?: boolean;
    onFileSelected: () => void;
    onPreview: (item: PreviewItem) => void;
}

function DocumentSide({ sideLabel, uploadedDoc, aiResult, disabled, onFileSelected, onPreview }: SideProps) {
    const isProcessing = aiResult?.processing;
    const isValid = aiResult && !aiResult.processing && aiResult.isValid;
    const isUploadError = !uploadedDoc && aiResult && !aiResult.processing && !aiResult.isValid;
    const isAiWarning = !!uploadedDoc && aiResult && !aiResult.processing && !aiResult.isValid;
    const isDone = uploadedDoc && isValid;
    const previewUrl = uploadedDoc?.presignedUrl || uploadedDoc?.thumbnail;
    const isPdf = uploadedDoc?.nomeArquivo?.toLowerCase().endsWith(".pdf");

    return (
        <div
            className={`rounded-lg border p-3 transition-all ${
                isDone
                    ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20"
                    : isUploadError
                      ? "border-red-300 bg-red-50/50 dark:bg-red-950/20"
                      : isAiWarning
                        ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
                        : isProcessing
                          ? "border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 animate-pulse"
                          : "border-border/40 bg-muted/30"
            }`}
        >
            <div className="flex gap-3 items-start">
                <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                        <div className="mt-0.5 shrink-0">
                            {isProcessing ? (
                                <Loader2 className="size-5 text-blue-500 animate-spin" />
                            ) : isDone ? (
                                <CheckCircle2 className="size-5 text-emerald-500" />
                            ) : isUploadError ? (
                                <XCircle className="size-5 text-red-500" />
                            ) : isAiWarning ? (
                                <AlertTriangle className="size-5 text-amber-500" />
                            ) : (
                                <Camera className="size-5 text-muted-foreground" />
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            {sideLabel && (
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{sideLabel}</p>
                            )}

                            {isProcessing && (
                                <p className="text-xs text-blue-600 dark:text-blue-400">Analisando com IA...</p>
                            )}

                            {isDone && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                    Enviado com sucesso!
                                    {aiResult?.confidence != null && aiResult.confidence < 0.9 && (
                                        <span className="ml-1 opacity-70">
                                            (confiança {Math.round(aiResult.confidence * 100)}% — revise)
                                        </span>
                                    )}
                                </p>
                            )}

                            {isUploadError && (
                                <p className="text-xs text-red-600 dark:text-red-400">
                                    {aiResult!.validationMessage || "Erro ao enviar. Tente novamente."}
                                </p>
                            )}

                            {isAiWarning && (
                                <div className="space-y-0.5">
                                    {aiResult!.validationMessage && (
                                        <p className="text-xs text-amber-700 dark:text-amber-400">{aiResult!.validationMessage}</p>
                                    )}
                                    <p className="text-xs text-amber-700/60 dark:text-amber-400/60 italic">
                                        Documento salvo — preencha os dados manualmente se necessário.
                                    </p>
                                </div>
                            )}

                            {!isProcessing && !isDone && !isUploadError && !isAiWarning && (
                                <p className="text-xs text-muted-foreground">
                                    Envie em PDF ou foto (JPG/PNG)
                                </p>
                            )}

                            {uploadedDoc && !isProcessing && (
                                <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                                    {uploadedDoc.nomeArquivo}
                                </p>
                            )}
                        </div>
                    </div>

                    {!disabled && (
                        <Button
                            variant={isDone ? "outline" : isAiWarning ? "outline" : "default"}
                            size="sm"
                            className="w-full mt-2 gap-1.5"
                            disabled={isProcessing}
                            onClick={onFileSelected}
                        >
                            {isDone || isUploadError || isAiWarning || uploadedDoc ? (
                                <><RotateCcw className="size-3.5" />{isUploadError ? "Tentar novamente" : "Enviar outro"}</>
                            ) : (
                                <><Camera className="size-4" />Enviar PDF ou foto</>
                            )}
                        </Button>
                    )}
                </div>

                {uploadedDoc && previewUrl && !isProcessing && (
                    <DocumentThumbnail
                        url={previewUrl}
                        nomeArquivo={uploadedDoc.nomeArquivo}
                        contentType={isPdf ? "application/pdf" : undefined}
                        onClick={() => onPreview(toPreviewItem(
                            previewUrl,
                            uploadedDoc.nomeArquivo,
                            isPdf ? "application/pdf" : undefined,
                        ))}
                        size="md"
                    />
                )}
            </div>
        </div>
    );
}
