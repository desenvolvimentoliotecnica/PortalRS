"use client";

import { Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toPreviewItem } from "./DocumentThumbnail";
import type { PreviewItem } from "./DocumentPreviewLightbox";

interface Props {
    url: string;
    nomeArquivo: string;
    contentType?: string;
    onPreview: (item: PreviewItem) => void;
    onDownload?: () => void;
    disabled?: boolean;
    size?: "sm" | "default";
    className?: string;
}

export default function DocumentFileActions({
    url,
    nomeArquivo,
    contentType,
    onPreview,
    onDownload,
    disabled,
    size = "sm",
    className = "",
}: Props) {
    if (!url && !onDownload) return null;

    const btnClass = size === "sm" ? "h-8 gap-1 px-2 flex-1" : "h-9 gap-1.5 flex-1";

    return (
        <div className={`flex gap-1.5 shrink-0 ${className}`}>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className={btnClass}
                disabled={disabled || !url}
                onClick={() => onPreview(toPreviewItem(url, nomeArquivo, contentType))}
            >
                <Eye className="size-3.5 shrink-0" />
                <span className="text-xs">Visualizar</span>
            </Button>
            {onDownload ? (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={btnClass}
                    disabled={disabled}
                    onClick={onDownload}
                >
                    <Download className="size-3.5 shrink-0" />
                    <span className="text-xs">Baixar</span>
                </Button>
            ) : (
                <Button variant="outline" size="sm" className={btnClass} asChild>
                    <a href={url} download={nomeArquivo} target="_blank" rel="noopener noreferrer">
                        <Download className="size-3.5 shrink-0" />
                        <span className="text-xs">Baixar</span>
                    </a>
                </Button>
            )}
        </div>
    );
}
