"use client";

import React, { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
    CloudUpload, Loader2, Trash2, RotateCcw, FileText, Eye, CheckCircle2,
} from "lucide-react";
import type { AiExtractionResult, UploadedDoc } from "../useAdmissaoWizardStore";
import { ACCEPTED_DOC_MIME, TIPOS_COM_VERSO } from "../constants";
import { DOC_FRENTE_LABELS, DOC_HINTS, DOC_VERSO_LABELS } from "../admissaoDocumentoCatalog";
import DocumentPreviewLightbox, { type PreviewItem, isPdfPreview } from "@/components/documents/DocumentPreviewLightbox";
import { toPreviewItem } from "@/components/documents/DocumentThumbnail";

interface Props {
    index: number;
    tipo: number;
    obrigatorio: boolean;
    labelOverride?: string;
    uploadedDoc?: UploadedDoc;
    uploadedDocVerso?: UploadedDoc;
    aiResult?: AiExtractionResult;
    aiResultVerso?: AiExtractionResult;
    onFileSelected: (tipo: number, file: File, side: "frente" | "verso") => void;
    onRemove?: (tipo: number, side: "frente" | "verso", docId: string) => void;
    disabled?: boolean;
}

export default function DocumentCard({
    index, tipo, obrigatorio, labelOverride,
    uploadedDoc, uploadedDocVerso,
    aiResult, aiResultVerso,
    onFileSelected, onRemove, disabled,
}: Props) {
    const fileRefFrente = useRef<HTMLInputElement>(null);
    const fileRefVerso = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<PreviewItem | null>(null);
    const label = labelOverride || "Documento";
    const hint = DOC_HINTS[tipo];
    const hasVerso = TIPOS_COM_VERSO.has(tipo);

    return (
        <>
            <div className="flex flex-col rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden h-full">
                {/* Header */}
                <div className="px-4 pt-4 pb-2">
                    <div className="flex items-start gap-2.5">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {index > 0 ? index : "·"}
                        </span>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-1">
                                <h3 className="text-sm font-semibold leading-snug text-foreground">{label}</h3>
                                {obrigatorio && (
                                    <span className="text-red-500 font-bold leading-none shrink-0" title="Obrigatório">*</span>
                                )}
                            </div>
                            {hint && (
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{hint}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="px-4 pb-3 flex-1">
                    {hasVerso ? (
                        <div className="grid grid-cols-2 gap-2">
                            <UploadSlot
                                sideLabel={DOC_FRENTE_LABELS[tipo] || "Frente"}
                                uploadedDoc={uploadedDoc}
                                aiResult={aiResult}
                                disabled={disabled}
                                onSelect={() => fileRefFrente.current?.click()}
                                onFileDropped={(f) => onFileSelected(tipo, f, "frente")}
                                onRemove={uploadedDoc?.id && onRemove
                                    ? () => onRemove(tipo, "frente", uploadedDoc.id!)
                                    : undefined}
                                onPreview={setPreview}
                            />
                            <UploadSlot
                                sideLabel={DOC_VERSO_LABELS[tipo] || "Verso"}
                                uploadedDoc={uploadedDocVerso}
                                aiResult={aiResultVerso}
                                disabled={disabled}
                                onSelect={() => fileRefVerso.current?.click()}
                                onFileDropped={(f) => onFileSelected(tipo, f, "verso")}
                                onRemove={uploadedDocVerso?.id && onRemove
                                    ? () => onRemove(tipo, "verso", uploadedDocVerso.id!)
                                    : undefined}
                                onPreview={setPreview}
                            />
                        </div>
                    ) : (
                        <UploadSlot
                            uploadedDoc={uploadedDoc}
                            aiResult={aiResult}
                            disabled={disabled}
                            onSelect={() => fileRefFrente.current?.click()}
                            onFileDropped={(f) => onFileSelected(tipo, f, "frente")}
                            onRemove={uploadedDoc?.id && onRemove
                                ? () => onRemove(tipo, "frente", uploadedDoc.id!)
                                : undefined}
                            onPreview={setPreview}
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-border/30 bg-muted/20">
                    <p className="text-[10px] text-muted-foreground text-center">
                        Formatos aceitos: PDF, JPG, PNG. Máx. 10MB
                    </p>
                </div>

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
                )}
            </div>

            <DocumentPreviewLightbox preview={preview} onClose={() => setPreview(null)} />
        </>
    );
}

interface SlotProps {
    sideLabel?: string;
    uploadedDoc?: UploadedDoc;
    aiResult?: AiExtractionResult;
    disabled?: boolean;
    onSelect: () => void;
    onFileDropped: (file: File) => void;
    onRemove?: () => void;
    onPreview: (item: PreviewItem) => void;
}

function UploadSlot({
    sideLabel, uploadedDoc, aiResult, disabled, onSelect, onFileDropped, onRemove, onPreview,
}: SlotProps) {
    const [dragOver, setDragOver] = useState(false);
    const isProcessing = aiResult?.processing;
    const previewUrl = uploadedDoc?.presignedUrl || uploadedDoc?.thumbnail;
    const isPdf = uploadedDoc && isPdfPreview({
        url: previewUrl ?? "",
        nomeArquivo: uploadedDoc.nomeArquivo,
    });

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled || isProcessing) return;
        const f = e.dataTransfer.files?.[0];
        if (f) onFileDropped(f);
    }, [disabled, isProcessing, onFileDropped]);

    if (uploadedDoc && previewUrl && !isProcessing) {
        return (
            <div className="flex flex-col gap-2">
                {sideLabel && (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{sideLabel}</p>
                )}
                <div className="relative rounded-lg border border-emerald-200/80 bg-emerald-50/30 dark:bg-emerald-950/10 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => onPreview(toPreviewItem(
                            previewUrl,
                            uploadedDoc.nomeArquivo,
                            isPdf ? "application/pdf" : undefined,
                        ))}
                        className="group relative flex w-full aspect-[4/3] items-center justify-center bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={`Visualizar ${uploadedDoc.nomeArquivo}`}
                    >
                        {isPdf ? (
                            <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                                <FileText className="size-10 text-red-500/80" />
                                <span className="text-[10px] font-medium uppercase">PDF</span>
                            </div>
                        ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={previewUrl}
                                alt={uploadedDoc.nomeArquivo}
                                className="h-full w-full object-cover"
                            />
                        )}
                        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                            <Eye className="size-5 text-white drop-shadow" />
                        </span>
                        <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                            <CheckCircle2 className="size-3" />
                        </span>
                    </button>
                </div>
                {!disabled && (
                    <div className="flex gap-1.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950/30"
                            onClick={onRemove}
                            disabled={!onRemove}
                        >
                            <Trash2 className="size-3" /> Remover
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-xs gap-1"
                            onClick={onSelect}
                        >
                            <RotateCcw className="size-3" /> Reenviar
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1">
            {sideLabel && (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{sideLabel}</p>
            )}
            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-5 transition-colors min-h-[9rem] ${
                    dragOver
                        ? "border-primary bg-primary/5"
                        : "border-primary/25 bg-primary/[0.02] hover:border-primary/40"
                } ${isProcessing ? "opacity-70 pointer-events-none" : ""}`}
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="size-8 text-primary animate-spin mb-2" />
                        <p className="text-xs text-muted-foreground text-center">Enviando...</p>
                    </>
                ) : (
                    <>
                        <CloudUpload className="size-8 text-primary/70 mb-2" />
                        <p className="text-xs text-muted-foreground text-center mb-2 leading-snug">
                            Arraste o arquivo aqui ou
                        </p>
                        {!disabled && (
                            <Button
                                type="button"
                                size="sm"
                                className="h-8 text-xs px-4"
                                onClick={onSelect}
                            >
                                Selecionar arquivo
                            </Button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
