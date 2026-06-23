"use client";

import { Download, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PreviewItem {
    url: string;
    nomeArquivo: string;
    contentType?: string;
}

interface Props {
    preview: PreviewItem | null;
    onClose: () => void;
}

function isPdf(item: PreviewItem) {
    if (item.contentType === "application/pdf") return true;
    const name = item.nomeArquivo.toLowerCase();
    return name.endsWith(".pdf") || item.url.includes("application/pdf");
}

function isImage(item: PreviewItem) {
    if (item.contentType?.startsWith("image/")) return true;
    const name = item.nomeArquivo.toLowerCase();
    return /\.(jpe?g|png|gif|webp)$/i.test(name);
}

export default function DocumentPreviewLightbox({ preview, onClose }: Props) {
    if (!preview) return null;

    const pdf = isPdf(preview);
    const image = isImage(preview);

    return (
        <div
            className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="flex h-[90vh] w-[95vw] max-w-[1200px] flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">Visualizar documento</div>
                        <div className="truncate text-xs text-muted-foreground">{preview.nomeArquivo}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const a = document.createElement("a");
                                a.href = preview.url;
                                a.download = preview.nomeArquivo || "documento";
                                a.rel = "noopener";
                                a.target = "_blank";
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                            }}
                        >
                            <Download className="size-4 mr-1" />
                            Baixar
                        </Button>
                        <Button variant="outline" size="sm" onClick={onClose}>
                            <X className="size-4 mr-1" />
                            Fechar
                        </Button>
                    </div>
                </div>

                <div className="min-h-0 flex-1 bg-muted/30 flex items-center justify-center overflow-auto p-4">
                    {pdf ? (
                        <iframe
                            title={`PDF — ${preview.nomeArquivo}`}
                            src={preview.url}
                            className="h-full w-full min-h-[60vh] rounded-lg bg-white"
                        />
                    ) : image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={preview.url}
                            alt={preview.nomeArquivo}
                            className="max-h-full max-w-full object-contain rounded-lg shadow-md"
                        />
                    ) : (
                        <div className="text-center space-y-3 py-12">
                            <FileText className="size-16 mx-auto text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Pré-visualização não disponível para este formato.</p>
                            <Button variant="outline" size="sm" asChild>
                                <a href={preview.url} target="_blank" rel="noopener noreferrer">Abrir arquivo</a>
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
