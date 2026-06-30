"use client";

import Image from "next/image";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveDocumentoIconSrc } from "@/lib/documentoIcons";

interface Props {
    tipo: number | string;
    label: string;
    /** inline = badge compacto; sidebar = preenche coluna lateral do card (20%) */
    variant?: "inline" | "sidebar";
    size?: "sm" | "md" | "lg";
    className?: string;
}

const SIZE_CLASS = {
    sm: "size-[3.375rem]",
    md: "size-[4.125rem]",
    lg: "size-[5.25rem]",
} as const;

const IMG_PX = {
    sm: 54,
    md: 66,
    lg: 84,
} as const;

export default function DocumentoTipoIcon({
    tipo,
    label,
    variant = "inline",
    size = "md",
    className,
}: Props) {
    const src = resolveDocumentoIconSrc(tipo);

    if (variant === "sidebar") {
        if (!src) {
            return (
                <span
                    className={cn(
                        "flex h-full w-full items-center justify-center bg-primary/5 p-3",
                        className,
                    )}
                    aria-hidden
                >
                    <FileText className="size-[3.75rem] text-primary/70 sm:size-[4.5rem]" />
                </span>
            );
        }

        return (
            <span
                className={cn(
                    "relative flex h-full w-full items-center justify-center bg-white/80 p-2 sm:p-3",
                    className,
                )}
            >
                <Image
                    src={src}
                    alt=""
                    width={240}
                    height={240}
                    className="max-h-full max-w-full object-contain"
                    unoptimized
                />
                <span className="sr-only">{label}</span>
            </span>
        );
    }

    const box = SIZE_CLASS[size];

    if (!src) {
        return (
            <span
                className={cn(
                    "flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary",
                    box,
                    className,
                )}
                aria-hidden
            >
                <FileText className={size === "lg" ? "size-[2.625rem]" : size === "md" ? "size-8" : "size-6"} />
            </span>
        );
    }

    return (
        <span
            className={cn(
                "relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-border/40",
                box,
                className,
            )}
        >
            <Image
                src={src}
                alt=""
                width={IMG_PX[size]}
                height={IMG_PX[size]}
                className="size-full object-contain p-0.5"
                unoptimized
            />
            <span className="sr-only">{label}</span>
        </span>
    );
}

/** Coluna lateral (20%) com ícone centralizado na altura do card. */
export function DocumentoIconSidebar({
    tipo,
    label,
    className,
}: {
    tipo: number | string;
    label: string;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex w-[20%] min-w-[6.375rem] max-w-[8.25rem] shrink-0 self-stretch border-r border-border/25",
                className,
            )}
        >
            <DocumentoTipoIcon tipo={tipo} label={label} variant="sidebar" className="min-h-[8.25rem]" />
        </div>
    );
}
