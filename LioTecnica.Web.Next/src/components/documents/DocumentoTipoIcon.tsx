"use client";

import Image from "next/image";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveDocumentoIconSrc } from "@/lib/documentoIcons";

interface Props {
    tipo: number | string;
    label: string;
    size?: "sm" | "md" | "lg";
    className?: string;
}

const SIZE_CLASS = {
    sm: "size-9",
    md: "size-11",
    lg: "size-14",
} as const;

const IMG_PX = {
    sm: 36,
    md: 44,
    lg: 56,
} as const;

export default function DocumentoTipoIcon({ tipo, label, size = "md", className }: Props) {
    const src = resolveDocumentoIconSrc(tipo);
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
                <FileText className={size === "lg" ? "size-7" : size === "md" ? "size-5" : "size-4"} />
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
