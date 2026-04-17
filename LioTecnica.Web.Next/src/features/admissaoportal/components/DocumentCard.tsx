"use client";

import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, XCircle, AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import type { AiExtractionResult, UploadedDoc } from "../useAdmissaoWizardStore";
import { TIPO_DOC_LABELS, TIPOS_COM_VERSO } from "../constants";

interface Props {
    tipo: number;
    obrigatorio: boolean;
    uploadedDoc?: UploadedDoc;
    uploadedDocVerso?: UploadedDoc;
    aiResult?: AiExtractionResult;
    aiResultVerso?: AiExtractionResult;
    onFileSelected: (tipo: number, file: File, side: "frente" | "verso") => void;
    disabled?: boolean;
}

export default function DocumentCard({
    tipo, obrigatorio,
    uploadedDoc, uploadedDocVerso,
    aiResult, aiResultVerso,
    onFileSelected, disabled,
}: Props) {
    const fileRefFrente = useRef<HTMLInputElement>(null);
    const fileRefVerso = useRef<HTMLInputElement>(null);
    const label = TIPO_DOC_LABELS[tipo] || "Documento";
    const hasVerso = TIPOS_COM_VERSO.has(tipo);

    return (
        <div className="rounded-xl border-2 border-border/60 bg-card p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{label}</span>
                {obrigatorio && (
                    <span className="text-red-500 font-bold text-base leading-none" title="Obrigatório">*</span>
                )}
            </div>

            {/* Frente slot */}
            <DocumentSide
                label={hasVerso ? "Frente" : undefined}
                uploadedDoc={uploadedDoc}
                aiResult={aiResult}
                disabled={disabled}
                fileRef={fileRefFrente}
                onFileSelected={() => fileRefFrente.current?.click()}
            />
            <input
                ref={fileRefFrente}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFileSelected(tipo, f, "frente");
                    e.target.value = "";
                }}
            />

            {/* Verso slot (only for multi-side documents) */}
            {hasVerso && (
                <>
                    <DocumentSide
                        label="Verso"
                        uploadedDoc={uploadedDocVerso}
                        aiResult={aiResultVerso}
                        disabled={disabled}
                        fileRef={fileRefVerso}
                        onFileSelected={() => fileRefVerso.current?.click()}
                    />
                    <input
                        ref={fileRefVerso}
                        type="file"
                        accept="image/*"
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
    );
}

// ── Sub-componente: um lado do documento ──────────────────────────────────────

interface SideProps {
    label?: string;
    uploadedDoc?: UploadedDoc;
    aiResult?: AiExtractionResult;
    disabled?: boolean;
    fileRef: React.RefObject<HTMLInputElement | null>;
    onFileSelected: () => void;
}

function DocumentSide({ label, uploadedDoc, aiResult, disabled, onFileSelected }: SideProps) {
    const isProcessing = aiResult?.processing;
    const isValid = aiResult && !aiResult.processing && aiResult.isValid;
    const isUploadError = !uploadedDoc && aiResult && !aiResult.processing && !aiResult.isValid;
    const isAiWarning = !!uploadedDoc && aiResult && !aiResult.processing && !aiResult.isValid;
    const isDone = uploadedDoc && isValid;

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
            <div className="flex items-start gap-2">
                {/* Icon */}
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

                {/* Info */}
                <div className="flex-1 min-w-0">
                    {label && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>}

                    {isProcessing && (
                        <p className="text-xs text-blue-600 dark:text-blue-400">Analisando com IA...</p>
                    )}

                    {isDone && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">
                            Reconhecido!
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
                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                    {aiResult!.validationMessage}
                                </p>
                            )}
                            {aiResult!.documentType && (
                                <p className="text-xs text-amber-600/80 dark:text-amber-500/80">
                                    IA detectou: <span className="font-medium">{aiResult!.documentType}</span>
                                </p>
                            )}
                            {aiResult!.confidence > 0 && (
                                <p className="text-xs text-amber-600/70 dark:text-amber-500/70">
                                    Confiança: {Math.round(aiResult!.confidence * 100)}%
                                </p>
                            )}
                            <p className="text-xs text-amber-700/60 dark:text-amber-400/60 italic">
                                Documento salvo — preencha os dados manualmente.
                            </p>
                        </div>
                    )}

                    {!isProcessing && !isDone && !isUploadError && !isAiWarning && (
                        <p className="text-xs text-muted-foreground">
                            {label ? `Envie a ${label.toLowerCase()} do documento` : "Tire uma foto ou envie o arquivo"}
                        </p>
                    )}

                    {uploadedDoc && !isProcessing && (
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
                            {uploadedDoc.nomeArquivo}
                        </p>
                    )}
                </div>
            </div>

            {/* Upload button */}
            {!disabled && (
                <Button
                    variant={isDone ? "outline" : isAiWarning ? "outline" : "default"}
                    size="sm"
                    className="w-full mt-2 gap-1.5"
                    disabled={isProcessing}
                    onClick={onFileSelected}
                >
                    {isDone || isUploadError || isAiWarning ? (
                        <><RotateCcw className="size-3.5" />{isUploadError ? "Tentar novamente" : "Enviar outro"}</>
                    ) : (
                        <><Camera className="size-4" />Tirar Foto / Arquivo</>
                    )}
                </Button>
            )}
        </div>
    );
}
