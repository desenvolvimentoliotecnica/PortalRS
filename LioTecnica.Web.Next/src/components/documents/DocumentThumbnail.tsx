"use client";

import { Eye, FileText } from "lucide-react";
import { isPdfPreview, type PreviewItem } from "./DocumentPreviewLightbox";

interface Props {
    url: string;
    nomeArquivo: string;
    contentType?: string;
    onClick: () => void;
    size?: "sm" | "md";
    className?: string;
}

function isPdf(nomeArquivo: string, contentType?: string) {
    return isPdfPreview({ url: "", nomeArquivo, contentType });
}

export default function DocumentThumbnail({
    url,
    nomeArquivo,
    contentType,
    onClick,
    size = "md",
    className = "",
}: Props) {
    const dim = size === "sm" ? "h-14 w-14" : "h-[4.5rem] w-[4.5rem]";
    const pdf = isPdf(nomeArquivo, contentType);

    return (
        <button
            type="button"
            onClick={onClick}
            title="Clique para ampliar"
            aria-label={`Visualizar ${nomeArquivo}`}
            className={`group relative shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted/20 transition-all hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${dim} ${className}`}
        >
            {pdf ? (
                <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-muted/40 text-muted-foreground">
                    <FileText className="size-5" />
                    <span className="text-[9px] font-medium uppercase tracking-wide">PDF</span>
                </span>
            ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={url}
                    alt={nomeArquivo}
                    className="h-full w-full object-cover"
                />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/25 group-hover:opacity-100">
                <Eye className="size-4 text-white drop-shadow" />
            </span>
        </button>
    );
}

export function toPreviewItem(
    url: string,
    nomeArquivo: string,
    contentType?: string,
): PreviewItem {
    return { url, nomeArquivo, contentType };
}
