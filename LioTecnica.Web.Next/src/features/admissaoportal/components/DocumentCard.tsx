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
import DocumentoTipoIcon from "@/components/documents/DocumentoTipoIcon";
import { toPreviewItem } from "@/components/documents/DocumentThumbnail";
import { usePortalDocumentPreview } from "../usePortalDocumentPreview";
import type { AdmissaoPortalSession } from "../publicApi";

/** Altura fixa das zonas de upload para alinhar cards simples e frente/verso. */
const SIZES = {
    default: {
        dropzone: "h-[9.5rem]",
        sideLabel: "h-9",
        thumb: "max-h-[100px]",
        cardMinH: "min-h-[18.5rem]",
        headerMinH: "min-h-[5.5rem]",
        indexBadge: "size-7 text-xs",
        title: "text-sm",
        hint: "text-xs min-h-[2.5rem]",
        footer: "text-[10px]",
        sideLabelText: "text-[10px]",
        slotBtn: "h-8 text-xs",
        uploadIcon: "size-7",
        uploadText: "text-[11px]",
        selectBtn: "h-7 text-[11px]",
        pdfIcon: "size-6",
        processingText: "text-[10px]",
        loader: "size-5",
    },
    wizard: {
        dropzone: "h-[16.5rem]",
        sideLabel: "h-16",
        thumb: "max-h-[180px]",
        cardMinH: "min-h-0",
        headerMinH: "min-h-[10rem]",
        indexBadge: "size-14 text-xl",
        title: "text-2xl",
        hint: "text-base min-h-[4.5rem]",
        footer: "text-sm",
        sideLabelText: "text-sm",
        slotBtn: "h-14 text-base",
        uploadIcon: "size-12",
        uploadText: "text-base",
        selectBtn: "h-12 text-base px-5",
        pdfIcon: "size-12",
        processingText: "text-sm",
        loader: "size-8",
    },
} as const;

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
    session?: AdmissaoPortalSession;
    size?: keyof typeof SIZES;
}

