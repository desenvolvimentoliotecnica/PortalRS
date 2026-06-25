"use client";

import { cn } from "@/lib/utils";

interface Props {
    children: React.ReactNode;
    className?: string;
    /** Largura máxima do card — documentos com frente/verso precisam de mais espaço */
    wide?: boolean;
}

/** Card centralizado (H+V) para etapas do wizard — scroll interno quando o conteúdo excede a altura disponível. */
export default function WizardStepPanel({ children, className, wide }: Props) {
    return (
        <div className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden p-4 sm:p-6">
            <div
                className={cn(
                    "w-full self-center max-h-full min-h-0 overflow-y-auto overscroll-contain rounded-2xl border border-border/50 bg-card shadow-lg",
                    "px-6 py-8 sm:px-10 sm:py-10",
                    wide ? "max-w-4xl" : "max-w-2xl",
                    className,
                )}
            >
                {children}
            </div>
        </div>
    );
}