export default function DocumentCard({
    index, tipo, obrigatorio, labelOverride,
    uploadedDoc, uploadedDocVerso,
    aiResult, aiResultVerso,
    onFileSelected, onRemove, disabled, session,
    size = "default",
}: Props) {
    const s = SIZES[size];
    const fileRefFrente = useRef<HTMLInputElement>(null);
    const fileRefVerso = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<PreviewItem | null>(null);
    const label = labelOverride || "Documento";
    const hint = DOC_HINTS[tipo];
    const hasVerso = TIPOS_COM_VERSO.has(tipo);

    return (
        <>
            <div className={`flex flex-col rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden h-full ${s.cardMinH}`}>
                {/* Header — altura estável do título + hint */}
                <div className={`px-5 pt-5 pb-4 ${s.headerMinH}`}>
                    <div className="flex items-start gap-3">
                        <DocumentoTipoIcon
                            tipo={tipo}
                            label={label}
                            size={size === "wizard" ? "lg" : "md"}
                            className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-1 min-h-[1.25rem]">
                                <h3 className={`${s.title} font-semibold leading-snug text-foreground line-clamp-2`}>{label}</h3>
                                {obrigatorio && (
                                    <span className="text-red-500 font-bold leading-none shrink-0 text-lg" title="Obrigatório">*</span>
                                )}
                            </div>
                            <p className={`${s.hint} text-muted-foreground mt-1.5 leading-relaxed line-clamp-3`}>
                                {hint || "\u00A0"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="px-5 pb-4 flex-1 flex flex-col">
                    {hasVerso ? (
                        <div className="grid grid-cols-2 gap-3 items-stretch flex-1">
                            <UploadSlot
                                size={size}
                                sideLabel={DOC_FRENTE_LABELS[tipo] || "Frente"}
                                uploadedDoc={uploadedDoc}
                                aiResult={aiResult}
                                disabled={disabled}
                                session={session}
                                onSelect={() => fileRefFrente.current?.click()}
                                onFileDropped={(f) => onFileSelected(tipo, f, "frente")}
                                onRemove={uploadedDoc?.id && onRemove
                                    ? () => onRemove(tipo, "frente", uploadedDoc.id!)
                                    : undefined}
                                onPreview={setPreview}
                            />
                            <UploadSlot
                                size={size}
                                sideLabel={DOC_VERSO_LABELS[tipo] || "Verso"}
                                uploadedDoc={uploadedDocVerso}
                                aiResult={aiResultVerso}
                                disabled={disabled}
                                session={session}
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
                            size={size}
                            uploadedDoc={uploadedDoc}
                            aiResult={aiResult}
                            disabled={disabled}
                            session={session}
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
                <div className="px-5 py-3 border-t border-border/30 bg-muted/20 mt-auto">
                    <p className={`${s.footer} text-muted-foreground text-center leading-snug`}>
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
    size?: keyof typeof SIZES;
    sideLabel?: string;
    uploadedDoc?: UploadedDoc;
    aiResult?: AiExtractionResult;
    disabled?: boolean;
    session?: AdmissaoPortalSession;
    onSelect: () => void;
    onFileDropped: (file: File) => void;
    onRemove?: () => void;
    onPreview: (item: PreviewItem) => void;
}

function SideLabel({ children, size = "default" }: { children: React.ReactNode; size?: keyof typeof SIZES }) {
    const s = SIZES[size];
    return (
        <p className={`${s.sideLabel} ${s.sideLabelText} flex items-end font-semibold uppercase tracking-wide text-muted-foreground leading-tight line-clamp-2 shrink-0`}>
            {children}
        </p>
    );
}

function UploadSlot({
    size = "default", sideLabel, uploadedDoc, aiResult, disabled, session, onSelect, onFileDropped, onRemove, onPreview,
}: SlotProps) {
    const s = SIZES[size];
    const [dragOver, setDragOver] = useState(false);
    const isProcessing = aiResult?.processing;
    const previewUrl = usePortalDocumentPreview(session, uploadedDoc);
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

    if (uploadedDoc) {
        return (
            <div className="flex flex-col h-full gap-2">
                {sideLabel ? <SideLabel size={size}>{sideLabel}</SideLabel> : <span className={s.sideLabel} />}
                <div className="relative rounded-lg border border-emerald-200/80 bg-emerald-50/30 dark:bg-emerald-950/10 overflow-hidden py-3 px-3 flex items-center justify-center min-h-[5.5rem]">
                    {isProcessing && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/70 backdrop-blur-[1px]">
                            <Loader2 className={`${s.loader} text-primary animate-spin mb-1`} />
                            <p className={`${s.processingText} text-muted-foreground`}>Analisando...</p>
                        </div>
                    )}
                    {previewUrl ? (
                    <button
                        type="button"
                        onClick={() => onPreview(toPreviewItem(
                            previewUrl,
                            uploadedDoc.nomeArquivo,
                            isPdf ? "application/pdf" : undefined,
                        ))}
                        className="group relative inline-flex max-w-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                        aria-label={`Visualizar ${uploadedDoc.nomeArquivo}`}
                    >
                        {isPdf ? (
                            <div className={`flex flex-col items-center gap-1 text-muted-foreground ${s.thumb}`}>
                                <FileText className={`${s.pdfIcon} text-red-500/80`} />
                                <span className="text-[10px] font-medium uppercase">PDF</span>
                            </div>
                        ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={previewUrl}
                                alt={uploadedDoc.nomeArquivo}
                                className={`${s.thumb} w-auto max-w-full object-contain`}
                            />
                        )}
                        <span className="absolute inset-0 flex items-center justify-center rounded bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                            <Eye className="size-4 text-white drop-shadow" />
                        </span>
                        {!isProcessing && (
                            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
                                <CheckCircle2 className="size-2.5" />
                            </span>
                        )}
                    </button>
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-1 py-2">
                            <FileText className="size-6 text-muted-foreground" />
                            <p className="text-[10px] text-muted-foreground px-2 text-center truncate max-w-full">{uploadedDoc.nomeArquivo}</p>
                        </div>
                    )}
                </div>
                {!disabled && (
                    <div className="flex gap-2 shrink-0">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={`flex-1 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950/30 ${s.slotBtn}`}
                            onClick={onRemove}
                            disabled={!onRemove}
                        >
                            <Trash2 className="size-4" /> Remover
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={`flex-1 gap-1.5 ${s.slotBtn}`}
                            onClick={onSelect}
                        >
                            <RotateCcw className="size-4" /> Reenviar
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {sideLabel ? <SideLabel size={size}>{sideLabel}</SideLabel> : <span className={s.sideLabel} aria-hidden />}
            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-5 transition-colors ${s.dropzone} ${
                    dragOver
                        ? "border-primary bg-primary/5"
                        : "border-primary/25 bg-primary/[0.02] hover:border-primary/40"
                } ${isProcessing ? "opacity-70 pointer-events-none" : ""}`}
            >
                {isProcessing ? (
                    <>
                        <Loader2 className={`${s.uploadIcon} text-primary animate-spin mb-2 shrink-0`} />
                        <p className={`${s.uploadText} text-muted-foreground text-center leading-snug px-1`}>Enviando...</p>
                    </>
                ) : (
                    <>
                        <CloudUpload className={`${s.uploadIcon} text-primary/70 mb-2 shrink-0`} />
                        <p className={`${s.uploadText} text-muted-foreground text-center mb-3 leading-snug px-1`}>
                            Arraste o arquivo aqui ou
                        </p>
                        {!disabled && (
                            <Button
                                type="button"
                                size="sm"
                                className={`shrink-0 ${s.selectBtn}`}
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
